import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryItem } from './inventory-item.entity';
import { InventoryMovement } from './inventory-movement.entity';
import { InventoryFarm } from './inventory-farm.entity';
import { AlertsModule } from '../alerts/alerts.module';
import { FarmMember } from '../farm-access/farm-member.entity';
import { TransactionsModule } from '../transactions/transactions.module';

// FarmAccessModule is @Global, so FarmAccessService and the FarmMember
// repository are available without importing it.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryMovement,
      InventoryFarm,
      FarmMember,
    ]),
    AlertsModule,
    // For TransactionsService.createInternal — a purchase-flavoured stock
    // adjustment writes a matching money row.
    TransactionsModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
