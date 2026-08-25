import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive, idempotent migration: farm owner recovery (W5, Option B).
 *
 * `farms.user_id` is single-valued and `transferOwnership` requires the CURRENT
 * owner to act, so a lost owner account leaves the farm with no way back in.
 * These two columns add a nominated recovery contact plus a claim clock:
 *
 *   recovery_contact_id       — the member who may claim ownership. NULL means
 *                               recovery is not set up, which is every existing
 *                               farm, so nothing changes for them.
 *   recovery_claim_started_at — when they asked. The claim only completes after
 *                               a waiting period, so a lost phone cannot become
 *                               an instant silent takeover.
 *
 * ON DELETE SET NULL: if the nominee's account is deleted the farm falls back
 * to having no recovery contact rather than pointing at a dead user.
 *
 * Reversible.
 */
export class AddFarmRecoveryContact1780302500000 implements MigrationInterface {
  name = 'AddFarmRecoveryContact1780302500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "farms"
                ADD COLUMN IF NOT EXISTS "recovery_contact_id" uuid
        `);
    await queryRunner.query(`
            ALTER TABLE "farms"
                ADD COLUMN IF NOT EXISTS "recovery_claim_started_at" timestamp with time zone
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "farms" ADD CONSTRAINT "FK_farms_recovery_contact_id"
                    FOREIGN KEY ("recovery_contact_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "farms" DROP CONSTRAINT IF EXISTS "FK_farms_recovery_contact_id"
        `);
    await queryRunner.query(`
            ALTER TABLE "farms" DROP COLUMN IF EXISTS "recovery_claim_started_at"
        `);
    await queryRunner.query(`
            ALTER TABLE "farms" DROP COLUMN IF EXISTS "recovery_contact_id"
        `);
  }
}
