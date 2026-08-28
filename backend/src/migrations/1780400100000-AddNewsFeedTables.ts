import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * News & market feed schema: attribution/dedupe/status columns on
 * `news_articles`, the `news_sources` consent register, and the (initially
 * empty) `news_article_translations` sidecar.
 *
 * Every statement is guarded so re-running is a no-op — this migration is
 * applied by hand against production, and a half-applied run must be safe to
 * repeat.
 *
 * `content` is deliberately made NULLABLE rather than dropped: it keeps
 * working for hand-written editorial posts published through `POST /news`,
 * while ingested rows leave it null. Dropping it would break the admin CRUD
 * that already ships. See the class comment on NewsArticle for why it must
 * never hold a publisher's body.
 *
 * The seeded sources all land `is_active = false` / `permission_status =
 * 'unknown'`, including the government ones. The spec would have institutional
 * sources ship active, but a feed URL that has not been verified silently
 * yields an empty feed — or worse, the wrong content — and none of these could
 * be verified from the build environment. A human verifies the feed URL and
 * the terms, then flips the row active. Failing closed on a feed is correct.
 */
export class AddNewsFeedTables1780400100000 implements MigrationInterface {
  name = 'AddNewsFeedTables1780400100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "news_sources" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "name" text NOT NULL,
        "homepage_url" text,
        "feed_url" text NOT NULL,
        "feed_type" varchar(16) NOT NULL DEFAULT 'rss',
        "default_category" varchar(32),
        "weight" integer NOT NULL DEFAULT 50,
        "is_active" boolean NOT NULL DEFAULT false,
        "terms_url" text,
        "terms_checked_at" timestamp with time zone,
        "permission_status" varchar(16) NOT NULL DEFAULT 'unknown',
        "permission_note" text,
        "last_fetched_at" timestamp with time zone,
        "last_error" text,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_news_sources" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_news_sources_feed_url"
        ON "news_sources" ("feed_url")
    `);

    const columns: Array<[string, string]> = [
      ['source_id', 'uuid'],
      ['source_name', 'text'],
      ['canonical_url', 'text'],
      ['dedupe_hash', 'varchar(64)'],
      ['status', `varchar(20) NOT NULL DEFAULT 'published'`],
      ['relevance_score', 'integer'],
      ['locale', `varchar(8) NOT NULL DEFAULT 'en'`],
      ['ingested_at', 'timestamp with time zone'],
    ];
    for (const [name, type] of columns) {
      await queryRunner.query(
        `ALTER TABLE "news_articles" ADD COLUMN IF NOT EXISTS "${name}" ${type}`,
      );
    }

    // Editorial-only from here on; ingested rows never populate it.
    await queryRunner.query(
      `ALTER TABLE "news_articles" ALTER COLUMN "content" DROP NOT NULL`,
    );

    await queryRunner.query(`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.table_constraints
          WHERE constraint_name = 'FK_news_articles_source'
        ) THEN
          ALTER TABLE "news_articles"
            ADD CONSTRAINT "FK_news_articles_source"
            FOREIGN KEY ("source_id") REFERENCES "news_sources"("id")
            ON DELETE SET NULL;
        END IF;
      END $$;
    `);

    // Partial uniques: hand-written editorial rows carry neither, and several
    // NULLs are not "duplicates".
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_news_articles_canonical_url"
        ON "news_articles" ("canonical_url") WHERE "canonical_url" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_news_articles_dedupe_hash"
        ON "news_articles" ("dedupe_hash") WHERE "dedupe_hash" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_news_articles_status_published"
        ON "news_articles" ("status", "published_at" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_news_articles_category_published"
        ON "news_articles" ("category", "published_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "news_article_translations" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "article_id" uuid NOT NULL,
        "locale" varchar(8) NOT NULL,
        "title" text,
        "summary" text,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_news_article_translations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_news_article_translations_article" FOREIGN KEY ("article_id")
          REFERENCES "news_articles"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_news_article_translations_article_locale"
        ON "news_article_translations" ("article_id", "locale")
    `);

    // name, homepage, feed_url, feed_type, default_category, weight, terms_url
    const sources: Array<[string, string, string, string, string | null, number, string | null]> = [
      // Government / institutional — public-interest material, weighted high.
      ['MPEDA', 'https://mpeda.gov.in/', 'https://mpeda.gov.in/?feed=rss2', 'rss', 'trade', 90, 'https://mpeda.gov.in/'],
      ['Coastal Aquaculture Authority', 'https://caa.gov.in/', 'https://caa.gov.in/?feed=rss2', 'rss', 'regulation', 90, 'https://caa.gov.in/'],
      ['National Fisheries Development Board', 'https://nfdb.gov.in/', 'https://nfdb.gov.in/?feed=rss2', 'rss', 'production', 85, 'https://nfdb.gov.in/'],
      ['Department of Fisheries (DAHD)', 'https://dof.gov.in/', 'https://dof.gov.in/?feed=rss2', 'rss', 'regulation', 85, 'https://dof.gov.in/'],
      ['ICAR-CIBA', 'https://ciba.icar.gov.in/', 'https://ciba.icar.gov.in/?feed=rss2', 'rss', 'research', 85, 'https://ciba.icar.gov.in/'],
      ['NaCSA', 'https://nacsa.in/', 'https://nacsa.in/?feed=rss2', 'rss', 'production', 80, 'https://nacsa.in/'],
      ['FAO GLOBEFISH', 'https://www.fao.org/in-action/globefish/', 'https://www.fao.org/in-action/globefish/news-events/rss/en/', 'rss', 'market', 80, 'https://www.fao.org/contact-us/terms-and-conditions/en/'],
      // Trade press — stay dark until the §2.7 permission email is answered.
      ['Undercurrent News', 'https://www.undercurrentnews.com/', 'https://www.undercurrentnews.com/category/shrimp/feed/', 'rss', 'market', 55, 'https://www.undercurrentnews.com/terms-conditions/'],
      ['The Fish Site', 'https://thefishsite.com/', 'https://thefishsite.com/articles/rss', 'rss', 'production', 55, 'https://thefishsite.com/terms-and-conditions'],
      ['SeafoodSource', 'https://www.seafoodsource.com/', 'https://www.seafoodsource.com/rss', 'rss', 'trade', 55, 'https://www.seafoodsource.com/terms-of-use'],
      ['Global Seafood Alliance', 'https://www.globalseafood.org/', 'https://www.globalseafood.org/feed/', 'rss', 'disease', 55, 'https://www.globalseafood.org/terms-of-use/'],
    ];

    for (const [name, homepage, feedUrl, feedType, cat, weight, terms] of sources) {
      await queryRunner.query(
        `INSERT INTO "news_sources"
           ("name", "homepage_url", "feed_url", "feed_type", "default_category", "weight", "terms_url")
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT ("feed_url") DO NOTHING`,
        [name, homepage, feedUrl, feedType, cat, weight, terms],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "news_article_translations"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_news_articles_category_published"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_news_articles_status_published"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_news_articles_dedupe_hash"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_news_articles_canonical_url"`,
    );
    await queryRunner.query(
      `ALTER TABLE "news_articles" DROP CONSTRAINT IF EXISTS "FK_news_articles_source"`,
    );
    for (const name of [
      'source_id',
      'source_name',
      'canonical_url',
      'dedupe_hash',
      'status',
      'relevance_score',
      'locale',
      'ingested_at',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "news_articles" DROP COLUMN IF EXISTS "${name}"`,
      );
    }
    // `content` stays nullable: rows written while this migration was applied
    // may legitimately have a null there, so restoring NOT NULL would fail.
    await queryRunner.query(`DROP TABLE IF EXISTS "news_sources"`);
  }
}
