import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import axios from 'axios';
import Parser from 'rss-parser';
import { NewsArticle } from './news-article.entity';
import { NewsSource } from './news-source.entity';
import { RedisService } from '../redis/redis.service';
import {
  classify,
  dedupeHash,
  initialStatus,
  MAX_SUMMARY_CHARS,
  RELEVANCE_THRESHOLD,
  scoreRelevance,
} from './feed-rules';

/** §2.6 — identify honestly, with a contact address, and poll gently. */
const USER_AGENT = 'UpcheckBot/1.0 (+https://upcheck.in/bot; bot@upcheck.in)';
const FETCH_TIMEOUT_MS = 10_000;
const FETCH_ATTEMPTS = 3;

/**
 * §2.6 — at most one poll per source per hour, enforced on the durable
 * `news_sources.last_fetched_at` column and not on the Redis lock alone:
 * RedisService falls back to a PER-PROCESS in-memory Map when Redis is
 * unreachable (which it regularly is in production), so a restart empties the
 * lock and the next run re-polls every publisher. 55 minutes to match the TTL.
 */
const MIN_POLL_INTERVAL_MS = 55 * 60 * 1000;

/** A misconfigured feed must not be able to insert ten thousand rows. */
const MAX_ITEMS_PER_RUN = 200;

/**
 * Fields an RSS library will happily hand us that contain the PUBLISHER'S
 * prose. None of them may ever reach a persisted row — see the legal-boundary
 * comment on NewsArticle. Checked by name on the object about to be saved, so
 * this keeps working if someone later widens the normalizer.
 */
const PUBLISHER_BODY_KEYS = [
  'content',
  'contentSnippet',
  'content:encoded',
  'description',
  'body',
  'fullText',
  'articleBody',
];

/** What a feed item becomes once stripped down to what we may keep. */
export interface NormalizedItem {
  title: string;
  canonicalUrl: string;
  publishedAt: Date;
  dedupeHash: string;
  category: string;
  relevanceScore: number;
}

export interface IngestionStats {
  fetched: number;
  filtered: number;
  deduped: number;
  persisted: number;
  failed: number;
}

const emptyStats = (): IngestionStats => ({
  fetched: 0,
  filtered: 0,
  deduped: 0,
  persisted: 0,
  failed: 0,
});

@Injectable()
export class NewsIngestionService implements OnApplicationBootstrap {
  private readonly logger = new Logger(NewsIngestionService.name);
  private readonly parser = new Parser();

  constructor(
    @InjectRepository(NewsArticle)
    private readonly articles: Repository<NewsArticle>,
    @InjectRepository(NewsSource)
    private readonly sources: Repository<NewsSource>,
    private readonly redis: RedisService,
  ) {}

