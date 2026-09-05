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
import { Transaction } from '../transactions/transaction.entity';
import { FeedRecord } from '../feed-records/feed-record.entity';
import { Pond } from '../ponds/pond.entity';

// FarmAccessModule is @Global, so FarmAccessService and the FarmMember
// repository are available without importing it.
@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryItem,
      InventoryMovement,
      InventoryFarm,
      FarmMember,
      // Read-only: the purchase list (money rows tagged with this item) and
      // the pond a feed-driven movement fed. Entities, not services — no
      // module cycle, and no write path into either table from here.
      Transaction,
      FeedRecord,
      Pond,
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
