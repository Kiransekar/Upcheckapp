import { BadRequestException } from '@nestjs/common';
import { MoneyOverviewService } from './money-overview.service';

/**
 * The Money tab made 3 + N requests from the phone — the farm list, one
 * financial report PER FARM, plus transactions and credit. At ~265ms of
 * network per request from rural India that fan-out was the load time, not the
 * server. This collapses it to one request.
 *
 * These tests hold two things still: the fan-out really is batched, and
 * batching did not widen what a caller can see.
 */
const farm = (id: string) => ({ id, name: `Farm ${id}` });

function makeService(over: any = {}) {
  const farms = {
    findAll: jest.fn().mockResolvedValue(over.farms ?? [farm('f1'), farm('f2')]),
  };
  const reports = {
    getFinancialReport: jest
      .fn()
      .mockImplementation(async (farmId: string) => ({ farmId, revenue: 100 })),
  };
  const transactions = {
    findAll: jest
      .fn()
      .mockResolvedValue(
        over.entries ?? [{ id: 'tx1', transactionDate: '2026-01-01' }],
      ),
  };
  const credit = { list: jest.fn().mockResolvedValue(over.credit ?? []) };
  const harvests = {
    findMoneyEntries: jest.fn().mockResolvedValue(over.harvests ?? []),
  };
  const expenses = {
    findMoneyEntries: jest.fn().mockResolvedValue(over.expenses ?? []),
  };
  const svc = new MoneyOverviewService(
    farms as any,
    reports as any,
    transactions as any,
    credit as any,
    harvests as any,
    expenses as any,
  );
  return { svc, farms, reports, transactions, credit, harvests, expenses };
}

/** A harvest sale as the backend projects it — read-only, no transaction id. */
const harvestEntry = (over: any = {}) => ({
  id: 'harvest:h1',
  source: 'harvest',
  farmId: 'f1',
  transactionDate: '2026-01-05',
  type: 'income',
  category: 'Harvest',
  amount: 42000,
  description: 'Pond 1 · Cycle A',
  buyerName: 'Ravi Traders',
  ...over,
});

