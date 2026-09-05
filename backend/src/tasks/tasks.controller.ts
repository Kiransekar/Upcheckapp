import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { OwnsResource } from '../common/decorators/owns-resource.decorator';
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  /**
   * The guard asks only for READ because the required capability depends on the
   * body: a personal task needs READ, a farm task needs WRITE_MANAGEMENT. The
   * decorator cannot see `scope`, so the real check is in the service — which is
   * also the only place that holds for non-HTTP callers.
   */
  @Post()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'farmId', 'userId', 'READ')
  create(@Body() createDto: CreateTaskDto, @CurrentUser() user) {
    return this.tasksService.create(createDto, user.id);
  }

  /**
   * Tasks across every farm the caller can read, in one request.
   *
   * Declared BEFORE `@Get(':id')` — Nest matches in declaration order, so a
   * later 'mine' would be swallowed as an id. No OwnershipGuard on purpose:
   * the guard checks one farm named by a param and this route names none;
   * scoping is `getAccessibleFarmIds` + `getAccessiblePondIds` in the service,
   * same as GET /ponds/mine.
   */
  @Get('mine')
  findMine(
    @CurrentUser() user,
    @Query('farmId') farmId?: string,
    @Query('status') status?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('scope') scope?: string,
    @Query('dueBefore') dueBefore?: string,
  ) {
    return this.tasksService.findMine(user.id, {
      farmId,
      status,
      assignedToId,
      scope,
      dueBefore,
    });
  }

  /** Recurrence templates, so a manager can edit or stop a daily task. */
  @Get('templates')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'farmId', 'userId', 'WRITE_MANAGEMENT')
  findTemplates(@Query('farmId') farmId: string, @CurrentUser() user) {
    return this.tasksService.findTemplates(user.id, farmId);
  }

  @Get()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'farmId', 'userId', 'READ')
  findAll(
    @CurrentUser() user,
    @Query('farmId') farmId: string,
    @Query('status') status?: string,
    @Query('assignedToId') assignedToId?: string,
    @Query('scope') scope?: string,
    @Query('dueBefore') dueBefore?: string,
  ) {
    return this.tasksService.findAll(user.id, {
      farmId,
      status,
      assignedToId,
      scope,
      dueBefore,
    });
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Task', 'id', 'farm.userId', 'READ')
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.tasksService.findOne(id, user.id);
  }

  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Task', 'id', 'farm.userId')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateTaskDto,
    @CurrentUser() user,
  ) {
    return this.tasksService.update(id, updateDto, user.id);
  }

  /**
   * `?series=true` also removes the template's future, unfinished instances.
   *
   * READ at the guard, OWNER_ONLY in the service — because a personal task is
   * its creator's to throw away, and the decorator cannot see the scope. Farm
   * tasks are still owner-only, exactly as before.
   */
  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Task', 'id', 'farm.userId', 'READ')
  remove(
    @Param('id') id: string,
    @CurrentUser() user,
    @Query('series') series?: string,
  ) {
    return this.tasksService.remove(id, user.id, series === 'true');
  }

  /** Worker marks their assigned task done (assignee-only enforced in service). */
  @Post(':id/complete')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Task', 'id', 'farm.userId', 'WRITE_OPERATIONAL')
  complete(@Param('id') id: string, @CurrentUser() user) {
    return this.tasksService.complete(id, user.id);
  }

  /** Manager/owner verifies a completed task. */
  @Post(':id/verify')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Task', 'id', 'farm.userId', 'WRITE_MANAGEMENT')
  verify(@Param('id') id: string, @CurrentUser() user) {
    return this.tasksService.verify(id, user.id);
  }
}
