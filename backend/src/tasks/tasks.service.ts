import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Task } from './task.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { FarmAccessService } from '../farm-access/farm-access.service';

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private tasksRepository: Repository<Task>,
    private readonly farmAccess: FarmAccessService,
  ) {}

  async create(createDto: CreateTaskDto, createdById?: string) {
    // recurrenceFreq/Count are inputs, not columns — peel them off.
    const { recurrenceFreq, recurrenceCount, ...base } = createDto;
    const common = { ...base, createdById: createdById ?? null };

    // Non-recurring (or missing a start date) → a single task.
    if (!recurrenceFreq || !recurrenceCount || !base.dueDate) {
      const record = this.tasksRepository.create({
        ...common,
        completedAt: base.status === 'done' ? new Date() : null,
      });
      return this.tasksRepository.save(record);
    }

    // Recurring → generate dated instances; the first is the series parent
    // and every instance carries the rule + parentTaskId for edit/cancel.
    const rule = `FREQ=${recurrenceFreq.toUpperCase()};COUNT=${recurrenceCount}`;
    const stepDays = recurrenceFreq === 'weekly' ? 7 : 1;
    const start = new Date(`${base.dueDate}T00:00:00Z`);

    return this.tasksRepository.manager.transaction(async (mgr) => {
      const parent = await mgr.save(
        mgr.create(Task, { ...common, recurrenceRule: rule }),
      );
      parent.parentTaskId = parent.id;
      await mgr.save(parent);

      for (let i = 1; i < recurrenceCount; i++) {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() + i * stepDays);
        await mgr.save(
          mgr.create(Task, {
            ...common,
            dueDate: d.toISOString().slice(0, 10),
            recurrenceRule: rule,
            parentTaskId: parent.id,
          }),
        );
      }
      return parent;
    });
  }

  findAll(
    filters: { farmId?: string; status?: string; assignedToId?: string } = {},
  ) {
    const where: Record<string, string> = {};
    if (filters.farmId) where.farmId = filters.farmId;
    if (filters.status) where.status = filters.status;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    return this.tasksRepository.find({
      where,
      order: { status: 'ASC', dueDate: 'ASC', createdAt: 'DESC' },
    });
  }

  /**
   * Tasks across ALL the caller's farms.
   *
   * `GET /tasks` is guarded by `@OwnsResource('Farm', 'farmId', …)`, so a
   * client wanting "my tasks" had to call it once per farm. This scopes by
   * `getAccessibleFarmIds` instead — same convention as `GET /ponds/mine` —
   * which is also why it needs no route guard: a non-member's farm list is
   * empty, so the query is empty.
   */
  async findMine(
    userId: string,
    filters: { status?: string; assignedToId?: string } = {},
  ) {
    const farmIds = await this.farmAccess.getAccessibleFarmIds(userId);
    if (farmIds.length === 0) return [];

    const where: Record<string, unknown> = { farmId: In(farmIds) };
    if (filters.status) where.status = filters.status;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    return this.tasksRepository.find({
      where,
      order: { status: 'ASC', dueDate: 'ASC', createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Task> {
    const record = await this.tasksRepository.findOneBy({ id });
    if (!record) throw new NotFoundException(`Task with ID ${id} not found`);
    return record;
  }

  async update(id: string, updateDto: UpdateTaskDto): Promise<Task> {
    const existing = await this.findOne(id);
    // Drop non-column inputs before persisting.
    const { recurrenceFreq, recurrenceCount, ...patch } = updateDto as any;
    // Maintain completedAt in lockstep with status transitions.
    if (updateDto.status && updateDto.status !== existing.status) {
      patch.completedAt = updateDto.status === 'done' ? new Date() : null;
    }
    await this.tasksRepository.update(id, patch);
    return this.findOne(id);
  }

  /**
   * Worker marks a task done. If the task is assigned, only the assignee may
   * complete it (blueprint §28.5); unassigned tasks any writer may complete.
   */
  async complete(id: string, userId: string): Promise<Task> {
    const task = await this.findOne(id);
    if (task.assignedToId && task.assignedToId !== userId) {
      throw new ForbiddenException(
        'Only the assigned worker can complete this task',
      );
    }
    await this.tasksRepository.update(id, {
      status: 'done',
      completedAt: new Date(),
    });
    return this.findOne(id);
  }

  /** Manager/owner verifies a completed task (blueprint §17.4). */
  async verify(id: string, userId: string): Promise<Task> {
    await this.findOne(id);
    await this.tasksRepository.update(id, {
      status: 'verified',
      verifiedAt: new Date(),
      verifiedById: userId,
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ message: string }> {
    await this.findOne(id);
    await this.tasksRepository.delete(id);
    return { message: 'Task deleted successfully' };
  }
}
