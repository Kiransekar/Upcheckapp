import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Controller, Get, Post, Body, Param, Query } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { ExpenseQueryDto } from './dto/expense-query.dto';
import { DateRangeDto } from '../transactions/dto/money-query.dto';
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post()
  create(@Body() createDto: CreateExpenseDto, @CurrentUser() user) {
    return this.expensesService.create(createDto, user.id);
  }

  /** Filtered list. The `cycle/:cropId` routes below are unchanged. */
  @Get()
  findAll(@Query() q: ExpenseQueryDto, @CurrentUser() user) {
    return this.expensesService.findAll(q, user.id);
  }

  @Get('cycle/:cropId')
  findByCycle(
    @Param('cropId') cropId: string,
    @CurrentUser() user,
    @Query() q: DateRangeDto,
  ) {
    return this.expensesService.findByCycle(cropId, user.id, q);
  }

  @Get('cycle/:cropId/financials')
  getCycleFinancials(
    @Param('cropId') cropId: string,
    @CurrentUser() user,
    @Query() q: DateRangeDto,
  ) {
    return this.expensesService.getCycleFinancials(cropId, user.id, q);
  }
}
