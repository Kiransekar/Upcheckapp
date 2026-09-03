import { Module } from '@nestjs/common';
import { MoneyOverviewService } from './money-overview.service';
import { MoneyOverviewController } from './money-overview.controller';
import { FarmsModule } from '../farms/farms.module';
import { ReportsModule } from '../reports/reports.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { CreditModule } from '../credit/credit.module';
import { HarvestsModule } from '../harvests/harvests.module';

/**
 * Batching layer for the Money tab — see MoneyOverviewService for why.
 *
 * Imports the feature modules rather than their repositories on purpose: the
 * point is to reuse the services WITH their access checks (the financial
 * report is VIEW_FINANCIALS-gated), not to reach past them to the tables.
 */
@Module({
  imports: [
    FarmsModule,
    ReportsModule,
    TransactionsModule,
    CreditModule,
    HarvestsModule,
  ],
  controllers: [MoneyOverviewController],
  providers: [MoneyOverviewService],
})
export class MoneyOverviewModule {}
