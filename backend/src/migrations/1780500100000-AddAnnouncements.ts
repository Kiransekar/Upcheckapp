import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "What's new" announcements: a card the app shows on open, authored from
 * the admin dashboard, localized into up to six languages, dismissible
 * per-user so closing it on one phone does not resurrect it on another.
 *
 * Three tables, same shape as feedback (owner-only, RLS on with no policy —
 * the backend connects as the table owner and bypasses RLS) and news
 * (English on the row, other locales in a translation sidecar). Additive,
 * idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddAnnouncements1780500100000 implements MigrationInterface {
  name = 'AddAnnouncements1780500100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying(64) NOT NULL,
        "category" character varying(16) NOT NULL,
        "title" text NOT NULL,
        "body" text NOT NULL,
        "is_published" boolean NOT NULL DEFAULT false,
        "published_at" timestamp with time zone,
        "priority" integer NOT NULL DEFAULT 0,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_announcements" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_announcements_key" UNIQUE ("key")
      )
    `);
    // The query the app runs on every open: published cards, priority order.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_announcements_published_priority"
        ON "announcements" ("is_published", "priority", "published_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcement_translations" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "announcement_id" uuid NOT NULL,
        "locale" character varying(8) NOT NULL,
        "title" text,
        "body" text,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_announcement_translations" PRIMARY KEY ("id"),
        CONSTRAINT "FK_announcement_translations_announcement" FOREIGN KEY ("announcement_id")
          REFERENCES "announcements"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_announcement_translations_announcement_locale"
        ON "announcement_translations" ("announcement_id", "locale")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "announcement_dismissals" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "announcement_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "dismissed_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_announcement_dismissals" PRIMARY KEY ("id"),
        CONSTRAINT "FK_announcement_dismissals_announcement" FOREIGN KEY ("announcement_id")
          REFERENCES "announcements"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_announcement_dismissals_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_announcement_dismissals_announcement_user"
        ON "announcement_dismissals" ("announcement_id", "user_id")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_announcement_dismissals_user"
        ON "announcement_dismissals" ("user_id")
    `);

    // RLS on, with no policy — the anon key must never read these tables
    // directly; the backend connects as the table owner and bypasses RLS.
    // ENABLE, not FORCE, so the owner connection is not locked out too.
    for (const table of [
      'announcements',
      'announcement_translations',
      'announcement_dismissals',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "announcement_dismissals"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "announcement_translations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "announcements"`);
  }
}
