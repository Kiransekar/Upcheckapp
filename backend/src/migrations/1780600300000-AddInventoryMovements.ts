import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The stock ledger the single `last_adjustment_reason` column was standing in for.
 *
 * Today every adjustment overwrites one text column, and the feed pipeline
 * writes four literals into it — 'Feed log', 'Feed log failed', 'Feed log
 * edited', 'Feed log deleted'. After the fact a deduction, its compensating
 * credit, an edit and a delete are indistinguishable, with no quantity and no
 * actor retained. This table keeps all four.
 *
 * `last_adjustment_reason` is deliberately NOT dropped — it is one column, it
 * costs nothing, and InventoryDetailScreen still reads it.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddInventoryMovements1780600300000 implements MigrationInterface {
  name = 'AddInventoryMovements1780600300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inventory_id" uuid NOT NULL,
        "delta" numeric NOT NULL,
        "reason" text,
        "created_by_id" uuid,
        "feed_record_id" uuid,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_movements" PRIMARY KEY ("id")
      )
    `);
    // The query the detail screen runs: one item's history, newest first.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_movements_item_created"
        ON "inventory_movements" ("inventory_id", "created_at" DESC)
    `);

    // Actor and feed link are SET NULL, never CASCADE: deleting a user or a
    // feed record must not erase the record that the stock moved.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "inventory_movements"
          ADD CONSTRAINT "FK_inventory_movements_inventory"
          FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "inventory_movements"
          ADD CONSTRAINT "FK_inventory_movements_user"
          FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_movements"`);
  }
}
