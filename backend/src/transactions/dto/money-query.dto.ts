import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { istDayRangeUtc, toIstDateString } from '../../common/ist-date';

/**
 * Shared query params for every money READ — `/transactions`,
 * `/transactions/farm/:id/summary`, `/expenses`, `/reports/financials` and
 * `/money/overview`.
 *
 * They live in the transactions module because it is the one money module all
 * the others already depend on (reports and money-overview import
 * TransactionsService; finances imports only this file).
 */

/**
 * `?flag=false` turns a default-ON toggle off. Absent, `true`, or anything
 * else leaves it on — the two toggles here are product defaults (D2, D3), so
 * an unset param must never silently drop money from the totals.
 */
export const DefaultTrue = () =>
  Transform(({ value }) => value !== 'false' && value !== false);

export class DateRangeDto {
  /** Inclusive lower bound, `YYYY-MM-DD`. */
  @IsDateString()
  @IsOptional()
  startDate?: string;

  /** Inclusive upper bound, `YYYY-MM-DD`. */
  @IsDateString()
  @IsOptional()
  endDate?: string;
}

export class TransactionQueryDto extends DateRangeDto {
  @IsUUID()
  @IsOptional()
  farmId?: string;

  @IsString()
  @IsOptional()
  type?: string;

  /** Narrow to one pond's money. Farm-level rows have no pond and drop out. */
  @IsUUID()
  @IsOptional()
  pondId?: string;

  /** Default TRUE — see D2. False excludes rows with an `inventoryItemId`. */
  @IsBoolean()
  @DefaultTrue()
  includeInventoryPurchases: boolean = true;

  /**
   * Default TRUE — see D3. False drops rows attributed to an ARCHIVED pond, so
   * the toggle means the same thing here as it does for the expense ledger.
   * Rows with no pond are farm-level money and are never dropped.
   */
  @IsBoolean()
  @DefaultTrue()
  includeArchivedPonds: boolean = true;
}

export class MoneyOverviewQueryDto extends DateRangeDto {
  /** Default TRUE — see D3. Archived ponds keep their money history. */
  @IsBoolean()
  @DefaultTrue()
  includeArchivedPonds: boolean = true;

  @IsBoolean()
  @DefaultTrue()
  includeInventoryPurchases: boolean = true;
}

export class FinancialReportQueryDto extends MoneyOverviewQueryDto {
  @IsUUID()
  @IsOptional()
  farmId?: string;
}

/**
 * TypeORM where-fragment for an inclusive date range, or `undefined` when
 * neither bound was given. Throws 400 on an inverted range — call it even when
 * the fragment is unused, it is the one place the range is validated.
 *
 * `timestamp: true` maps each bound to the UTC instants of that IST calendar
 * day, because `transactions.transaction_date` is a `timestamptz` while
 * `expenses.date` is a plain `date` needing no conversion.
 *
 * The bounds MUST be IST-local, not UTC. Comparing a `YYYY-MM-DD` straight
 * against a timestamptz makes the day run 05:30–05:29 IST: "this month" then
 * both hides the first morning's entries and shows five and a half hours of
 * next month's spend. `istDayRangeUtc` is the same day-boundary helper the
 * reports and attendance paths already use (DATE-1).
 */
export function dateRangeWhere(
  q: { startDate?: string; endDate?: string } | undefined,
  opts: { timestamp?: boolean } = {},
) {
  const startDate = q?.startDate;
  const endDate = q?.endDate;
  if (startDate && endDate && startDate > endDate) {
    throw new BadRequestException('startDate must be on or before endDate');
  }
  if (!startDate && !endDate) return undefined;
  const lower: string | Date | undefined =
    startDate && opts.timestamp ? istDayRangeUtc(startDate).start : startDate;
  const upper: string | Date | undefined =
    endDate && opts.timestamp ? istDayRangeUtc(endDate).end : endDate;
  if (lower && upper) return Between(lower as any, upper as any);
  return lower
    ? MoreThanOrEqual(lower as any)
    : LessThanOrEqual(upper as any);
}

/** The IST-local UTC instants for a `?startDate=&endDate=` pair, for query builders. */
export function istBounds(q: { startDate?: string; endDate?: string }) {
  return {
    start: q.startDate ? istDayRangeUtc(q.startDate).start : undefined,
    end: q.endDate ? istDayRangeUtc(q.endDate).end : undefined,
  };
}

/**
 * Inclusive `YYYY-MM-DD` range test for rows filtered in memory — harvests,
 * which are read through a service this module does not own and cannot add a
 * date filter to.
 */
export function inDateRange(
  value: unknown,
  q: { startDate?: string; endDate?: string } | undefined,
): boolean {
  if (!q?.startDate && !q?.endDate) return true;
  // IST-local day, not UTC — same boundary the SQL bounds above use.
  const day =
    value instanceof Date
      ? toIstDateString(value)
      : String(value ?? '').slice(0, 10);
  if (q?.startDate && day < q.startDate) return false;
  if (q?.endDate && day > q.endDate) return false;
  return true;
}
