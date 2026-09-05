import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Task } from './task.entity';

/**
 * Who a task is for.
 *
 * Shaped after `farm_member_ponds` — composite PK, both sides CASCADE, no
 * surrogate id, no timestamps.
 *
 * SEMANTICS, and it is the SAME inversion as `farm_member_ponds` (not the one
 * `inventory_farms` uses — read that file's comment before assuming):
 *   NO rows for a task = the task is for EVERYONE IN SCOPE. That is the whole
 *                        farm, or the whole pond when the task carries a
 *                        `pond_id`. It is the default and it is not a bug.
 *   one or more rows   = exactly those people, nobody else.
 *
 * So an empty `assigneeIds` on the wire means "everybody", never "nobody". Do
 * not "fix" a read path to return no tasks when the join table is empty; that
 * would hide every unassigned chore on the farm.
 */
@Entity('task_assignees')
@Index(['taskId'])
export class TaskAssignee {
  @PrimaryColumn({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => Task, (task) => task.assignees, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;
}
