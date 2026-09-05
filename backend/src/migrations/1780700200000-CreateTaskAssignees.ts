import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Multiple assignees per task.
 *
 * `tasks.assigned_to_id` was a single nullable uuid, so "Ravi AND Kumar do the
 * 6am feed" could not be expressed at all. This replaces it with a join table
 * shaped exactly like `farm_member_ponds` / `inventory_farms` — composite PK,
 * both sides CASCADE, no surrogate id, no timestamps.
 *
 * SEMANTICS (see the comment on TaskAssignee — same inversion as
 * `farm_member_ponds`, and the opposite of `inventory_farms`):
 *   NO rows for a task = the task is for EVERYONE in scope (the whole farm, or
 *                        the whole pond when `pond_id` is set)
 *   one or more rows   = exactly those people
 *
 * ROLLBACK IS LOSSY, DELIBERATELY. `down()` restores `assigned_to_id` and
 * writes back ONE assignee per task (the lowest user_id, chosen only because it
 * is deterministic). A task with two or more assignees loses all but one on
 * rollback — there is nowhere to put them in the old schema. That data loss is
 * accepted; the alternative is refusing to roll back at all.
 */
export class CreateTaskAssignees1780700200000 implements MigrationInterface {
  name = 'CreateTaskAssignees1780700200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "task_assignees" (
                "task_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                CONSTRAINT "PK_task_assignees" PRIMARY KEY ("task_id", "user_id")
            )
        `);

    await queryRunner.query(`
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_task_assignees_task') THEN
                    ALTER TABLE "task_assignees" ADD CONSTRAINT "FK_task_assignees_task"
                        FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_task_assignees_user') THEN
                    ALTER TABLE "task_assignees" ADD CONSTRAINT "FK_task_assignees_user"
                        FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
                END IF;
            END $$;
        `);

    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_assignees_task_id" ON "task_assignees" ("task_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_task_assignees_user_id" ON "task_assignees" ("user_id")`,
    );

    // Backfill every existing assignment. The EXISTS guard is load-bearing:
    // `assigned_to_id` had no FK, so it can hold an id whose user row is gone —
    // and the new column DOES have one, which would fail the insert.
    await queryRunner.query(`
            INSERT INTO "task_assignees" ("task_id", "user_id")
            SELECT t."id", t."assigned_to_id"
            FROM "tasks" t
            WHERE t."assigned_to_id" IS NOT NULL
              AND EXISTS (SELECT 1 FROM "users" u WHERE u."id" = t."assigned_to_id")
            ON CONFLICT DO NOTHING
        `);

    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_tasks_assigned_to_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP COLUMN IF EXISTS "assigned_to_id"`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "assigned_to_id" uuid`,
    );
    // One assignee survives per task — see the class comment.
    await queryRunner.query(`
            UPDATE "tasks" t
            SET "assigned_to_id" = (
                SELECT MIN(a."user_id"::text)::uuid
                FROM "task_assignees" a
                WHERE a."task_id" = t."id"
            )
        `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_tasks_assigned_to_id" ON "tasks" ("assigned_to_id")`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "task_assignees"`);
  }
}
