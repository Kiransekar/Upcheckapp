import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { Transaction } from './transaction.entity';
import { Pond } from '../ponds/pond.entity';
import { FarmsModule } from '../farms/farms.module';

@Module({
  // Pond is registered read-only: `create` proves an optionally-named pond
  // belongs to the farm the caller was authorized for.
  imports: [TypeOrmModule.forFeature([Transaction, Pond]), FarmsModule],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
