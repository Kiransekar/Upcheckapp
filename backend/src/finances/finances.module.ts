import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { Expense } from './expense.entity';
import { Crop } from '../crops/crop.entity';
import { Transaction } from '../transactions/transaction.entity';
import { PondsModule } from '../ponds/ponds.module';
import { HarvestsModule } from '../harvests/harvests.module';

@Module({
  imports: [
    // `Transaction` is READ-ONLY here: `findByCycle` projects the Money
    // screen's pond-tagged costs into the cycle's expense list. Writes stay in
    // TransactionsService.
    TypeOrmModule.forFeature([Expense, Crop, Transaction]),
    PondsModule,
    HarvestsModule,
  ],
  controllers: [ExpensesController],
  providers: [ExpensesService],
  exports: [ExpensesService],
})
export class FinancesModule {}