  /**
   * Poll once as soon as the app is up, not only on the next top-of-hour tick.
   *
   * `EVERY_HOUR` fires at minute :00 and nowhere else, while this service runs
   * on a Render free instance that sleeps when idle and redeploys on every
   * master commit. A process can therefore live its entire life between two
   * ticks and ingest nothing — which is exactly how the feed shipped empty.
   * The per-source hourly guard in `ingestSource` is what stops this from
   * re-polling publishers on every restart, so it stays inside §2.6.
   *
   * Deliberately not awaited: ingestion must never hold up the boot, and
   * `runScheduled` already swallows its own failures.
   */
  onApplicationBootstrap(): void {
    void this.runScheduled();
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runScheduled(): Promise<void> {
    try {
      await this.run();
    } catch (err) {
      this.logger.error(`News ingestion run failed: ${(err as Error).message}`);
    }
  }

  /**
   * Poll every active source. One dead feed must never fail the run — a source
   * that throws records `last_error` and the next source is still polled.
   */
  async run(): Promise<IngestionStats> {
    let sources: NewsSource[];
    try {
      sources = await this.sources.find({
        where: { isActive: true, feedType: In(['rss', 'atom']) },
      });
    } catch (err) {
      const code = (err as any)?.code ?? (err as any)?.driverError?.code;
      if (code !== '42P01') throw err;
      this.logger.warn('news_sources missing — run migrations; skipping run');
      return emptyStats();
    }

    const total = emptyStats();
    for (const source of sources) {
      const stats = await this.ingestSource(source);
      for (const k of Object.keys(total) as (keyof IngestionStats)[]) {
        total[k] += stats[k];
      }
      if (total.fetched >= MAX_ITEMS_PER_RUN) break;
    }
    // Without this you cannot tell "the feeds are quiet" from "the parser broke".
    this.logger.log(
      `News ingestion: ${sources.length} sources, fetched=${total.fetched} ` +
        `filtered=${total.filtered} deduped=${total.deduped} ` +
        `persisted=${total.persisted} failed=${total.failed}`,
    );
    return total;
  }

  async ingestSource(source: NewsSource): Promise<IngestionStats> {
    const stats = emptyStats();

    // §2.6, durably: this column survives the restarts and Redis outages that
    // the lock below does not. Checked first because it costs no I/O.
    if (this.polledWithinTheHour(source)) {
      this.logger.debug(`Skipping ${source.name} — polled within the hour`);
      return stats;
    }

    // Per-source lock so two dynos don't double-fetch, and so §2.6's one poll
    // per source per hour holds even if the cron fires twice.
    // ponytail: get-then-set, not an atomic SETNX — RedisService exposes no NX
    // and the unique indexes on canonical_url/dedupe_hash are what actually
    // prevent duplicate rows. Swap for SET NX if a race is ever observed.
    const lockKey = `news:ingest:${source.id}`;
    if (await this.redis.get(lockKey)) {
      this.logger.debug(`Skipping ${source.name} — polled within the hour`);
      return stats;
    }
    await this.redis.set(lockKey, '1', 'EX', 55 * 60);

    let items: unknown[];
    try {
      items = await this.fetchFeed(source);
    } catch (err) {
      stats.failed += 1;
      await this.recordError(source, (err as Error).message);
      return stats;
    }

    stats.fetched = items.length;
    const normalized: NormalizedItem[] = [];
    for (const raw of items.slice(0, MAX_ITEMS_PER_RUN)) {
      const item = this.normalize(raw, source);
      if (!item) {
        stats.filtered += 1;
        continue;
      }
      normalized.push(item);
    }

    const fresh = await this.rejectKnown(normalized);
    stats.deduped = normalized.length - fresh.length;
    stats.persisted = await this.persist(fresh, source);

    await this.sources.update(source.id, {
      lastFetchedAt: new Date(),
      lastError: null,
    });
    return stats;
  }

  /** Fetch with our own User-Agent and timeout, retrying with backoff. */
  private async fetchFeed(source: NewsSource): Promise<unknown[]> {
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= FETCH_ATTEMPTS; attempt++) {
      try {
        const res = await axios.get<string>(source.feedUrl, {
          timeout: FETCH_TIMEOUT_MS,
          responseType: 'text',
          headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml' },
        });
        const feed = await this.parser.parseString(res.data);
        return feed.items ?? [];
      } catch (err) {
        lastError = err as Error;
        if (attempt < FETCH_ATTEMPTS) {
          await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)));
        }
      }
    }
    throw lastError ?? new Error('feed fetch failed');
  }

  /**
   * Feed item → the handful of fields we are allowed to keep, or null if the
   * item is unusable or not relevant enough.
   *
   * This is the ONLY place a raw feed item is read, and it copies fields out
   * by name rather than spreading — the publisher's body is never carried
   * forward, so there is nothing downstream to accidentally persist.
   */
  normalize(raw: unknown, source: NewsSource): NormalizedItem | null {
    const item = (raw ?? {}) as Record<string, any>;
    const title = String(item.title ?? '').trim();
    const canonicalUrl = String(item.link ?? item.guid ?? '').trim();
    // §2.3/§2.5: an item with no headline or nowhere to link to cannot be
    // attributed, so it cannot be shown. Failing closed is correct.
    if (!title || !/^https?:\/\//i.test(canonicalUrl)) return null;

    const published = new Date(item.isoDate ?? item.pubDate ?? Date.now());
    const publishedAt = Number.isNaN(published.getTime())
      ? new Date()
      : published;

    // The feed's own snippet is scored and then dropped on the floor with the
    // rest of `item`. It informs the decision; it is never stored.
    const scoringText = `${title} ${item.contentSnippet ?? ''}`;
    const relevanceScore = scoreRelevance(scoringText, source.weight);
    if (relevanceScore < RELEVANCE_THRESHOLD) return null;

    return {
      title,
      canonicalUrl,
      publishedAt,
      dedupeHash: dedupeHash(title, publishedAt),
      category: classify(scoringText, source.defaultCategory),
      relevanceScore,
    };
  }

  /** Drop items we already have, and near-duplicates within this batch. */
  private async rejectKnown(items: NormalizedItem[]): Promise<NormalizedItem[]> {
    const seen = new Set<string>();
    const batch = items.filter((i) => {
      if (seen.has(i.dedupeHash) || seen.has(i.canonicalUrl)) return false;
      seen.add(i.dedupeHash);
      seen.add(i.canonicalUrl);
      return true;
    });
    if (batch.length === 0) return batch;

    const existing = await this.articles.find({
      select: { dedupeHash: true, canonicalUrl: true },
      where: [
        { dedupeHash: In(batch.map((i) => i.dedupeHash)) },
        { canonicalUrl: In(batch.map((i) => i.canonicalUrl)) },
      ],
    });
    const known = new Set(
      existing.flatMap((e) => [e.dedupeHash, e.canonicalUrl].filter(Boolean)),
    );
    return batch.filter(
      (i) => !known.has(i.dedupeHash) && !known.has(i.canonicalUrl),
    );
  }

  private async persist(
    items: NormalizedItem[],
    source: NewsSource,
  ): Promise<number> {
    let persisted = 0;
    for (const item of items) {
      const row: Partial<NewsArticle> = {
        title: item.title,
        // No summary yet: writing one is a separate, human-or-model step, and
        // §2.2 forbids reusing the publisher's. Until then the item shows as a
        // headline plus attribution, which is exactly what we are allowed to
        // show. A summarisation failure must never lose the item.
        summary: null as unknown as string,
        content: null,
        imageUrl: null as unknown as string,
        category: item.category,
        publishedAt: item.publishedAt,
        canonicalUrl: item.canonicalUrl,
        dedupeHash: item.dedupeHash,
        relevanceScore: item.relevanceScore,
        sourceId: source.id,
        sourceName: source.name,
        status: initialStatus(item.category as any),
        locale: 'en',
        isActive: true,
        ingestedAt: new Date(),
      };
      this.assertPersistable(row);
      try {
        await this.articles.save(this.articles.create(row));
        persisted += 1;
      } catch (err) {
        // Unique violation on canonical_url/dedupe_hash: another dyno won the
        // race. That is the index doing its job, not a failure.
        const code = (err as any)?.code ?? (err as any)?.driverError?.code;
        if (code !== '23505') throw err;
      }
    }
    return persisted;
  }

  /**
   * The §2.1 guard: refuse to write a row that carries a publisher's body, or
   * a summary longer than we are allowed to show.
   *
   * Deliberately a throw and not a log. Silently dropping the field would let
   * a future refactor reintroduce legal exposure and pass its own tests; a
   * loud failure gets noticed.
   */
  assertPersistable(row: Record<string, any>): void {
    const leaked = PUBLISHER_BODY_KEYS.filter(
      (k) => typeof row[k] === 'string' && row[k].trim().length > 0,
    );
    if (leaked.length > 0) {
      throw new Error(
        `Refusing to persist a publisher's article body on news_articles: ${leaked.join(', ')}`,
      );
    }
    if (
      typeof row.summary === 'string' &&
      row.summary.length > MAX_SUMMARY_CHARS
    ) {
      throw new Error(
        `News summary exceeds ${MAX_SUMMARY_CHARS} characters (${row.summary.length})`,
      );
    }
  }

  /** Whether §2.6's one-poll-per-hour budget for this source is already spent. */
  private polledWithinTheHour(source: NewsSource): boolean {
    if (!source.lastFetchedAt) return false;
    const last = new Date(source.lastFetchedAt).getTime();
    if (Number.isNaN(last)) return false;
    return Date.now() - last < MIN_POLL_INTERVAL_MS;
  }

  private async recordError(source: NewsSource, message: string) {
    this.logger.warn(`Feed ${source.name} failed: ${message}`);
    await this.sources
      // `last_fetched_at` records when we last POLLED, not when we last
      // succeeded — otherwise a feed that 403s is re-polled on every boot,
      // which is precisely the hammering §2.6 forbids.
      .update(source.id, {
        lastFetchedAt: new Date(),
        lastError: message.slice(0, 500),
      })
      .catch(() => undefined);
  }
}
