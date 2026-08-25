import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive, idempotent migration: `farm_invites` — per-farm join credentials,
 * split out from `farms.farm_code`.
 *
 * `farm_code` was simultaneously the farm's public identity and its join
 * credential: anyone holding it got a `worker` membership with no approval, no
 * expiry, no revocation and no audit trail. This table makes the credential a
 * first-class object that can expire, be revoked, be usage-capped, and be
 * attributed to whoever issued it, while `farm_code` goes back to being just an
 * identifier.
 *
 * BACKFILL: one non-expiring, unlimited-use invite per existing farm carrying
 * that farm's current `farm_code`. Real farms have that string written on a
 * whiteboard and shared with real workers — silently invalidating it would lock
 * people out on deploy. Owners retire it deliberately via the rotate action.
 *
 * Reversible.
 */
export class CreateFarmInvites1780302200000 implements MigrationInterface {
  name = 'CreateFarmInvites1780302200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "farm_invites" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "farm_id" uuid NOT NULL,
                "code" character varying(8) NOT NULL,
                "role" character varying(20) NOT NULL DEFAULT 'worker',
                "created_by_id" uuid,
                "expires_at" timestamp with time zone,
                "max_uses" integer NOT NULL DEFAULT 1,
                "used_count" integer NOT NULL DEFAULT 0,
                "revoked_at" timestamp with time zone,
                "created_at" timestamp with time zone NOT NULL DEFAULT now(),
                CONSTRAINT "PK_farm_invites_id" PRIMARY KEY ("id")
            )
        `);

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_farm_invites_code" ON "farm_invites" ("code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_farm_invites_farm_id" ON "farm_invites" ("farm_id")`,
    );

    // Foreign keys (idempotent via guarded DO blocks).
    await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "farm_invites" ADD CONSTRAINT "FK_farm_invites_farm_id"
                    FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "farm_invites" ADD CONSTRAINT "FK_farm_invites_created_by_id"
                    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);

    // Backfill the currently-circulating codes so nobody is locked out.
    //   expires_at NULL  -> never expires
    //   max_uses   0     -> unlimited uses
    //   created_by_id    -> the farm's owner, so the audit trail is not blank
    // Only farms whose code is exactly the 8-char generated shape are carried
    // over: a code outside that shape can only have come from the old
    // client-supplied `farmCode` field (removed in the C2 fix) and is exactly
    // the low-entropy string this workstream exists to stop honouring.
    // Idempotent via the unique index on code.
    await queryRunner.query(`
            INSERT INTO "farm_invites"
                ("id", "farm_id", "code", "role", "created_by_id", "expires_at", "max_uses", "used_count", "created_at")
            SELECT uuid_generate_v4(), f."id", f."farm_code", 'worker', f."user_id", NULL, 0, 0, now()
            FROM "farms" f
            WHERE f."farm_code" IS NOT NULL
              AND f."farm_code" ~ '^[A-HJ-NP-Z2-9]{8}$'
            ON CONFLICT ("code") DO NOTHING
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "farm_invites"`);
  }
}
