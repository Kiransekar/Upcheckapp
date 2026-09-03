import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { InventoryItem } from './inventory-item.entity';
import { AlertsModule } from '../alerts/alerts.module';
import { FarmMember } from '../farm-access/farm-member.entity';

// FarmAccessModule is @Global, so FarmAccessService and the FarmMember
// repository are available without importing it.
@Module({
  imports: [
    TypeOrmModule.forFeature([InventoryItem, FarmMember]),
    AlertsModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
