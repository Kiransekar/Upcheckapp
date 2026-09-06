import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Let each invite decide whether it needs approving.
 *
 * `Farm.joinApproval` defaults to 'manual', so redeeming ANY code left the
 * joiner `pending` — holding nothing, seeing the brand-new-user state on Home,
 * and being told their valid code was wrong when they retyped it. That default
 * is what stranded workers.
 *
 * Default FALSE here, deliberately, and it is not the same decision as the
 * farm-level one. An invite code is already server-minted, expiring, revocable
 * and use-limited — it IS the credential. Requiring a second manual step on
 * top of it buys no security and costs the worker their first day. Owners who
 * want gatekeeping opt in per invite.
 *
 * `farm.joinApproval` continues to govern the open farm-code path unchanged.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddInviteRequiresApproval1780700600000
  implements MigrationInterface
{
  name = 'AddInviteRequiresApproval1780700600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "farm_invites" ADD COLUMN IF NOT EXISTS "requires_approval" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "farm_invites" DROP COLUMN IF EXISTS "requires_approval"`,
    );
  }
}
