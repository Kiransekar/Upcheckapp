import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Permissions per role, plus a per-member exception.
 *
 * The model was a fixed 6-key capability × role matrix with exactly ONE
 * per-member escape hatch, `farm_members.can_view_financials`. An owner could
 * not say "my workers may record harvests" or "this one worker may not see
 * costs" — the shape simply could not hold it.
 *
 * Two nullable jsonb columns generalise it: `farms.role_policy` is the per-farm
 * default per role, `farm_members.capability_overrides` is the per-member
 * exception. Resolution (roleSatisfies) reads override → policy → matrix.
 *
 * The old boolean is backfilled and then left alone — kept for one release so a
 * rollback to the previous deploy still honours existing grants. Nothing reads
 * it after this migration; it is dropped in Phase 3.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddCapabilityPolicies1780500200000 implements MigrationInterface {
  name = 'AddCapabilityPolicies1780500200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "role_policy" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "farm_members" ADD COLUMN IF NOT EXISTS "capability_overrides" jsonb`,
    );
    // Carry every existing financial grant forward verbatim. Re-runnable: the
    // IS NULL guard means a second run cannot clobber an override an owner has
    // since edited through the new screen.
    await queryRunner.query(`
      UPDATE "farm_members"
         SET "capability_overrides" = jsonb_build_object('VIEW_FINANCIALS', "can_view_financials")
       WHERE "can_view_financials" IS NOT NULL
         AND "capability_overrides" IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "farm_members" DROP COLUMN IF EXISTS "capability_overrides"`,
    );
    await queryRunner.query(
      `ALTER TABLE "farms" DROP COLUMN IF EXISTS "role_policy"`,
    );
  }
}
