import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import {
  DateRangeDto,
  DefaultTrue,
} from '../../transactions/dto/money-query.dto';
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

  /**
   * Default TRUE — see D3, the same rule the financial report follows: a
   * retired pond's money is marked, not erased. Only an explicit `false` hides
   * it. Read by `findMoneyEntries`, which merges these rows into the Money
   * tab's entry list.
   */
  @IsBoolean()
  @DefaultTrue()
  includeArchivedPonds: boolean = true;
}
