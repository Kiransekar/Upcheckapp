import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { OwnsResource } from '../common/decorators/owns-resource.decorator';
import { FeedAdvisorService } from './feed-advisor.service';
import {
  RationInputDto,
  GenerateFeedPlanDto,
  LogActualDto,
} from './dto/feed-advisor.dto';

/**
 * Daily Feed Advisor (farmer_features_spec.md §3). `compute` is a pure preview;
 * `generate` persists a {@link FeedPlan}; `actual` closes the adherence loop.
 */
@Controller('feed-advisor')
export class FeedAdvisorController {
  constructor(private readonly service: FeedAdvisorService) {}

  /** Pure ration preview — no persistence, no ownership coupling. */
  @Post('compute')
  compute(@Body() input: RationInputDto) {
    return this.service.computeRation(input);
  }

  /** Generate and persist today's plan for a pond the caller owns. */
  @Post()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'WRITE_MANAGEMENT')
  generate(@Body() dto: GenerateFeedPlanDto, @CurrentUser() user) {
    return this.service.generate(
      dto.pondId,
      dto.date,
      dto.input,
      user.id,
      dto.cropId,
    );
  }

  @Get('pond/:pondId')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  recent(@Param('pondId') pondId: string, @CurrentUser() user) {
    return this.service.recent(pondId, user.id);
  }

  /** Log what was actually fed → adherence + rolling-FCR feedback. */
  @Patch(':id/actual')
  @UseGuards(OwnershipGuard)
  @OwnsResource('FeedPlan', 'id', 'pond.farm.userId', 'WRITE_OPERATIONAL')
  logActual(
    @Param('id') id: string,
    @Body() dto: LogActualDto,
    @CurrentUser() user,
  ) {
    return this.service.logActual(id, dto.actualKg, user.id);
  }
}
