import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
} from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { CreateInventoryItemDto } from './dto/create-inventory-item.dto';
import { UpdateInventoryItemDto } from './dto/update-inventory-item.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { SetInventoryPairingDto } from './dto/set-inventory-pairing.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  create(@CurrentUser() user, @Body() createDto: CreateInventoryItemDto) {
    return this.inventoryService.create(createDto, user.id);
  }

  @Get()
  findAll(
    @CurrentUser() user,
    @Query('farmId') farmId?: string,
    @Query('category') category?: string,
  ) {
    return this.inventoryService.findAll(user.id, farmId, category);
  }

  @Get('low-stock/:farmId')
  getLowStock(@CurrentUser() user, @Param('farmId') farmId: string) {
    return this.inventoryService.getLowStock(farmId, user.id);
  }

  @Get(':id/movements')
  listMovements(@Param('id') id: string, @CurrentUser() user) {
    return this.inventoryService.listMovements(id, user.id);
  }

  @Get(':id')
  findOne(@CurrentUser() user, @Param('id') id: string) {
    return this.inventoryService.findOne(id, user.id);
  }

  @Patch(':id/adjust')
  adjustStock(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.inventoryService.adjustStock(id, dto.adjustment, user.id, {
      reason: dto.reason,
      capability: 'MANAGE_INVENTORY',
    });
  }

  @Patch(':id')
  update(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() updateDto: UpdateInventoryItemDto,
  ) {
    return this.inventoryService.update(id, updateDto, user.id);
  }

  // farm-scoped, enforced in InventoryService.setPairing (asserts
  // MANAGE_INVENTORY on both the old and new farm sets).
  @Patch(':id/farms')
  setPairing(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() dto: SetInventoryPairingDto,
  ) {
    return this.inventoryService.setPairing(id, dto.farmIds, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user, @Param('id') id: string) {
    return this.inventoryService.remove(id, user.id);
  }
}
