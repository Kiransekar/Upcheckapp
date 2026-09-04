import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tie a money row to the inventory item it bought.
 *
 * `transactions.category` is free text with no enum or check constraint, so
 * category 'inventory' needs no migration — only the item link does.
 *
 * SET NULL, never CASCADE: deleting an inventory item must not delete the
 * record of having paid for it.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddTransactionInventoryItem1780600500000 implements MigrationInterface {
  name = 'AddTransactionInventoryItem1780600500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "inventory_item_id" uuid`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "transactions"
          ADD CONSTRAINT "FK_transactions_inventory_item"
          FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_inventory_item"
        ON "transactions" ("inventory_item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "inventory_item_id"`,
    );
  }
}
