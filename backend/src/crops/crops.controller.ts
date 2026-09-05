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
import { CropsService } from './crops.service';
import { CreateCropDto } from './dto/create-crop.dto';
import { UpdateCropDto } from './dto/update-crop.dto';
import { HarvestCropDto } from './dto/harvest-crop.dto';
@Controller('crops')
export class CropsController {
  constructor(private readonly cropsService: CropsService) {}

  @Post()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'WRITE_MANAGEMENT')
  create(@Body() createCropDto: CreateCropDto, @CurrentUser() user) {
    return this.cropsService.create(createCropDto, user.id);
  }

  @Get()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Pond', 'pondId', 'farm.userId', 'READ')
  findAll(@Query('pondId') pondId: string, @CurrentUser() user) {
    if (!pondId) {
      throw new BadRequestException('pondId query parameter is required');
    }
    return this.cropsService.findAllAccessible(pondId, user.id);
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Crop', 'id', 'pond.farm.userId', 'READ')
  findOne(@Param('id') id: string, @CurrentUser() user) {
    return this.cropsService.findOneAccessible(id, user.id);
  }

  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Crop', 'id', 'pond.farm.userId', 'WRITE_MANAGEMENT')
  update(
    @Param('id') id: string,
    @Body() updateCropDto: UpdateCropDto,
    @CurrentUser() user,
  ) {
    return this.cropsService.update(id, updateCropDto, user.id);
  }

  @Patch(':id/harvest')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Crop', 'id', 'pond.farm.userId', 'RECORD_HARVEST')
  harvest(
    @Param('id') id: string,
    @Body() harvestData: HarvestCropDto,
    @CurrentUser() user,
  ) {
    return this.cropsService.harvest(id, harvestData, user.id);
  }

  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Crop', 'id', 'pond.farm.userId', 'OWNER_ONLY')
  remove(@Param('id') id: string, @CurrentUser() user) {
    return this.cropsService.remove(id, user.id);
  }
  @Patch(':id/close')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Crop', 'id', 'pond.farm.userId', 'RECORD_HARVEST')
  closeCycle(
    @Param('id') id: string,
    @Body() body: { actualHarvestDate: string },
    @CurrentUser() user,
  ) {
    return this.cropsService.closeCycle(id, body.actualHarvestDate, user.id);
  }
}
