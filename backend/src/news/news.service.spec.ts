import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NewsService } from './news.service';
import { NewsArticle } from './news-article.entity';
import { NewsArticleTranslation } from './news-article-translation.entity';
import { NEWS_FRESH_WINDOW_DAYS } from './feed-rules';

const article = (over: Partial<NewsArticle> = {}): NewsArticle =>
  ({
    id: 'a1',
    title: 'MPEDA raises shrimp export target',
    summary: 'Our summary.',
    status: 'published',
    isActive: true,
    ...over,
  }) as NewsArticle;

/** The `publishedAt` value findAndCount was actually called with is a
 *  TypeORM FindOperator built from `new Date(Date.now() - ...)`, so it can't
 *  be asserted by exact equality — only that it is a "more than or equal to"
 *  bound roughly NEWS_FRESH_WINDOW_DAYS ago. */
const assertFreshCutoff = (op: any) => {
  expect(op.type).toBe('moreThanOrEqual');
  const daysAgo = (Date.now() - op.value.getTime()) / (24 * 60 * 60 * 1000);
  expect(daysAgo).toBeCloseTo(NEWS_FRESH_WINDOW_DAYS, 1);
};

const createArticlesRepo = () => ({
  create: jest.fn().mockImplementation((dto) => dto),
  save: jest.fn().mockImplementation((e) => Promise.resolve({ ...e, id: 'a1' })),
  findAndCount: jest.fn().mockResolvedValue([[], 0]),
  findOneBy: jest.fn().mockResolvedValue(null),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  delete: jest.fn().mockResolvedValue({ affected: 1 }),
});

const createTranslationsRepo = () => ({ find: jest.fn().mockResolvedValue([]) });

describe('NewsService', () => {
  let service: NewsService;
  let articles: ReturnType<typeof createArticlesRepo>;
  let translations: ReturnType<typeof createTranslationsRepo>;

  beforeEach(async () => {
    articles = createArticlesRepo();
    translations = createTranslationsRepo();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: getRepositoryToken(NewsArticle), useValue: articles },
        {
          provide: getRepositoryToken(NewsArticleTranslation),
          useValue: translations,
        },
      ],
    }).compile();
    service = module.get(NewsService);
  });

  describe('findAll', () => {
    it('returns a page, not the whole table — a daily ingestion run must not grow the response without bound', async () => {
      articles.findAndCount.mockResolvedValue([[article()], 137]);

      const page = await service.findAll({ page: 2, take: 20 });

      expect(articles.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20, skip: 20 }),
      );
      expect(page.data).toHaveLength(1);
      expect(page.meta.itemCount).toBe(137);
      expect(page.meta.pageCount).toBe(7);
      expect(page.meta.hasNextPage).toBe(true);
    });

    it('lists published items only, newest first', async () => {
      await service.findAll({});

      const call = articles.findAndCount.mock.calls[0][0];
      expect(call.where).toMatchObject({ isActive: true, status: 'published' });
      expect(call.order).toEqual({ publishedAt: 'DESC' });
      assertFreshCutoff(call.where.publishedAt);
    });

    it('filters by category', async () => {
      await service.findAll({ category: 'regulation' });

      expect(articles.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: 'regulation' }),
        }),
      );
    });

    it('still serves news when the feed migration has not been applied yet', async () => {
      // One unmigrated column must not 500 an endpoint that already ships.
      const undefinedColumn = Object.assign(new Error('column does not exist'), {
        code: '42703',
      });
      articles.findAndCount
        .mockRejectedValueOnce(undefinedColumn)
        .mockResolvedValueOnce([[article()], 1]);

      const page = await service.findAll({});

      expect(page.data).toHaveLength(1);
      const call = articles.findAndCount.mock.calls[1][0];
      expect(call.where).toMatchObject({ isActive: true });
      expect(call.where.status).toBeUndefined();
      assertFreshCutoff(call.where.publishedAt);
    });

    it('flags a healthy page as fresh, and a genuinely empty one too — no items just means no items', async () => {
      articles.findAndCount.mockResolvedValue([[article()], 1]);
      expect((await service.findAll({})).fresh).toBe(true);

      articles.findAndCount.mockResolvedValue([[], 0]);
      // ...but this is the empty case: no row cleared the freshness cutoff.
      expect((await service.findAll({})).fresh).toBe(false);
    });

    it('filters the query itself to the freshness window rather than trusting the caller', async () => {
      // The whole point: a table whose newest row is years old must not be
      // served as "news" just because nothing is left to filter it out.
      articles.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll({});

      const cutoff = articles.findAndCount.mock.calls[0][0].where.publishedAt.value;
      const daysAgo = (Date.now() - cutoff.getTime()) / (24 * 60 * 60 * 1000);
      expect(daysAgo).toBeCloseTo(NEWS_FRESH_WINDOW_DAYS, 1);
    });

    it('serves English when the requested locale has no translation row', async () => {
      articles.findAndCount.mockResolvedValue([[article()], 1]);
      translations.find.mockResolvedValue([]);

      const page = await service.findAll({ locale: 'te' });

      expect(page.data[0].title).toBe('MPEDA raises shrimp export target');
    });

    it('overlays the translation when one exists', async () => {
      articles.findAndCount.mockResolvedValue([[article()], 1]);
      translations.find.mockResolvedValue([
        { articleId: 'a1', locale: 'te', title: 'తెలుగు శీర్షిక', summary: null },
      ]);

      const page = await service.findAll({ locale: 'te' });

      expect(page.data[0].title).toBe('తెలుగు శీర్షిక');
      // A null field on the translation row falls back rather than blanking.
      expect(page.data[0].summary).toBe('Our summary.');
    });

    it('does not go looking for translations for English', async () => {
      articles.findAndCount.mockResolvedValue([[article()], 1]);

      await service.findAll({ locale: 'en' });

      expect(translations.find).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns a published article', async () => {
      articles.findOneBy.mockResolvedValue(article());
      await expect(service.findOne('a1')).resolves.toMatchObject({ id: 'a1' });
    });

    it('withholds an item still waiting on regulatory review, however it is reached', async () => {
      articles.findOneBy.mockResolvedValue(
        article({ status: 'pending_review' }),
      );
      await expect(service.findOne('a1')).resolves.toBeNull();
    });
  });

  describe('admin CRUD', () => {
    it('creates a hand-written article', async () => {
      const dto = { title: 'Upcheck update', content: 'We wrote this.' };
      await expect(service.create(dto)).resolves.toMatchObject(dto);
      expect(articles.save).toHaveBeenCalled();
    });

    it('updates and removes', async () => {
      articles.findOneBy.mockResolvedValue(article({ title: 'New' }));
      await expect(service.update('a1', { title: 'New' })).resolves.toMatchObject(
        { title: 'New' },
      );
      await expect(service.remove('a1')).resolves.toEqual({ affected: 1 });
    });
  });
});
