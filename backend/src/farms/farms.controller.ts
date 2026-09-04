import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { OwnsResource } from '../common/decorators/owns-resource.decorator';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { FarmsService } from './farms.service';
import { CreateFarmDto } from './dto/create-farm.dto';
import { UpdateFarmDto } from './dto/update-farm.dto';
import { RolePolicyDto } from './dto/role-policy.dto';
@Controller('farms')
export class FarmsController {
  constructor(private readonly farmsService: FarmsService) {}

  @Post()
  create(@Body() createFarmDto: CreateFarmDto, @CurrentUser() user) {
    // Anyone may create a farm; the creator becomes its `owner` in
    // farm_members. The old `user.accountType === 'worker'` gate is gone —
    // it was the only authorization decision anywhere that read the global
    // account flag, and it never actually held: `account_type` lived in
    // client-mutable Supabase user_metadata (see the removed POST
    // /auth/supabase/update). It also contradicted the per-farm role model —
    // a "worker" account could hold `manager` on a farm, or be handed full
    // ownership via transferOwnership, while still being blocked from
    // creating one of its own.
    //
    // Do NOT reintroduce this at farm level either (e.g. "only owner-type
    // accounts may receive ownership transfer"). The membership row's `role`
    // is the single answer to every "may they?" question.
    return this.farmsService.create(createFarmDto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user, @Query('includeArchived') includeArchived?: string) {
    return this.farmsService.findAll(user.id, includeArchived === 'true');
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'id', 'userId', 'READ')
  findOne(@Param('id') id: string) {
    return this.farmsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'id', 'userId', 'OWNER_ONLY')
  update(@Param('id') id: string, @Body() updateFarmDto: UpdateFarmDto) {
    return this.farmsService.update(id, updateFarmDto);
  }

  /**
   * Archive / unarchive — the reversible half of farm lifecycle. Owner only;
   * the service asserts it again (see setRolePolicy).
   */
  @Patch(':id/archive')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'id', 'userId', 'OWNER_ONLY')
  archive(@Param('id') id: string, @CurrentUser() user) {
    return this.farmsService.archive(id, user.id);
  }

  @Patch(':id/unarchive')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'id', 'userId', 'OWNER_ONLY')
  unarchive(@Param('id') id: string, @CurrentUser() user) {
    return this.farmsService.unarchive(id, user.id);
  }

  /**
   * Hard-ish delete (soft tombstone). Refuses a farm with crop history —
   * mirrors DELETE /ponds/:id. Archive is the action for a farm that has been
   * used.
   */
  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'id', 'userId', 'OWNER_ONLY')
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.farmsService.remove(id, user.id);
  }

  /**
   * Per-role capability defaults for this farm — "my workers may record
   * harvests". Owner only; the service asserts it again, because the guard is
   * a declaration and the service is the enforcement.
   */
  @Patch(':id/role-policy')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Farm', 'id', 'userId', 'OWNER_ONLY')
  setRolePolicy(
    @Param('id') id: string,
    @Body() dto: RolePolicyDto,
    @CurrentUser() user,
  ) {
    return this.farmsService.setRolePolicy(id, user.id, dto.policy ?? null);
  }
}
