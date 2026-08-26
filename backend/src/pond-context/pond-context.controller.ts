import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { OwnsResource } from '../common/decorators/owns-resource.decorator';
import { PondContextService } from './pond-context.service';

/**
 * Latest-input snapshot for a pond — engines prefill from this instead of
 * re-asking the farmer for data already logged (PRD "capture once, reuse").
 */
@Controller('pond-context')
export class PondContextController {
  constructor(private readonly service: PondContextService) {}

  /**
   * Every readable pond on a farm, in one request.
   *
   * No OwnershipGuard here on purpose: the guard checks ONE resource named by a
   * route param, and this route names a farm while returning ponds. Access is
   * enforced a layer down — getFarmContexts resolves the caller's accessible
   * pond ids first and each snapshot still goes through the per-pond READ
   * check. A non-member simply gets [].
   */
  @Get()
  getForFarm(@Query('farmId') farmId: string, @CurrentUser() user) {
    if (!farmId) throw new BadRequestException('farmId is required');
    return this.service.getFarmContexts(farmId, user.id);
  }

  @Get(':pondId')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  get(@Param('pondId') pondId: string, @CurrentUser() user) {
    return this.service.getContext(pondId, user.id);
  }
}
