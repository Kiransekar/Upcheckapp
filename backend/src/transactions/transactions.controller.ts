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
import { TransactionsService } from './transactions.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { UpdateTransactionDto } from './dto/update-transaction.dto';
import { TransactionQueryDto } from './dto/money-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactionsService: TransactionsService) {}

  @Post()
  create(@CurrentUser() user, @Body() createDto: CreateTransactionDto) {
    return this.transactionsService.create(createDto, user.id);
  }

  @Get()
  findAll(@CurrentUser() user, @Query() q: TransactionQueryDto) {
    return this.transactionsService.findAll(user.id, q);
  }

  @Get('farm/:farmId/summary')
  getSummary(
    @CurrentUser() user,
    @Param('farmId') farmId: string,
    @Query() q: TransactionQueryDto,
  ) {
    return this.transactionsService.getSummaryByFarm(farmId, user.id, q);
  }

  @Get(':id')
  findOne(@CurrentUser() user, @Param('id') id: string) {
    return this.transactionsService.findOne(id, user.id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user,
    @Param('id') id: string,
    @Body() updateDto: UpdateTransactionDto,
  ) {
    return this.transactionsService.update(id, updateDto, user.id);
  }

  @Delete(':id')
  remove(@CurrentUser() user, @Param('id') id: string) {
    return this.transactionsService.remove(id, user.id);
  }
}
