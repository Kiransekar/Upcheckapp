import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { DateRangeDto } from '../../transactions/dto/money-query.dto';
import { ExpenseCategory } from '../expense.entity';

/**
 * `GET /expenses` — the list read the Money screen's pond/cycle filters need.
 *
 * Every field is optional and every one NARROWS: with no `farmId` the service
 * falls back to the farms where the caller holds VIEW_FINANCIALS, so an empty
 * query is scoped, not unscoped.
 */
export class ExpenseQueryDto extends DateRangeDto {
  @IsUUID()
  @IsOptional()
  farmId?: string;

  @IsUUID()
  @IsOptional()
  pondId?: string;

  @IsUUID()
  @IsOptional()
  cropId?: string;

  @IsEnum(ExpenseCategory)
  @IsOptional()
  category?: ExpenseCategory;
}
