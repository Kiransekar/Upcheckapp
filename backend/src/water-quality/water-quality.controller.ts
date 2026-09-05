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
  Delete,
  UseGuards,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { WaterQualityService } from './water-quality.service';
import { CreateWaterQualityRecordDto } from './dto/create-water-quality-record.dto';
import { UpdateWaterQualityRecordDto } from './dto/update-water-quality-record.dto';
import { PageOptionsDto } from '../common/dto/page-options.dto';
import { PageDto } from '../common/dto/page.dto';

@Controller('water-quality')
export class WaterQualityController {
  constructor(private readonly waterQualityService: WaterQualityService) {}

  @Post()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId')
  create(@Body() createDto: CreateWaterQualityRecordDto, @CurrentUser() user) {
    return this.waterQualityService.create(createDto, user.id);
  }

  @Get()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  findAll(
    @Query('pondId') pondId: string,
    @CurrentUser() user,
    @Query() pageOptionsDto?: PageOptionsDto,
    @Query('chemistryOnly') chemistryOnly?: string,
  ) {
    if (!pondId) {
      throw new BadRequestException('pondId query parameter is required');
    }
    return this.waterQualityService.findAll(
      pondId,
      user.id,
      pageOptionsDto,
      chemistryOnly === 'true',
    );
  }

  /**
   * Per-column latest for prefill. Declared BEFORE `:id` — Nest matches in
   * declaration order and `latest` would otherwise be read as a record id.
   */
  @Get('latest')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  getLatestPerColumn(@Query('pondId') pondId: string, @CurrentUser() user) {
    if (!pondId) {
      throw new BadRequestException('pondId query parameter is required');
    }
    return this.waterQualityService.getLatestPerColumn(pondId, user.id);
  }

  @Get('pond/:pondId/latest')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  getLatest(@Param('pondId') pondId: string, @CurrentUser() user) {
    return this.waterQualityService.getLatestByPond(pondId, user.id);
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('WaterQualityRecord', 'id', 'pond.farm.userId', 'READ')
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.waterQualityService.findOne(id, user.id);
  }

  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('WaterQualityRecord', 'id', 'pond.farm.userId')
  update(
    @Param('id') id: string,
    @Body() updateDto: UpdateWaterQualityRecordDto,
    @CurrentUser() user,
  ) {
    return this.waterQualityService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('WaterQualityRecord', 'id', 'pond.farm.userId')
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.waterQualityService.remove(id, user.id);
  }
}
