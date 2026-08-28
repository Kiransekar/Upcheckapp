import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { PondsModule } from '../ponds/ponds.module';
import { CropsModule } from '../crops/crops.module';
import { FeedRecordsModule } from '../feed-records/feed-records.module';
import { HarvestsModule } from '../harvests/harvests.module';
import { FinancesModule } from '../finances/finances.module';
import { InventoryModule } from '../inventory/inventory.module';
import { SamplingModule } from '../sampling/sampling.module';
import { TransactionsModule } from '../transactions/transactions.module';

@Module({
  imports: [
    PondsModule,
    CropsModule,
    FeedRecordsModule,
    HarvestsModule,
    FinancesModule,
    InventoryModule,
    SamplingModule,
    TransactionsModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  // Exported so MoneyOverviewModule can batch the Money tab's per-farm reports
  // through the SAME service — and therefore the same VIEW_FINANCIALS check.
  exports: [ReportsService],
})
export class ReportsModule {}
