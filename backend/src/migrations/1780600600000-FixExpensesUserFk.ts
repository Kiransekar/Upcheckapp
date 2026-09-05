import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deleting a user was deleting their expense history.
 *
 * `expenses.user_id` is `NOT NULL` with `ON DELETE CASCADE` (re-added as
 * CASCADE at 1780287841640-AddInventoryNotes.ts:293 after being dropped at
 * :35). So removing a worker removed every expense they had ever recorded —
 * money data, gone, with no tombstone.
 *
 * The research spec asked only for SET NULL. That alone cannot apply while the
 * column is NOT NULL, so both change together.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class FixExpensesUserFk1780600600000 implements MigrationInterface {
  name = 'FixExpensesUserFk1780600600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expenses" ALTER COLUMN "user_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "FK_expenses_user_id"`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "expenses"
          ADD CONSTRAINT "FK_expenses_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Deliberately does NOT restore CASCADE. Reversing to a state that deletes
    // money on user removal is not a rollback anyone wants; the FK is simply
    // returned to no-action. Rows orphaned meanwhile keep a null user_id.
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "FK_expenses_user_id"`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "expenses"
          ADD CONSTRAINT "FK_expenses_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id");
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }
}
