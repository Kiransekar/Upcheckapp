import { readFileSync } from 'fs';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import axios from 'axios';
import { NewsIngestionService } from './news-ingestion.service';
import { NewsArticle } from './news-article.entity';
import { NewsSource } from './news-source.entity';
import { RedisService } from '../redis/redis.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const fixture = (name: string) =>
  readFileSync(join(__dirname, '__fixtures__', name), 'utf8');

const SHRIMP_FEED = fixture('shrimp-feed.rss.xml');
const INSTITUTIONAL_FEED = fixture('institutional-feed.atom.xml');

const source = (over: Partial<NewsSource> = {}): NewsSource =>
  ({
    id: 's1',
    name: 'Trade Press',
    feedUrl: 'https://example-trade-press.test/category/shrimp/feed/',
    feedType: 'rss',
    defaultCategory: 'market',
    weight: 55,
    isActive: true,
    ...over,
  }) as NewsSource;

describe('NewsIngestionService', () => {
  let service: NewsIngestionService;
  let articles: any;
  let sources: any;
  let redis: any;
  let saved: any[];

  beforeEach(async () => {
    saved = [];
    articles = {
      create: jest.fn((row) => row),
      save: jest.fn((row) => {
        saved.push(row);
        return Promise.resolve({ ...row, id: `a${saved.length}` });
      }),
      find: jest.fn().mockResolvedValue([]),
    };
    sources = {
      find: jest.fn().mockResolvedValue([source()]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    redis = { get: jest.fn().mockResolvedValue(null), set: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsIngestionService,
        { provide: getRepositoryToken(NewsArticle), useValue: articles },
        { provide: getRepositoryToken(NewsSource), useValue: sources },
        { provide: RedisService, useValue: redis },
      ],
    }).compile();

    service = module.get(NewsIngestionService);
    mockedAxios.get.mockResolvedValue({ data: SHRIMP_FEED } as any);
  });

  afterEach(() => jest.clearAllMocks());

  describe('the legal boundary (spec §2.1)', () => {
    // The one test that stops a future refactor from quietly reintroducing
    // legal exposure. The fixture's <content:encoded> is deliberately loud.
    it('never persists a publisher body, even though the feed carries one', async () => {
      await service.ingestSource(source());

      expect(saved.length).toBeGreaterThan(0);
      for (const row of saved) {
        expect(row.content).toBeNull();
        expect(JSON.stringify(row)).not.toContain('FULL ARTICLE BODY');
      }
    });

    it('stores no summary of our own until one is written, rather than reusing theirs', async () => {
      await service.ingestSource(source());

      for (const row of saved) {
        expect(row.summary).toBeNull();
      }
      expect(JSON.stringify(saved)).not.toContain('Farmgate rates for 30-count');
    });

    it('refuses outright to save a row carrying a body', () => {
      expect(() =>
        service.assertPersistable({
          title: 'x',
          content: "The publisher's second paragraph.",
        }),
      ).toThrow(/Refusing to persist/);
    });

    it('refuses a summary longer than we are allowed to show', () => {
      expect(() =>
        service.assertPersistable({ title: 'x', summary: 'a'.repeat(301) }),
      ).toThrow(/300 characters/);
    });

    it('re-hosts no publisher imagery', async () => {
      await service.ingestSource(source());
      for (const row of saved) expect(row.imageUrl).toBeNull();
    });

    it('attributes and links every item it keeps', async () => {
      await service.ingestSource(source());
      for (const row of saved) {
        expect(row.sourceName).toBe('Trade Press');
        expect(row.canonicalUrl).toMatch(/^https:\/\//);
      }
    });
  });

  describe('relevance filtering', () => {
    it('keeps the shrimp story and drops the salmon one', async () => {
      const stats = await service.ingestSource(source());

      const titles = saved.map((r) => r.title);
      expect(titles).toContain(
        'Vannamei prices firm in Nellore as processors return to the market',
      );
      expect(titles.join(' ')).not.toContain('Norwegian salmon');
      expect(stats.filtered).toBeGreaterThan(0);
    });

    it('drops an item with nowhere to link, however relevant it reads', async () => {
      await service.ingestSource(source());
      expect(saved.map((r) => r.title)).not.toContain(
        'An item with no link at all',
      );
    });
  });

  describe('classification and review', () => {
    it('holds a regulatory item for a human instead of publishing it', async () => {
      await service.ingestSource(source());

      const caa = saved.find((r) => r.title.includes('Coastal Aquaculture'));
      expect(caa.category).toBe('regulation');
      expect(caa.status).toBe('pending_review');
    });

    it('publishes a market item without review', async () => {
      await service.ingestSource(source());

      const price = saved.find((r) => r.title.includes('Vannamei prices'));
      expect(price.status).toBe('published');
    });

    it('parses Atom as well as RSS', async () => {
      mockedAxios.get.mockResolvedValue({ data: INSTITUTIONAL_FEED } as any);

      await service.ingestSource(
        source({ name: 'Institution', weight: 90, defaultCategory: 'regulation' }),
      );

      expect(saved.map((r) => r.title)).toEqual([
        'Registration of aquaculture units: revised procedure',
        'Advisory on white spot syndrome virus in coastal districts',
      ]);
    });
  });

  describe('deduplication', () => {
    it('does not re-persist a story already in the table', async () => {
      await service.ingestSource(source());
      const known = saved.map((r) => ({
        dedupeHash: r.dedupeHash,
        canonicalUrl: r.canonicalUrl,
      }));

      saved.length = 0;
      articles.find.mockResolvedValue(known);
      const stats = await service.ingestSource(source());

      expect(saved).toHaveLength(0);
      expect(stats.deduped).toBe(known.length);
    });

    it('shrugs off a unique-violation race with another instance', async () => {
      articles.save.mockRejectedValue(
        Object.assign(new Error('duplicate key'), { code: '23505' }),
      );

      await expect(service.ingestSource(source())).resolves.toMatchObject({
        persisted: 0,
      });
    });
  });

  describe('failure modes', () => {
    it('records the error and keeps going when a feed is dead', async () => {
      mockedAxios.get.mockRejectedValue(new Error('ETIMEDOUT'));

      const stats = await service.ingestSource(source());

      expect(stats.failed).toBe(1);
      expect(sources.update).toHaveBeenCalledWith(
        's1',
        expect.objectContaining({ lastError: expect.stringContaining('ETIMEDOUT') }),
      );
    });

    it('does not fail the whole run because one source is dead', async () => {
      sources.find.mockResolvedValue([
        source({ id: 's1', name: 'Dead' }),
        source({ id: 's2', name: 'Alive' }),
      ]);
      mockedAxios.get
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({ data: SHRIMP_FEED } as any);

      const stats = await service.run();

      expect(stats.failed).toBe(1);
      expect(stats.persisted).toBeGreaterThan(0);
    });

    it('honours the per-source hourly lock rather than polling again', async () => {
      redis.get.mockResolvedValue('1');

      const stats = await service.ingestSource(source());

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(stats).toMatchObject({ fetched: 0, persisted: 0 });
    });

    it('identifies itself and gives up after ten seconds', async () => {
      await service.ingestSource(source());

      expect(mockedAxios.get).toHaveBeenCalledWith(
        source().feedUrl,
        expect.objectContaining({
          timeout: 10_000,
          headers: expect.objectContaining({
            'User-Agent': expect.stringContaining('UpcheckBot/1.0'),
          }),
        }),
      );
    });

    it('skips the run instead of throwing when news_sources is not migrated', async () => {
      sources.find.mockRejectedValue(
        Object.assign(new Error('relation does not exist'), { code: '42P01' }),
      );

      await expect(service.run()).resolves.toMatchObject({ persisted: 0 });
    });
  });
});
