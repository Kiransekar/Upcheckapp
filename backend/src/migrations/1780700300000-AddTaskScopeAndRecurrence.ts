import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Personal vs farm scope, and recurrence as a template instead of a pre-baked
 * pile of rows.
 *
 *   - scope            : 'farm' (default, what every existing row is) |
 *                        'personal' — visible only to its creator
 *   - is_template      : true = a recurrence template. NEVER shown as a to-do;
 *                        dated instances are materialised from it on read.
 *   - recurrence_until : last date the series runs; NULL = forever
 *
 * Plus two integrity fixes the original tasks migrations skipped:
 *
 *   1. UQ_tasks_parent_due — unique (parent_task_id, due_date) where the parent
 *      is set. This is what makes lazy materialisation safe: two concurrent
 *      reads both try to create today's instance, one wins, the other gets a
 *      23505 and moves on. Without it a busy morning duplicates every task.
 *
 *      NOTE FOR THE OPERATOR: if this index fails to build, the existing
 *      eagerly-generated series contain duplicate (parent, due_date) pairs.
 *      That is a real data problem and the migration is right to stop rather
 *      than silently pick a survivor.
 *
 *   2. FK_tasks_parent — parent_task_id -> tasks(id) ON DELETE CASCADE. The
 *      column existed with no FK, so a deleted series origin left orphans
 *      pointing at nothing. TasksService.remove() detaches instances it wants
 *      to keep BEFORE deleting the origin, so completed history survives; the
 *      cascade is the backstop for everything else.
 *
 * The user-id columns (created_by_id, verified_by_id) stay un-FK'd. That is the
 * existing convention on this table and changing it is not this migration's job.
 */
export class AddTaskScopeAndRecurrence1780700300000
  implements MigrationInterface
{
  name = 'AddTaskScopeAndRecurrence1780700300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "scope" text NOT NULL DEFAULT 'farm'`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "is_template" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "recurrence_until" date`,
    );

    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_tasks_parent_due" ON "tasks" ("parent_task_id", "due_date") WHERE "parent_task_id" IS NOT NULL`,
    );

    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_tasks_parent') THEN
                    -- Any pre-existing row whose parent no longer exists would
                    -- block the constraint; clear those first.
                    UPDATE "tasks" t SET "parent_task_id" = NULL
                    WHERE t."parent_task_id" IS NOT NULL
                      AND NOT EXISTS (SELECT 1 FROM "tasks" p WHERE p."id" = t."parent_task_id");

                    ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_parent"
                        FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;
                END IF;
            END $$;
        `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_is_template" ON "tasks" ("is_template")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "FK_tasks_parent"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_tasks_parent_due"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_tasks_is_template"`);
    // Templates have no meaning without the column that marks them, and their
    // instances are reproducible from nothing — drop the templates, keep the
    // dated rows (which are indistinguishable from ordinary tasks).
    await queryRunner.query(`DELETE FROM "tasks" WHERE "is_template" = true`);
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "recurrence_until"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "is_template"`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN IF EXISTS "scope"`);
  }
}