describe('MoneyOverviewService', () => {
  it('returns a report for every farm the caller can see, in one call', async () => {
    const { svc, reports } = makeService();

    const out = await svc.forUser('u');

    expect(reports.getFinancialReport).toHaveBeenCalledTimes(2);
    expect(Object.keys(out.reports).sort()).toEqual(['f1', 'f2']);
  });

  // Transactions and credit are already scoped server-side to the farms the
  // caller may view, so asking per farm would reintroduce the fan-out.
  it('asks for transactions and credit ONCE, not once per farm', async () => {
    const { svc, transactions, credit } = makeService({
      farms: [farm('f1'), farm('f2'), farm('f3')],
    });

    await svc.forUser('u');

    expect(transactions.findAll).toHaveBeenCalledTimes(1);
    expect(credit.list).toHaveBeenCalledTimes(1);
  });

  /**
   * The financial report is VIEW_FINANCIALS-gated. A worker or viewer gets a
   * 403 per farm, which is a legitimate outcome — their tab shows the farms
   * they can see with no figures for the ones they cannot, rather than failing
   * whole. Critically, the refused farm must contribute NO report at all.
   */
  it('omits the figures for a farm the caller may not view financials on', async () => {
    const { svc, reports } = makeService();
    reports.getFinancialReport.mockImplementation(async (farmId: string) => {
      if (farmId === 'f2') throw new Error('Forbidden');
      return { farmId, revenue: 100 };
    });

    const out = await svc.forUser('worker');

    expect(Object.keys(out.reports)).toEqual(['f1']);
    expect(out.reports).not.toHaveProperty('f2');
    // The rest of the tab still renders.
    expect(out.allEntries).toHaveLength(1);
  });

  it('still returns the tab when the credit ledger is unavailable', async () => {
    const { svc, credit } = makeService();
    credit.list.mockRejectedValue(new Error('no ledger'));

    const out = await svc.forUser('u');

    expect(out.credit).toEqual([]);
    expect(Object.keys(out.reports)).toHaveLength(2);
  });

  /**
   * "After giving a harvest with some profit, that profit is not shown in the
   * money tab." It WAS in the headline — the financial report sums every
   * harvest's sale price into revenue — but the entry list underneath rendered
   * the transactions table only, so there was no line to point at.
   */
  it('shows a logged harvest as a line item in the entry list', async () => {
    const { svc } = makeService({ harvests: [harvestEntry()] });

    const out = await svc.forUser('u');

    const harvest = out.allEntries.find((e: any) => e.id === 'harvest:h1');
    expect(harvest).toMatchObject({
      source: 'harvest',
      type: 'income',
      amount: 42000,
      farmId: 'f1',
      buyerName: 'Ravi Traders',
    });
  });

  /**
   * The reason harvests are merged at READ time rather than written as a
   * Transaction on create: getFinancialReport already sums harvest sale prices
   * AND the transactions table, so a real row would count every harvest twice
   * in revenue and profit. The synthetic rows must never reach the totals.
   */
  it('does not touch the report totals — no double counting', async () => {
    const { svc, reports } = makeService({ harvests: [harvestEntry()] });
    reports.getFinancialReport.mockImplementation(async (farmId: string) => ({
      farmId,
      revenue: 42000,
      totalExpenses: 0,
      profit: 42000,
    }));

    const out = await svc.forUser('u');

    expect((out.reports as any).f1.revenue).toBe(42000);
    expect((out.reports as any).f1.profit).toBe(42000);
    expect(reports.getFinancialReport).toHaveBeenCalledTimes(2);
  });

  /**
   * "I added expense inside a pond but it didnt show inside the money screen."
   *
   * Same shape of bug as the harvest one above, on the other ledger. Costs
   * typed on a pond live in `expenses`, not `transactions`. The headline summed
   * them (the report reads that table) but the entry list rendered
   * `transactions` only, and the pond costs were fetched solely when the farmer
   * drilled into one specific pond — so the total moved and nothing on screen
   * explained why.
   */
  it('shows a pond cost as a line item in the entry list', async () => {
    const { svc } = makeService({
      expenses: [
        {
          id: 'expense:e1',
          source: 'expense',
          farmId: 'f1',
          pondId: 'p1',
          pondName: 'North pond',
          transactionDate: '2026-01-03',
          type: 'expense',
          category: 'Feed',
          amount: 8000,
        },
      ],
    });

    const out = await svc.forUser('u');

    expect(out.allEntries.find((e: any) => e.id === 'expense:e1')).toMatchObject({
      source: 'expense',
      type: 'expense',
      amount: 8000,
      farmId: 'f1',
      pondName: 'North pond',
    });
  });

  it('interleaves pond costs with transactions by date, newest first', async () => {
    const { svc } = makeService({
      entries: [
        { id: 'tx-late', transactionDate: '2026-02-10' },
        { id: 'tx-early', transactionDate: '2026-02-01' },
      ],
      expenses: [
        { id: 'expense:e1', source: 'expense', transactionDate: '2026-02-05' },
      ],
    });

    const out = await svc.forUser('u');

    expect(out.allEntries.map((e: any) => e.id)).toEqual([
      'tx-late',
      'expense:e1',
      'tx-early',
    ]);
  });

  /**
   * Merged at read time for the same reason harvests are: the financial report
   * already sums the expenses table into the headline, so writing a real
   * Transaction per expense would count every pond cost twice.
   */
  it('gives a pond cost row no transaction id to edit or delete', async () => {
    const { svc } = makeService({
      expenses: [{ id: 'expense:e1', source: 'expense', transactionDate: '2026-02-05' }],
    });

    const out = await svc.forUser('u');

    const row: any = out.allEntries.find((e: any) => e.source === 'expense');
    expect(row.id).toMatch(/^expense:/);
    expect(row.id).not.toBe('e1');
  });

  it('gives a synthetic harvest row no transaction id to edit or delete', async () => {
    const { svc } = makeService({ harvests: [harvestEntry()] });

    const out = await svc.forUser('u');

    const harvest: any = out.allEntries.find((e: any) => e.source === 'harvest');
    expect(harvest.id).toMatch(/^harvest:/);
    // A real transaction id would let the UI offer edit/delete on a row with
    // nothing behind it.
    expect(harvest.id).not.toBe('h1');
  });

  it('interleaves harvests with transactions by date, newest first', async () => {
    const { svc } = makeService({
      entries: [
        { id: 'tx-late', transactionDate: '2026-01-10' },
        { id: 'tx-early', transactionDate: '2026-01-01' },
      ],
      harvests: [harvestEntry({ transactionDate: '2026-01-05' })],
    });

    const out = await svc.forUser('u');

    expect(out.allEntries.map((e: any) => e.id)).toEqual([
      'tx-late',
      'harvest:h1',
      'tx-early',
    ]);
  });

  it('still returns the tab when harvests cannot be read', async () => {
    const { svc, harvests } = makeService();
    harvests.findMoneyEntries.mockRejectedValue(new Error('boom'));

    const out = await svc.forUser('u');

    expect(out.allEntries).toHaveLength(1);
    expect(Object.keys(out.reports)).toHaveLength(2);
  });

  /**
   * The tab's filters. Every fan-out call here is wrapped in `.catch()`, so an
   * inverted range validated only inside the downstream services would be
   * swallowed into an empty tab instead of a 400 — hence the up-front check.
   */
  describe('filters', () => {
    it('passes the range and both toggles through to every farm report', async () => {
      const { svc, reports, transactions } = makeService();
      const q = {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        includeArchivedPonds: false,
        includeInventoryPurchases: false,
      };

      await svc.forUser('u', q);

      expect(reports.getFinancialReport).toHaveBeenCalledWith('f1', 'u', q);
      expect(transactions.findAll).toHaveBeenCalledWith('u', q);
    });

    it('rejects an inverted range with 400 rather than an empty tab', async () => {
      const { svc, farms } = makeService();

      await expect(
        svc.forUser('u', { startDate: '2026-03-01', endDate: '2026-02-01' }),
      ).rejects.toThrow(BadRequestException);
      expect(farms.findAll).not.toHaveBeenCalled();
    });

    /**
     * The harvest range used to be applied HERE, with a `.filter()` over rows
     * the query had already capped at 500 — so "this week" searched the 500
     * most recent harvests instead of the week's, and a farm with more than
     * that showed an empty week. It belongs in SQL, which means this layer's
     * job is to hand the filters down intact.
     */
    it('hands the range and the archive toggle down to the harvest query', async () => {
      const { svc, harvests } = makeService({ entries: [] });

      await svc.forUser('u', {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        includeArchivedPonds: false,
      });

      expect(harvests.findMoneyEntries).toHaveBeenCalledWith(
        'u',
        expect.objectContaining({
          startDate: '2026-02-01',
          endDate: '2026-02-28',
          includeArchivedPonds: false,
        }),
      );
    });

    // Whatever the three queries return is merged as-is: they are each already
    // filtered, so a second pass here could only disagree with them.
    it('keeps every row the harvest query returned', async () => {
      const { svc } = makeService({
        entries: [],
        harvests: [
          harvestEntry({ id: 'h-start', transactionDate: '2026-02-01' }),
          harvestEntry({ id: 'h-end', transactionDate: '2026-02-28' }),
        ],
      });

      const out = await svc.forUser('u', {
        startDate: '2026-02-01',
        endDate: '2026-02-28',
      });

      expect(out.allEntries.map((e: any) => e.id)).toEqual(['h-end', 'h-start']);
    });

    it('sums the per-farm inventory subtotals so the tab needs no second request', async () => {
      const { svc, reports } = makeService();
      reports.getFinancialReport.mockImplementation(async (farmId: string) => ({
        farmId,
        revenue: 0,
        inventoryExpenses: farmId === 'f1' ? 3000 : 1500,
      }));

      const out = await svc.forUser('u');

      expect(out.inventoryExpenses).toBe(4500);
    });
  });

  it('returns nothing for a caller on no farms', async () => {
    const { svc, reports } = makeService({ farms: [] });

    const out = await svc.forUser('stranger');

    expect(out.farms).toEqual([]);
    expect(out.reports).toEqual({});
    expect(reports.getFinancialReport).not.toHaveBeenCalled();
  });
});
