import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { OwnsResource } from '../common/decorators/owns-resource.decorator';
import { DiseaseWarningService } from './disease-warning.service';
import type { DiseaseIndicators } from './disease-warning.service';

interface SnapshotBody {
  pondId: string;
  cropId?: string;
  date: string;
  indicators: DiseaseIndicators;
}

/** Disease Early-Warning (farmer_features_spec.md §2). */
@Controller('disease-risk')
export class DiseaseWarningController {
  constructor(private readonly service: DiseaseWarningService) {}

  /** Pure scoring preview from an indicator set. */
  @Post('compute')
  compute(@Body() indicators: DiseaseIndicators) {
    return this.service.computeRisks(indicators);
  }

  /** Persist a ranked risk snapshot for a pond. */
  @Post()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'WRITE_OPERATIONAL')
  snapshot(@Body() body: SnapshotBody, @CurrentUser() user) {
    return this.service.snapshot(
      body.pondId,
      body.date,
      body.indicators,
      user.id,
      body.cropId,
    );
  }

  @Get('pond/:pondId')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  recent(@Param('pondId') pondId: string, @CurrentUser() user) {
    return this.service.recent(pondId, user.id);
  }

  @Get('pond/:pondId/latest')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  latest(@Param('pondId') pondId: string, @CurrentUser() user) {
    return this.service.latest(pondId, user.id);
  }
}
