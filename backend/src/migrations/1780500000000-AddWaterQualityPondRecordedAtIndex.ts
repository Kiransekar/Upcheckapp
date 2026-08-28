import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `water_quality_records` is read as
 *   WHERE pond_id = ? ORDER BY recorded_at DESC LIMIT 60
 * (pond-context.service getContext, which runs for EVERY pond on the home
 * screen). The only index on the table is `pond_id` alone, so Postgres has to
 * read every record the pond has ever had and sort it just to keep the newest
 * 60. That cost grows with the pond's whole history, on the hottest read path
 * in the app.
 *
 * A composite `(pond_id, recorded_at DESC)` lets it walk straight to the 60 in
 * order and stop.
 *
 * The existing single-column `pond_id` index is left in place: this one
 * subsumes it for lookups, but it is still declared by the entity's `@Index()`
 * and recreated by earlier migrations, and one redundant index on a table this
 * write-light is cheaper than a schema disagreement.
 *
 * Additive, idempotent, reversible — mirrors
 * 1780301700000-AddFeedingTrayChecksCropIdIndex. An unapplied index changes no
 * results, only latency, so no read needs an isMissingTable-style guard for it.
 */
export class AddWaterQualityPondRecordedAtIndex1780500000000
  implements MigrationInterface
{
  name = 'AddWaterQualityPondRecordedAtIndex1780500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_water_quality_records_pond_id_recorded_at" ON "water_quality_records" ("pond_id", "recorded_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_water_quality_records_pond_id_recorded_at"`,
    );
  }
}
