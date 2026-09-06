/**
 * Money filters on the financial report.
 *
 * Two of these guard real money the farmer was losing:
 *
 * - **Archived ponds (D3).** `pondsService.findAll` excludes
 *   `status = 'archived'` unless told otherwise, and the report passed nothing
 *   — so archiving a pond erased its entire cost and revenue history from the
 *   Money tab. Archived money is now IN by default and tagged so the client
 *   can colour it.
 * - **Inventory purchases (D2).** A stock purchase writes an expense
 *   transaction. Whether the totals describe those is the farmer's choice, so
 *   it is opt-out, and the subtotal rides along so the client need not ask
 *   twice.
 */
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';

type PondStub = { id: string; name?: string; status?: string; revenue?: number; expenses?: number };

const build = (opts: { ponds?: PondStub[]; transactions?: any[] } = {}) => {
  const ponds = opts.ponds ?? [{ id: 'pond-1' }];

  const pondsService = {
    findAll: jest
      .fn()
      .mockImplementation(async (_farmId, _userId, options) =>
        // Mirrors the real service: archived ponds are dropped unless asked for.
        ({
          data: options?.includeArchived
            ? ponds
            : ponds.filter((p) => p.status !== 'archived'),
        }),
      ),
  } as any;

  // One cycle per pond, id `cycle-of-<pondId>`, carrying that pond's money.
  const cropsService = {
    findAllAccessible: jest
      .fn()
      .mockImplementation(async (pondId: string) => [
        { id: `cycle-of-${pondId}` },
      ]),
  } as any;
  const expensesService = {
    // Revenue only — costs come from `totalsByPond` now, see below.
    getCycleFinancials: jest.fn().mockImplementation(async (cropId: string) => {
      const pond = ponds.find((p) => `cycle-of-${p.id}` === cropId)!;
      return {
        totalRevenue: pond.revenue ?? 0,
        totalExpenses: pond.expenses ?? 0,
        expensesByCategory: pond.expenses ? { Feed: pond.expenses } : {},
      };
    }),
    // Costs come from the POND, keyed by pond id, so an expense with no crop
    // is still counted. `pondIds` is whatever the report asked about.
    totalsByPond: jest.fn().mockImplementation(async (pondIds: string[]) => {
      const out = new Map<string, { total: number; byCategory: Record<string, number> }>();
      for (const id of pondIds) {
        const pond = ponds.find((p) => p.id === id);
        if (!pond?.expenses) continue;
        out.set(id, { total: pond.expenses, byCategory: { Feed: pond.expenses } });
      }
      return out;
    }),
  } as any;

  const transactionsService = {
    findAll: jest.fn().mockImplementation(async (_userId, q) =>
      (opts.transactions ?? []).filter(
        (t) => q?.includeInventoryPurchases === false ? !t.inventoryItemId : true,
      ),
    ),
  } as any;

  const service = new ReportsService(
    pondsService,
    {} as any, // inventoryService
    {} as any, // feedRecordsService
    {} as any, // harvestsService
    expensesService,
    {} as any, // samplingService
    cropsService,
    { assertCanAccessFarm: jest.fn().mockResolvedValue({}) } as any,
    transactionsService,
  );
  return { service, pondsService, transactionsService, expensesService };
};

const LIVE: PondStub = { id: 'live', name: 'Pond A', status: 'active', revenue: 10000, expenses: 4000 };
const ARCHIVED: PondStub = { id: 'gone', name: 'Pond B', status: 'archived', revenue: 50000, expenses: 20000 };

describe('getFinancialReport — archived ponds (D3)', () => {
  it('includes archived-pond money BY DEFAULT and tags the row', async () => {
    const { service, pondsService } = build({ ponds: [LIVE, ARCHIVED] });

    const report = await service.getFinancialReport('farm-1', 'user-1');

    expect(pondsService.findAll).toHaveBeenCalledWith(
      'farm-1',
      'user-1',
      { includeArchived: true },
      expect.anything(),
    );
    expect(report.revenue).toBe(60000);
    expect(report.totalExpenses).toBe(24000);
    expect(report.includedArchivedPonds).toBe(true);
    expect(report.ponds).toEqual([
      { pondId: 'live', name: 'Pond A', archived: false, revenue: 10000, expenses: 4000 },
      { pondId: 'gone', name: 'Pond B', archived: true, revenue: 50000, expenses: 20000 },
    ]);
  });

  it('drops archived-pond money when includeArchivedPonds is false', async () => {
    const { service, pondsService } = build({ ponds: [LIVE, ARCHIVED] });

    const report = await service.getFinancialReport('farm-1', 'user-1', {
      includeArchivedPonds: false,
    });

    expect(pondsService.findAll).toHaveBeenCalledWith(
      'farm-1',
      'user-1',
      { includeArchived: false },
      expect.anything(),
    );
    expect(report.revenue).toBe(10000);
    expect(report.totalExpenses).toBe(4000);
    expect(report.ponds.map((p) => p.pondId)).toEqual(['live']);
    expect(report.includedArchivedPonds).toBe(false);
  });
});

describe('getFinancialReport — inventory purchases (D2)', () => {
  const TX = [
    { type: 'expense', category: 'inventory', amount: 3000, inventoryItemId: 'item-1' },
    { type: 'expense', category: 'Feed', amount: 2000 },
    { type: 'income', category: 'Fish sales', amount: 9000 },
  ];

  it('includes them by default and reports the subtotal separately', async () => {
    const { service } = build({ transactions: TX });

    const report = await service.getFinancialReport('farm-1', 'user-1');

    expect(report.totalExpenses).toBe(5000);
    expect(report.inventoryExpenses).toBe(3000);
    expect(report.revenue).toBe(9000);
  });

  it('excludes them when false, and the subtotal goes to zero with them', async () => {
    const { service, transactionsService } = build({ transactions: TX });

    const report = await service.getFinancialReport('farm-1', 'user-1', {
      includeInventoryPurchases: false,
    });

    expect(transactionsService.findAll).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ includeInventoryPurchases: false }),
    );
    expect(report.totalExpenses).toBe(2000);
    // The subtotal describes what is INSIDE totalExpenses.
    expect(report.inventoryExpenses).toBe(0);
    expect(report.expensesByCategory).toEqual([
      { category: 'Feed', amount: 2000 },
    ]);
  });
});

describe('getFinancialReport — date range', () => {
  it('passes both bounds down to the cycle ledger and the transactions ledger', async () => {
    const { service, expensesService, transactionsService } = build();
    const range = { startDate: '2026-02-01', endDate: '2026-02-28' };

    await service.getFinancialReport('farm-1', 'user-1', range);

    expect(expensesService.getCycleFinancials).toHaveBeenCalledWith(
      'cycle-of-pond-1',
      'user-1',
      expect.objectContaining(range),
    );
    expect(transactionsService.findAll).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining(range),
    );
  });

  it('rejects an inverted range with 400 before any fan-out', async () => {
    const { service, pondsService } = build();

    await expect(
      service.getFinancialReport('farm-1', 'user-1', {
        startDate: '2026-03-01',
        endDate: '2026-02-01',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(pondsService.findAll).not.toHaveBeenCalled();
  });
});
