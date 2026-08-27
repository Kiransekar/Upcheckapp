import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive, idempotent migration: farmer feedback / issue reports.
 *
 * A direct line from the app to the team, so a farmer with a problem does not
 * have to leave a one-star Play Store review to be heard. One table; images
 * live in Supabase Storage and only their object paths are stored here.
 *
 * `user_id` CASCADEs — a deleted account's reports go with it (the account
 * deletion flow already promises "all data you own"). `farm_id` SET NULLs:
 * deleting a farm must not delete the complaint about it.
 *
 * Reversible.
 */
export class AddFeedbackReports1780400000000 implements MigrationInterface {
  name = 'AddFeedbackReports1780400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "feedback_reports" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "farm_id" uuid,
                "category" character varying(32) NOT NULL,
                "subject" character varying(160),
                "message" text NOT NULL,
                "attachment_paths" jsonb NOT NULL DEFAULT '[]',
                "status" character varying(32) NOT NULL DEFAULT 'new',
                "admin_response" text,
                "responded_at" timestamp with time zone,
                "responded_by" character varying(120),
                "created_at" timestamp with time zone NOT NULL DEFAULT now(),
                "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_feedback_reports" PRIMARY KEY ("id")
            )
        `);
    // The two queries this table actually serves: "my reports, newest first"
    // in the app, and "the inbox, filtered by status" in the dashboard.
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_feedback_reports_user_id"
                ON "feedback_reports" ("user_id", "created_at" DESC)
        `);
    await queryRunner.query(`
            CREATE INDEX IF NOT EXISTS "IDX_feedback_reports_status"
                ON "feedback_reports" ("status", "created_at" DESC)
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "feedback_reports" ADD CONSTRAINT "FK_feedback_reports_user_id"
                    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "feedback_reports" ADD CONSTRAINT "FK_feedback_reports_farm_id"
                    FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);

    /**
     * RLS on, with no policy.
     *
     * Every other table in this schema is RLS-locked (SEC-1) because the app
     * ships a Supabase anon key that can reach PostgREST directly. The backend
     * connects as the table owner and bypasses RLS; leaving it off here would
     * publish every farmer's report — and their photos' paths — to anyone
     * holding the public anon key. No policy is needed: nothing but the
     * backend is supposed to read this table.
     *
     * ENABLE, never FORCE — the backend connects as the table owner, and FORCE
     * would apply the (empty) policy set to the owner too and lock the API out
     * of its own table.
     */
    await queryRunner.query(
      `ALTER TABLE "feedback_reports" ENABLE ROW LEVEL SECURITY`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "feedback_reports"`);
  }
}
