import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Additive, idempotent migration: `farm_member_ponds` — pond-level scoping.
 *
 * Membership was farm-level only, so on a 20-pond farm every worker could see
 * and write to every pond, and the schema could not express "Ravi looks after
 * ponds 1, 4 and 7" at all.
 *
 * NO BACKFILL IS NEEDED, by design. The semantics are:
 *   no rows for a membership = access to ALL ponds on that farm
 *   one or more rows         = restricted to exactly those ponds
 * so an empty table means every existing membership keeps precisely the reach
 * it has today, and scoping is opt-in per member.
 *
 * Composite primary key on (farm_member_id, pond_id) — the pair is the fact,
 * and it doubles as the uniqueness constraint, so assigning the same pond twice
 * is impossible rather than merely discouraged.
 *
 * Reversible.
 */
export class CreateFarmMemberPonds1780302400000 implements MigrationInterface {
  name = 'CreateFarmMemberPonds1780302400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "farm_member_ponds" (
                "farm_member_id" uuid NOT NULL,
                "pond_id" uuid NOT NULL,
                CONSTRAINT "PK_farm_member_ponds" PRIMARY KEY ("farm_member_id", "pond_id")
            )
        `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_farm_member_ponds_member" ON "farm_member_ponds" ("farm_member_id")`,
    );

    // CASCADE on both sides: removing a member, or deleting a pond, should take
    // the scoping rows with it rather than leaving a dangling restriction that
    // silently narrows someone's access to a pond that no longer exists.
    await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "farm_member_ponds" ADD CONSTRAINT "FK_farm_member_ponds_member"
                    FOREIGN KEY ("farm_member_id") REFERENCES "farm_members"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);
    await queryRunner.query(`
            DO $$ BEGIN
                ALTER TABLE "farm_member_ponds" ADD CONSTRAINT "FK_farm_member_ponds_pond"
                    FOREIGN KEY ("pond_id") REFERENCES "ponds"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
            EXCEPTION WHEN duplicate_object THEN NULL; END $$;
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "farm_member_ponds"`);
  }
}
