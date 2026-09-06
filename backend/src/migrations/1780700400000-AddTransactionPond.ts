import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Let a money row name the pond it belongs to.
 *
 * The Money tab's "Add entry" wrote a farm-level row with no pond, while the
 * pond Expenses tab wrote a pond-level row with no route into the Money list.
 * Now that both ledgers are merged into one entry list, a transaction that
 * cannot say which pond it came from is the odd one out — and "what did this
 * pond cost me" cannot include it.
 *
 * Nullable on purpose: a farm-level cost (a licence fee, a shared generator)
 * genuinely belongs to no single pond, and every existing row is one.
 *
 * SET NULL, never CASCADE: deleting a pond must not delete the record of
 * having spent money on it.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddTransactionPond1780700400000 implements MigrationInterface {
  name = 'AddTransactionPond1780700400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "pond_id" uuid`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "transactions"
          ADD CONSTRAINT "FK_transactions_pond"
          FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_pond"
        ON "transactions" ("pond_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "pond_id"`,
    );
  }
}
