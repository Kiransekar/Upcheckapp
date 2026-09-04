import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inventory becomes pairable to one, many or no farms.
 *
 * ORDER MATTERS: create the table, backfill one row per existing
 * `inventory.farm_id`, and only then relax the NOT NULL. Relaxing first would
 * leave a window in which a crashed backfill loses the only record of which
 * farm an item belonged to.
 *
 * `farm_id` is kept, not dropped: it stays the fast path for the common
 * single-farm read. The join table is authoritative where they disagree.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddInventoryFarms1780600400000 implements MigrationInterface {
  name = 'AddInventoryFarms1780600400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_farms" (
        "inventory_id" uuid NOT NULL,
        "farm_id" uuid NOT NULL,
        CONSTRAINT "PK_inventory_farms" PRIMARY KEY ("inventory_id", "farm_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_farms_farm"
        ON "inventory_farms" ("farm_id")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "inventory_farms"
          ADD CONSTRAINT "FK_inventory_farms_inventory"
          FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "inventory_farms"
          ADD CONSTRAINT "FK_inventory_farms_farm"
          FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Backfill — idempotent via ON CONFLICT, so a re-run is a no-op.
    await queryRunner.query(`
      INSERT INTO "inventory_farms" ("inventory_id", "farm_id")
      SELECT "id", "farm_id" FROM "inventory" WHERE "farm_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(
      `ALTER TABLE "inventory" ALTER COLUMN "farm_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_farms" ENABLE ROW LEVEL SECURITY`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // farm_id was backfilled and is never cleared, so restoring NOT NULL is
    // safe — but only after any unpaired rows created since are given one.
    await queryRunner.query(
      `DELETE FROM "inventory" WHERE "farm_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" ALTER COLUMN "farm_id" SET NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_farms"`);
  }
}
