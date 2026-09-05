import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  In,
  IsNull,
  LessThanOrEqual,
  Repository,
} from 'typeorm';
import { Task } from './task.entity';
import { TaskAssignee } from './task-assignee.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FarmAccessService } from '../farm-access/farm-access.service';
import { buildRecurrenceRule, dueDatesFor, isoDate } from './recurrence';

/** How far back a read will backfill a template's missing instances. */
export const MATERIALISE_WINDOW_DAYS = 7;

const DONE_STATUSES = ['done', 'verified'];

export interface TaskFilters {
  farmId?: string;
  status?: string;
  assignedToId?: string;
  scope?: string;
  dueBefore?: string;
}

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    @InjectRepository(TaskAssignee)
    private assigneesRepository: Repository<TaskAssignee>,
    private readonly farmAccess: FarmAccessService,
  ) {}

  // ==================== create ====================

  async create(createDto: CreateTaskDto, createdById: string) {
    const { recurrence, assigneeIds, scope: rawScope, ...base } = createDto;
    const scope = rawScope ?? 'farm';

    // Capability is scope-dependent, so it cannot live in the route decorator:
    // the route asks for READ and this escalates. A personal note is something
    // any member may keep; the shared board is management's.
    if (scope === 'personal') {
      await this.farmAccess.assertCanAccessFarm(
        createdById,
        base.farmId,
        'READ',
      );
      if (
        assigneeIds &&
        !(assigneeIds.length === 1 && assigneeIds[0] === createdById)
      ) {
        throw new BadRequestException(
          'A personal task can only ever be assigned to its creator',
        );
      }
    } else {
      await this.farmAccess.assertCanAccessFarm(
        createdById,
        base.farmId,
        'WRITE_MANAGEMENT',
      );
    }

    if (base.pondId) {
      const pond = await this.farmAccess.assertCanAccessPond(
        createdById,
        base.pondId,
        scope === 'personal' ? 'READ' : 'WRITE_MANAGEMENT',
      );
      if (pond.farmId !== base.farmId) {
        throw new BadRequestException('That pond is not on that farm');
      }
    }

    // Personal tasks are assigned to their creator, always and only.
    const finalAssignees =
      scope === 'personal' ? [createdById] : (assigneeIds ?? []);
    if (scope === 'farm') {
      await this.assertAssignable(
        base.farmId,
        base.pondId ?? null,
        finalAssignees,
      );
    }

    const record = await this.tasksRepository.save(
      this.tasksRepository.create({
        ...base,
        scope,
        createdById,
        isTemplate: !!recurrence,
        recurrenceRule: recurrence ? buildRecurrenceRule(recurrence) : null,
        recurrenceUntil: recurrence?.until ?? null,
        completedAt: base.status === 'done' ? new Date() : null,
      }),
    );

    await this.setAssignees(record.id, finalAssignees);
    return this.decorate(record, finalAssignees);
  }

  /**
   * Every assignee must be an ACTIVE member of the farm, and — when the task is
   * pinned to a pond — must be able to reach that pond. Rejects the whole
   * request rather than dropping the offending id: silently assigning a task to
   * three of the four people you named is how a feed gets missed.
   */
  private async assertAssignable(
    farmId: string,
    pondId: string | null,
    userIds: string[],
  ): Promise<void> {
    for (const userId of userIds) {
      const role = await this.farmAccess.getRoleOnFarm(userId, farmId);
      if (!role) {
        throw new BadRequestException(
          `User ${userId} is not an active member of this farm`,
        );
      }
      if (pondId) {
        const ponds = await this.farmAccess.getAccessiblePondIds(
          userId,
          farmId,
          'READ',
        );
        if (!ponds.includes(pondId)) {
          throw new BadRequestException(
            `User ${userId} does not have access to this pond`,
          );
        }
      }
    }
  }

  private async setAssignees(taskId: string, userIds: string[]) {
    await this.assigneesRepository.delete({ taskId });
    if (userIds.length) {
      await this.assigneesRepository.insert(
        [...new Set(userIds)].map((userId) => ({ taskId, userId })),
      );
    }
  }

  // ==================== read ====================

  /**
   * The one place task visibility is decided. Everything that lists tasks goes
   * through here.
   *
   * Three OR'd branches, and the middle one is the security fix: `pond_id`
   * existed on this table from day one but nothing ever filtered on it, so a
   * worker scoped to ponds 1 and 4 was served — and could act on — the tasks
   * for every other pond on the farm. `getAccessiblePondIds` is the same
   * resolver EngineAlertService uses.
   *
   *   1. farm-scope tasks with no pond   → any member of the farm
   *   2. farm-scope tasks with a pond    → only if that pond is in scope
   *   3. personal tasks                  → only their creator, nobody else
   *
   * Templates are excluded everywhere: they are not to-dos.
   */
  private async findVisible(
    userId: string,
    filters: TaskFilters = {},
  ): Promise<Task[]> {
    const accessible = await this.farmAccess.getAccessibleFarmIds(userId);
    const farmIds = filters.farmId
      ? accessible.filter((id) => id === filters.farmId)
      : accessible;
    if (farmIds.length === 0) return [];

    const pondIds = (
      await Promise.all(
        farmIds.map((farmId) =>
          this.farmAccess.getAccessiblePondIds(userId, farmId, 'READ'),
        ),
      )
    ).flat();

    await this.materialise(farmIds);

    const common: FindOptionsWhere<Task> = {
      farmId: In(farmIds),
      isTemplate: false,
    };
    if (filters.status) common.status = filters.status;
    if (filters.dueBefore) common.dueDate = LessThanOrEqual(filters.dueBefore);

    let where: FindOptionsWhere<Task>[] = [
      { ...common, scope: 'farm', pondId: IsNull() },
      // An empty pond scope must produce NO branch, not `IN ()`.
      ...(pondIds.length
        ? [{ ...common, scope: 'farm', pondId: In(pondIds) }]
        : []),
      { ...common, scope: 'personal', createdById: userId },
    ];
    if (filters.scope) {
      where = where.filter((w) => w.scope === filters.scope);
      if (where.length === 0) return [];
    }

    const rows = await this.tasksRepository.find({
      where,
      relations: ['assignees'],
      order: { status: 'ASC', dueDate: 'ASC', createdAt: 'DESC' },
    });

    const filtered = filters.assignedToId
      ? rows.filter((t) =>
          (t.assignees ?? []).some((a) => a.userId === filters.assignedToId),
        )
      : rows;
    return filtered.map((t) => this.decorate(t));
  }

  findAll(userId: string, filters: TaskFilters = {}) {
    return this.findVisible(userId, filters);
  }

  /**
   * Tasks across ALL the caller's farms — or one of them, when `farmId` is
   * given. Returns `Task[]`, unchanged in shape, because `/team/overview`
   * embeds it directly.
   *
   * "Mine" is: assigned to me, OR assigned to nobody (which means everyone in
   * scope — see TaskAssignee). Personal tasks arrive via the visibility filter,
   * which already restricts them to their creator.
   */
  async findMine(userId: string, filters: TaskFilters = {}) {
    const visible = await this.findVisible(userId, filters);
    return visible.filter(
      (t) =>
        (t.assigneeIds ?? []).length === 0 ||
        (t.assigneeIds ?? []).includes(userId),
    );
  }

  /** The recurrence templates on a farm, so a manager can edit or stop one. */
  async findTemplates(userId: string, farmId: string) {
    await this.farmAccess.assertCanAccessFarm(
      userId,
      farmId,
      'WRITE_MANAGEMENT',
    );
    const rows = await this.tasksRepository.find({
      where: { farmId, isTemplate: true },
      relations: ['assignees'],
      order: { createdAt: 'DESC' },
    });
    return rows.map((t) => this.decorate(t));
  }

  async findOne(id: string, userId?: string): Promise<Task> {
    const record = await this.tasksRepository.findOne({
      where: { id },
      relations: ['assignees'],
    });
    if (!record) throw new NotFoundException(`Task with ID ${id} not found`);
    if (userId) await this.assertVisible(record, userId);
    return this.decorate(record);
  }

  /**
   * Single-task visibility, mirroring findVisible's three branches. The route
   * guard only ever checks the FARM, so without this a pond-scoped worker could
   * read (and complete) any task on the farm by id.
   */
  private async assertVisible(task: Task, userId: string): Promise<void> {
    if (task.scope === 'personal' && task.createdById !== userId) {
      throw new ForbiddenException('This task is private to its creator');
    }
    await this.farmAccess.assertCanAccessFarm(userId, task.farmId, 'READ');
    if (task.pondId) {
      await this.farmAccess.assertCanAccessPond(userId, task.pondId, 'READ');
    }
  }

  // ==================== recurrence ====================

  /**
   * Create the instances each active template owes, up to today.
   *
   * There is no scheduler in this backend — the only cron in the repo is news
   * ingestion — so this runs on read. It is idempotent through the unique index
   * on (parent_task_id, due_date): two concurrent reads race, one inserts, the
   * other catches 23505 and carries on.
   *
   * `isTemplate` is what identifies a template, NOT `parentTaskId`. Series made
   * by the old eager code have `parent_task_id` set (the first row points at
   * itself) and `is_template = false`, so they are never re-materialised — they
   * stay exactly the ordinary dated tasks they already are.
   *
   * ponytail: bounded to MATERIALISE_WINDOW_DAYS of backfill per template per
   * call. If a farm ever needs deeper history, that is a real cron job, not a
   * bigger loop here.
   */
  private async materialise(farmIds: string[]): Promise<void> {
    const today = isoDate();
    const templates = await this.tasksRepository.find({
      where: { farmId: In(farmIds), isTemplate: true },
      relations: ['assignees'],
    });

    for (const template of templates) {
      if (template.status === 'cancelled') continue;
      if (template.recurrenceUntil && template.recurrenceUntil < today) continue;

      const dates = dueDatesFor({
        rule: template.recurrenceRule,
        startedOn: template.dueDate ?? isoDate(new Date(template.createdAt)),
        until: template.recurrenceUntil,
        today,
        windowDays: MATERIALISE_WINDOW_DAYS,
      });
      if (dates.length === 0) continue;

      const existing = await this.tasksRepository.find({
        where: { parentTaskId: template.id, dueDate: In(dates) },
        select: { id: true, dueDate: true },
      });
      const have = new Set(existing.map((t) => t.dueDate));

      for (const dueDate of dates) {
        if (have.has(dueDate)) continue;
        await this.createInstance(template, dueDate);
      }
    }
  }

  private async createInstance(template: Task, dueDate: string) {
    try {
      const instance = await this.tasksRepository.save(
        this.tasksRepository.create({
          farmId: template.farmId,
          pondId: template.pondId,
          cropId: template.cropId,
          title: template.title,
          description: template.description,
          type: template.type,
          priority: template.priority,
          scope: template.scope,
          timeWindowStart: template.timeWindowStart,
          timeWindowEnd: template.timeWindowEnd,
          createdById: template.createdById,
          recurrenceRule: template.recurrenceRule,
          parentTaskId: template.id,
          isTemplate: false,
          status: 'open',
          dueDate,
        }),
      );
      await this.setAssignees(
        instance.id,
        (template.assignees ?? []).map((a) => a.userId),
      );
    } catch (err: any) {
      // 23505 = another request materialised the same day first. That is the
      // unique index doing its job, not an error.
      if ((err?.code ?? err?.driverError?.code) !== '23505') throw err;
    }
  }

  // ==================== write ====================

  async update(
    id: string,
    updateDto: UpdateTaskDto,
    userId: string,
  ): Promise<Task> {
    const existing = await this.findOne(id, userId);
    const { recurrence, assigneeIds, ...patch } = updateDto as any;

    // A template's rule is a management decision, not an edit anyone can make.
    if (existing.isTemplate || recurrence) {
      await this.farmAccess.assertCanAccessFarm(
        userId,
        existing.farmId,
        'WRITE_MANAGEMENT',
      );
    }

    // THE HOLE THIS CLOSES: `complete()` checks the caller is the assignee, but
    // update() used to write `status` straight through — so anyone with
    // WRITE_OPERATIONAL could tick off someone else's task by PATCHing it.
    // Route both status transitions through the same checks the dedicated
    // endpoints use, in the service, where every caller passes.
    if (patch.status && patch.status !== existing.status) {
      if (patch.status === 'done') {
        await this.assertCanComplete(existing, userId);
      }
      if (patch.status === 'verified') {
        await this.farmAccess.assertCanAccessFarm(
          userId,
          existing.farmId,
          'WRITE_MANAGEMENT',
        );
      }
      patch.completedAt = patch.status === 'done' ? new Date() : null;
    }

    if (recurrence) {
      patch.recurrenceRule = buildRecurrenceRule(recurrence);
      patch.recurrenceUntil = recurrence.until ?? null;
    }

    if (assigneeIds) {
      if (existing.scope === 'personal') {
        throw new BadRequestException(
          'A personal task can only ever be assigned to its creator',
        );
      }
      await this.farmAccess.assertCanAccessFarm(
        userId,
        existing.farmId,
        'WRITE_MANAGEMENT',
      );
      const pondId = patch.pondId ?? existing.pondId ?? null;
      await this.assertAssignable(existing.farmId, pondId, assigneeIds);
      await this.setAssignees(id, assigneeIds);
    }

    if (Object.keys(patch).length) {
      await this.tasksRepository.update(id, patch);
    }
    return this.findOne(id, userId);
  }

  /**
   * Who may tick a task off. Assigned to specific people → only those people.
   * Assigned to nobody (= everyone in scope) → anyone who can write on the farm.
   */
  private async assertCanComplete(task: Task, userId: string): Promise<void> {
    const assignees = task.assigneeIds ?? [];
    if (assignees.length > 0) {
      if (!assignees.includes(userId)) {
        throw new ForbiddenException(
          'Only an assigned worker can complete this task',
        );
      }
      return;
    }
    await this.farmAccess.assertCanAccessFarm(
      userId,
      task.farmId,
      'WRITE_OPERATIONAL',
    );
  }

  async complete(id: string, userId: string): Promise<Task> {
    const task = await this.findOne(id, userId);
    await this.assertCanComplete(task, userId);
    await this.tasksRepository.update(id, {
      status: 'done',
      completedAt: new Date(),
    });
    return this.findOne(id, userId);
  }

  /** Manager/owner verifies a completed task (blueprint §17.4). */
  async verify(id: string, userId: string): Promise<Task> {
    const task = await this.findOne(id, userId);
    // The route guard already asks for WRITE_MANAGEMENT; re-asserting here is
    // what makes the rule true for every caller, not just the HTTP one.
    await this.farmAccess.assertCanAccessFarm(
      userId,
      task.farmId,
      'WRITE_MANAGEMENT',
    );
    await this.tasksRepository.update(id, {
      status: 'verified',
      verifiedAt: new Date(),
      verifiedById: userId,
    });
    return this.findOne(id, userId);
  }

  /**
   * `series` deletes a template AND its future, not-yet-completed instances.
   *
   * Completed history always survives, which is why the children are detached
   * before the parent goes: `parent_task_id` is now ON DELETE CASCADE, so
   * deleting a series origin would otherwise erase the record of every day it
   * was actually done.
   */
  async remove(
    id: string,
    userId: string,
    series = false,
  ): Promise<{ message: string }> {
    const task = await this.findOne(id, userId);

    // A personal task belongs to its creator; a farm task to the farm's owner.
    if (task.scope !== 'personal') {
      await this.farmAccess.assertCanAccessFarm(
        userId,
        task.farmId,
        'OWNER_ONLY',
      );
    }

    if (series) {
      const children = await this.tasksRepository.find({
        where: { parentTaskId: id },
        select: { id: true, status: true },
      });
      const disposable = children
        .filter((c) => c.id !== id && !DONE_STATUSES.includes(c.status))
        .map((c) => c.id);
      if (disposable.length) {
        await this.tasksRepository.delete({ id: In(disposable) });
      }
    }

    await this.tasksRepository.update(
      { parentTaskId: id },
      { parentTaskId: null },
    );
    await this.tasksRepository.delete(id);
    return { message: 'Task deleted successfully' };
  }

  // ==================== shaping ====================

  /** Flatten the join rows onto `assigneeIds` and drop the raw relation. */
  private decorate(task: Task, ids?: string[]): Task {
    task.assigneeIds = ids ?? (task.assignees ?? []).map((a) => a.userId);
    delete (task as { assignees?: unknown }).assignees;
    return task;
  }
}
