import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive, idempotent migration for three related capabilities:
 *
 * 1. `farm_members.status` ('active' | 'pending') — the "waiting to be let in"
 *    queue. Someone who redeems a farm code lands as `pending`, which grants
 *    NOTHING until an owner (or manager, per the farm's setting) approves.
 *    Defaults to 'active' so every existing membership keeps working untouched.
 *
 * 2. `farms.join_approval` ('manual' | 'auto') and `farms.join_approver`
 *    ('owner' | 'managers') — the per-farm join policy. `manual` is the default
 *    because the code is shareable and the owner should decide who actually
 *    gets in; `managers` matches MANAGE_WORKERS, which already lets managers
 *    add and remove members, so defaulting to owner-only would silently take
 *    away something farms already delegate.
 *
 * 3. `farm_members.can_view_financials` (nullable boolean) — the per-farm cost
 *    visibility grant that `farm-capability.ts` has always described in a
 *    comment but nothing implemented. NULL means "use the role default", so
 *    every existing row keeps exactly today's behaviour.
 *
 * All four columns are added IF NOT EXISTS with defaults, so this is safe to
 * run against a live database and safe to re-run. Reversible.
 */
export class AddJoinApprovalAndFinancialGrant1780302300000
  implements MigrationInterface
{
  name = 'AddJoinApprovalAndFinancialGrant1780302300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "farm_members"
                ADD COLUMN IF NOT EXISTS "status" character varying(20) NOT NULL DEFAULT 'active'
        `);
    await queryRunner.query(`
            ALTER TABLE "farm_members"
                ADD COLUMN IF NOT EXISTS "can_view_financials" boolean
        `);
    await queryRunner.query(`
            ALTER TABLE "farms"
                ADD COLUMN IF NOT EXISTS "join_approval" character varying(10) NOT NULL DEFAULT 'manual'
        `);
    await queryRunner.query(`
            ALTER TABLE "farms"
                ADD COLUMN IF NOT EXISTS "join_approver" character varying(10) NOT NULL DEFAULT 'managers'
        `);

    // The members screen lists the pending queue per farm; every capability
    // check filters on status. Index the pair rather than status alone, which
    // would be almost entirely 'active' and useless as a filter.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_farm_members_farm_status" ON "farm_members" ("farm_id", "status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_farm_members_farm_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "farms" DROP COLUMN IF EXISTS "join_approver"`,
    );
    await queryRunner.query(
      `ALTER TABLE "farms" DROP COLUMN IF EXISTS "join_approval"`,
    );
    await queryRunner.query(
      `ALTER TABLE "farm_members" DROP COLUMN IF EXISTS "can_view_financials"`,
    );
    await queryRunner.query(
      `ALTER TABLE "farm_members" DROP COLUMN IF EXISTS "status"`,
    );
  }
}
