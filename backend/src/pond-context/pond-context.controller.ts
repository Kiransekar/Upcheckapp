import { Controller, Get, Param, UseGuards } from '@nestjs/common';
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

  @Get(':pondId')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  get(@Param('pondId') pondId: string, @CurrentUser() user) {
    return this.service.getContext(pondId, user.id);
  }
}
