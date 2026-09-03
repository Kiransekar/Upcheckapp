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
  Query,
  UseGuards,
} from '@nestjs/common';
import { HarvestsService } from './harvests.service';
import { CreateHarvestDto } from './dto/create-harvest.dto';
import { UpdateHarvestDto } from './dto/update-harvest.dto';

@Controller('harvests')
export class HarvestsController {
  constructor(private readonly harvestsService: HarvestsService) {}

  @Post()
  @UseGuards(OwnershipGuard)
  @OwnsResource('Crop', 'cropId', 'pond.farm.userId', 'WRITE_MANAGEMENT')
  create(@Body() createDto: CreateHarvestDto, @CurrentUser() user) {
    return this.harvestsService.create(createDto, user.id);
  }

  @Get()
  findAll(
    @Query('cropId') cropId: string,
    @Query('pondId') pondId: string,
    @CurrentUser() user,
  ) {
    return this.harvestsService.findAll(user.id, cropId, pondId);
  }

  @Get(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Harvest', 'id', 'crop.pond.farm.userId', 'WRITE_MANAGEMENT')
  findOne(@Param('id') id: string) {
    return this.harvestsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Harvest', 'id', 'crop.pond.farm.userId', 'WRITE_MANAGEMENT')
  update(@Param('id') id: string, @Body() dto: UpdateHarvestDto) {
    return this.harvestsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(OwnershipGuard)
  @OwnsResource('Harvest', 'id', 'crop.pond.farm.userId', 'WRITE_MANAGEMENT')
  remove(@Param('id') id: string) {
    return this.harvestsService.remove(id);
  }
}
