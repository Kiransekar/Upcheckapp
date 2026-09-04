import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inventory: item icon, plus the adjustment reason we were throwing away.
 *
 * `icon` holds an MCI glyph name chosen in the icon picker (nullable — every
 * existing row keeps the category-derived default the list screen already
 * draws).
 *
 * `last_adjustment_reason` is the minimum honest home for `AdjustStockDto.reason`,
 * which was validated, sent by the client and then silently dropped. A full
 * `inventory_movements` ledger is Phase 3 (§5); until then the reason for the
 * most recent adjustment is at least recoverable instead of invented.
 *
 * NOTE the table is `inventory`, not `inventory_items` — the entity is
 * `@Entity('inventory')`.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddInventoryIcon1780600200000 implements MigrationInterface {
  name = 'AddInventoryIcon1780600200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "icon" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" ADD COLUMN IF NOT EXISTS "last_adjustment_reason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "inventory" DROP COLUMN IF EXISTS "last_adjustment_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" DROP COLUMN IF EXISTS "icon"`,
    );
  }
}
