import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HarvestPlan } from './harvest-plan.entity';
import { HarvestPlansController } from './harvest-plans.controller';
import { HarvestPlansService } from './harvest-plans.service';
import { Transaction } from '../transactions/transaction.entity';
import { Expense } from '../finances/expense.entity';
import { Harvest } from '../harvests/harvest.entity';
import { Crop } from '../crops/crop.entity';
import { Pond } from '../ponds/pond.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([HarvestPlan, Transaction, Expense, Harvest, Crop, Pond]),
  ],
  controllers: [HarvestPlansController],
  providers: [HarvestPlansService],
  exports: [HarvestPlansService],
})
export class HarvestPlansModule {}
