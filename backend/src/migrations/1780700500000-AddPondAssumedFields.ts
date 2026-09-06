import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Record which pond measurements the APP filled in, not the farmer.
 *
 * Onboarding creates ponds without asking for shape, construction type or
 * dimensions — it hardcodes `irregular` / `earthen` and leaves area unmeasured,
 * because a measurement questionnaire is the wrong thing to put in front of
 * someone who has not seen the app yet. That is a reasonable trade, but the
 * result was indistinguishable from an answer the farmer actually gave: the
 * pond page rendered "Earthen" and an area with the same confidence as a
 * surveyed figure, and volume, aeration adequacy and every dosing calculation
 * downstream read those numbers.
 *
 * So the assumption is recorded rather than hidden. A field listed here is
 * shown as unconfirmed and prompts to be completed; confirming it removes it
 * from the list. Empty array (the default, and what every pre-existing row
 * gets) means "nothing assumed" — the honest answer for ponds created through
 * the full form.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddPondAssumedFields1780700500000 implements MigrationInterface {
  name = 'AddPondAssumedFields1780700500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ponds" ADD COLUMN IF NOT EXISTS "assumed_fields" text[] NOT NULL DEFAULT '{}'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "ponds" DROP COLUMN IF EXISTS "assumed_fields"`,
    );
  }
}
