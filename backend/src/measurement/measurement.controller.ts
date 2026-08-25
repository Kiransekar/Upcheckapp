import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { OwnsResource } from '../common/decorators/owns-resource.decorator';
import { MeasurementService } from './measurement.service';
import {
  CreateMeasurementDto,
  CreateMeasurementBatchDto,
} from './dto/create-measurement.dto';
import { QueryMeasurementDto } from './dto/query-measurement.dto';
import { EditMeasurementDto } from './dto/edit-measurement.dto';

/**
 * Unified Measurement ingest/read surface (PRD §6.2 keystone). Ownership is
 * enforced in {@link MeasurementService} against the referenced pond, so every
 * route is scoped to the authenticated owner.
 */
@Controller('measurements')
export class MeasurementController {
  constructor(private readonly service: MeasurementService) {}

  /** Ingest one reading. Idempotent on a client-supplied `id`. */
  @Post()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'WRITE_OPERATIONAL')
  create(@Body() dto: CreateMeasurementDto, @CurrentUser() user) {
    return this.service.create(dto, user.id);
  }

  /**
   * Batch ingest for offline sync; per-item idempotent + fault-isolated.
   *
   * No route-level OwnershipGuard here on purpose: a batch may span several
   * ponds, so there is no single resource id for the guard to resolve.
   * `createBatch` verifies WRITE_OPERATIONAL per distinct pond in the batch
   * (via the shared pondCache), which is the enforcement point for this route.
   */
  @Post('batch')
  createBatch(@Body() dto: CreateMeasurementBatchDto, @CurrentUser() user) {
    return this.service.createBatch(
      dto.measurements,
      user.id,
      dto.continueOnError ?? true,
    );
  }

  /** Time-series read (pondId required; optional crop/param/category/window). */
  @Get()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  query(@Query() q: QueryMeasurementDto, @CurrentUser() user) {
    return this.service.query(q, user.id);
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Measurement', 'id', 'pond.farm.userId', 'READ')
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.service.findOne(id, user.id);
  }

  /** Append a corrected reading (original is preserved + superseded). */
  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Measurement', 'id', 'pond.farm.userId', 'WRITE_OPERATIONAL')
  edit(
    @Param('id') id: string,
    @Body() dto: EditMeasurementDto,
    @CurrentUser() user,
  ) {
    return this.service.edit(id, dto, user.id);
  }
}
