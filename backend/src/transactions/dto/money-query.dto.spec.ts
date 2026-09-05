import { BadRequestException, ValidationPipe } from '@nestjs/common';
import {
  FinancialReportQueryDto,
  TransactionQueryDto,
  dateRangeWhere,
  inDateRange,
} from './money-query.dto';

/**
 * The toggles default to TRUE (D2, D3), and that default is produced by a
 * `@Transform` running inside the ValidationPipe — not by the service, which
 * only checks `!== false`. So the default has to be pinned HERE, against the
 * real pipe, or an absent query param could start arriving as `undefined`
 * from one side and `false` from the other and quietly drop money.
 */
const pipe = new ValidationPipe({ whitelist: true, transform: true });
const through = (metatype: any, query: Record<string, unknown>) =>
  pipe.transform(query, { type: 'query', metatype } as any);

describe('money query DTOs', () => {
  it('defaults both toggles to TRUE when the params are absent', async () => {
    const tx: any = await through(TransactionQueryDto, {});
    expect(tx.includeInventoryPurchases).toBe(true);

    const report: any = await through(FinancialReportQueryDto, {});
    expect(report.includeArchivedPonds).toBe(true);
    expect(report.includeInventoryPurchases).toBe(true);
  });

  it('turns a toggle off only on the literal string "false"', async () => {
    const off: any = await through(FinancialReportQueryDto, {
      includeArchivedPonds: 'false',
    });
    expect(off.includeArchivedPonds).toBe(false);

    const on: any = await through(FinancialReportQueryDto, {
      includeArchivedPonds: 'true',
    });
    expect(on.includeArchivedPonds).toBe(true);
  });

  it('rejects a date that is not a date, and strips unknown params', async () => {
    await expect(
      through(TransactionQueryDto, { startDate: 'yesterday' }),
    ).rejects.toThrow(BadRequestException);

    const ok: any = await through(TransactionQueryDto, {
      startDate: '2026-02-01',
      endDate: '2026-02-28',
      bogus: 'x',
    });
    expect(ok.startDate).toBe('2026-02-01');
    expect(ok.bogus).toBeUndefined();
  });

  /**
   * The bounds are IST calendar days. `timestamp: true` (transactions, a
   * timestamptz column) converts; the plain `date` column of expenses does not
   * need to and must keep comparing bare `YYYY-MM-DD`.
   */
  describe('dateRangeWhere — IST day boundaries', () => {
    it('maps a timestamp range onto the IST day, not the UTC day', () => {
      const w: any = dateRangeWhere(
        { startDate: '2026-02-01', endDate: '2026-02-28' },
        { timestamp: true },
      );
      const [from, to] = w.value as [Date, Date];
      // 00:00 IST on Feb 1 === 18:30Z on Jan 31.
      expect(from.toISOString()).toBe('2026-01-31T18:30:00.000Z');
      // 23:59:59.999 IST on Feb 28 === 18:29:59.999Z on Feb 28.
      expect(to.toISOString()).toBe('2026-02-28T18:29:59.999Z');
    });

    it('leaves a plain DATE column comparing bare date strings', () => {
      const w: any = dateRangeWhere({
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      });
      expect(w.value).toEqual(['2026-02-01', '2026-02-28']);
    });

    it('handles a one-sided range on both sides', () => {
      const from: any = dateRangeWhere({ startDate: '2026-02-01' }, { timestamp: true });
      expect(from.type).toBe('moreThanOrEqual');
      expect((from.value as Date).toISOString()).toBe('2026-01-31T18:30:00.000Z');

      const to: any = dateRangeWhere({ endDate: '2026-02-28' }, { timestamp: true });
      expect(to.type).toBe('lessThanOrEqual');
      expect((to.value as Date).toISOString()).toBe('2026-02-28T18:29:59.999Z');
    });

    it('returns nothing when neither bound is given', () => {
      expect(dateRangeWhere({})).toBeUndefined();
      expect(dateRangeWhere(undefined)).toBeUndefined();
    });
  });

  describe('inDateRange — the in-memory harvest filter', () => {
    it('is inclusive on both bounds', () => {
      const q = { startDate: '2026-02-01', endDate: '2026-02-28' };
      expect(inDateRange('2026-01-31', q)).toBe(false);
      expect(inDateRange('2026-02-01', q)).toBe(true);
      expect(inDateRange('2026-02-28', q)).toBe(true);
      expect(inDateRange('2026-03-01', q)).toBe(false);
    });

    it('buckets a hydrated Date by its IST day, not its UTC day', () => {
      const q = { startDate: '2026-02-01', endDate: '2026-02-28' };
      expect(inDateRange(new Date('2026-02-15T00:00:00.000Z'), q)).toBe(true);
      // 2026-02-01 01:30 IST — inside the range despite being a January UTC
      // instant.
      expect(inDateRange(new Date('2026-01-31T20:00:00.000Z'), q)).toBe(true);
      // 2026-03-01 01:30 IST — March, and must stay out.
      expect(inDateRange(new Date('2026-02-28T20:00:00.000Z'), q)).toBe(false);
    });

    it('keeps everything when no bound is given', () => {
      expect(inDateRange('1999-01-01', {})).toBe(true);
      expect(inDateRange(undefined, undefined)).toBe(true);
    });
  });
});
