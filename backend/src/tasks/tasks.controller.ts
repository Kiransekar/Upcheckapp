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

  @Post()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'farmId', 'userId', 'WRITE_MANAGEMENT')
  create(@Body() createDto: CreateTaskDto, @CurrentUser() user) {
    return this.tasksService.create(createDto, user?.id);
  }

  /**
   * Tasks across every farm the caller can read, in one request.
   *
   * Declared BEFORE `@Get(':id')` — Nest matches in declaration order, so a
   * later 'mine' would be swallowed as an id. No OwnershipGuard on purpose:
   * the guard checks one farm named by a param and this route names none;
   * scoping is `getAccessibleFarmIds` in the service, same as GET /ponds/mine.
   */
  @Get('mine')
  findMine(
    @CurrentUser() user,
    @Query('status') status?: string,
    @Query('assignedToId') assignedToId?: string,
  ) {
    return this.tasksService.findMine(user.id, { status, assignedToId });
  }

  @Get()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'farmId', 'userId', 'READ')
  findAll(
    @Query('farmId') farmId: string,
    @Query('status') status?: string,
    @Query('assignedToId') assignedToId?: string,
  ) {
    return this.tasksService.findAll({ farmId, status, assignedToId });
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Task', 'id', 'farm.userId', 'READ')
  findOne(@Param('id') id: string) {
    return this.tasksService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Task', 'id', 'farm.userId')
  update(@Param('id') id: string, @Body() updateDto: UpdateTaskDto) {
    return this.tasksService.update(id, updateDto);
  }

  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Task', 'id', 'farm.userId', 'OWNER_ONLY')
  remove(@Param('id') id: string) {
    return this.tasksService.remove(id);
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
