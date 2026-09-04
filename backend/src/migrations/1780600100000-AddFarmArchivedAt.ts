import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Farms get what ponds already have: an `archived_at` column, so a farm that is
 * finished with can be put away without being deleted.
 *
 * `deleted_at` (the existing @DeleteDateColumn) is not the same thing — it is
 * the tombstone written by DELETE /farms/:id, and everything treats a
 * soft-deleted farm as gone (assertCanAccessFarm 404s on it). Archiving keeps
 * the farm fully readable and reversible; it only drops out of the default
 * listings.
 *
 * Additive, idempotent, reversible — same shape as
 * 1780301000000-AddFarmPlannedPondCount.
 */
export class AddFarmArchivedAt1780600100000 implements MigrationInterface {
  name = 'AddFarmArchivedAt1780600100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "farms" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "farms" DROP COLUMN IF EXISTS "archived_at"`,
    );
  }
}
