import { Controller, Post, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/auth.decorators';
import { AdminKeyGuard } from '../feedback/admin-key.guard';
import { NewsIngestionService } from './news-ingestion.service';

/**
 * Lets an external scheduler drive ingestion, instead of relying solely on
 * `@Cron(EVERY_HOUR)` — see the boot-time-poll comment on
 * NewsIngestionService for why the cron alone was leaving the feed empty on
 * a Render free instance that sleeps and redeploys.
 *
 * `@Public()` removes the global JwtAuthGuard (there is no farmer JWT here)
 * and `AdminKeyGuard` replaces it with the shared `ADMIN_API_KEY` secret,
 * the same guard the staff feedback inbox uses — one shared-secret story
 * for server-to-server calls, not a second one invented for news.
 *
 * Safe to call repeatedly: `ingestSource`'s per-source Redis lock plus the
 * durable `last_fetched_at` column cap each source to one real poll an
 * hour regardless of how often this is hit, and the unique indexes on
 * `news_articles.canonical_url`/`dedupe_hash` make a duplicate insert a
 * no-op (caught as Postgres error 23505 in `persist`). A caller that fires
 * this every five minutes gets four no-op responses and one real poll.
 */
@Public()
@UseGuards(AdminKeyGuard)
@Controller('admin/news')
export class NewsAdminController {
  constructor(private readonly ingestion: NewsIngestionService) {}

  /** POST /admin/news/ingest, header `x-admin-key: <ADMIN_API_KEY>`. */
  @Post('ingest')
  async ingest() {
    const result = await this.ingestion.run();
    return {
      sources: result.sources.map((s) => ({
        source: s.name,
        fetched: s.fetched,
        inserted: s.persisted,
        skipped: s.filtered + s.deduped,
        error: s.error,
      })),
    };
  }
}
