/**
 * The Money tab's headline must count what the Money tab's own button writes.
 *
 * Reported as "the money is not showing stats like total properly". The report
 * aggregated the PER-CYCLE ledger only — expenses attached to a crop, revenue
 * from harvests — and never touched the `transactions` table. "Add entry" on
 * the Money screen writes a transaction, so a farmer recorded ₹50,000 of feed,
 * came back, and the headline still read ₹0 with the entries they had just
 * typed listed directly underneath it.
 */
import { ReportsService } from './reports.service';

const build = (opts: {
  cycleFinancials?: any[];
  transactions?: any[];
}) => {
  const pondsService = {
    findAll: jest.fn().mockResolvedValue({ data: [{ id: 'pond-1' }] }),
  } as any;
  const cropsService = {
    findAllAccessible: jest.fn().mockResolvedValue(
      (opts.cycleFinancials ?? []).map((_, i) => ({ id: `crop-${i}` })),
    ),
  } as any;
  const expensesService = {
    getCycleFinancials: jest
      .fn()
      .mockImplementation((cropId: string) =>
        Promise.resolve(opts.cycleFinancials![Number(cropId.split('-')[1])]),
      ),
  } as any;
  const transactionsService = {
    findAll: jest.fn().mockResolvedValue(opts.transactions ?? []),
  } as any;

  return new ReportsService(
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
};

describe('getFinancialReport', () => {
  it('counts transactions the farmer entered, not just cycle expenses', async () => {
    const service = build({
      cycleFinancials: [],
      transactions: [
        { type: 'expense', category: 'Feed', amount: 50000 },
        { type: 'income', category: 'Fish sales', amount: 80000 },
      ],
    });

    const report = await service.getFinancialReport('farm-1', 'user-1');

    expect(report.revenue).toBe(80000);
    expect(report.totalExpenses).toBe(50000);
    expect(report.profit).toBe(30000);
  });

  // The two ledgers are separate tables written by different screens; nothing
  // writes both from one action, so this is a sum and not a double count.
  it('adds the cycle ledger and the transaction ledger together', async () => {
    const service = build({
      cycleFinancials: [
        {
          totalRevenue: 100000,
          totalExpenses: 40000,
          expensesByCategory: { Seed: 40000 },
        },
      ],
      transactions: [{ type: 'expense', category: 'Feed', amount: 10000 }],
    });

    const report = await service.getFinancialReport('farm-1', 'user-1');

    expect(report.revenue).toBe(100000);
    expect(report.totalExpenses).toBe(50000);
    expect(report.expensesByCategory).toEqual(
      expect.arrayContaining([
        { category: 'Seed', amount: 40000 },
        { category: 'Feed', amount: 10000 },
      ]),
    );
  });

  it('merges a category that appears in both ledgers into one row', async () => {
    const service = build({
      cycleFinancials: [
        { totalRevenue: 0, totalExpenses: 4000, expensesByCategory: { Feed: 4000 } },
      ],
      transactions: [{ type: 'expense', category: 'Feed', amount: 6000 }],
    });

    const report = await service.getFinancialReport('farm-1', 'user-1');

    expect(report.expensesByCategory).toEqual([{ category: 'Feed', amount: 10000 }]);
  });

  // Postgres numeric columns come back as strings; adding one to a number
  // concatenates it, which would print a nonsense total rather than fail.
  it('coerces string amounts rather than concatenating them', async () => {
    const service = build({
      cycleFinancials: [],
      transactions: [
        { type: 'expense', category: 'Feed', amount: '1500.50' as any },
        { type: 'expense', category: 'Feed', amount: '500' as any },
      ],
    });

    const report = await service.getFinancialReport('farm-1', 'user-1');

    expect(report.totalExpenses).toBe(2000.5);
  });

  // A farm with no transactions endpoint available must still report its
  // cycles rather than failing the whole screen.
  it('still reports the cycle ledger when transactions cannot be read', async () => {
    const service = build({
      cycleFinancials: [
        { totalRevenue: 7000, totalExpenses: 1000, expensesByCategory: {} },
      ],
    });
    (service as any).transactionsService.findAll = jest
      .fn()
      .mockRejectedValue(new Error('boom'));

    const report = await service.getFinancialReport('farm-1', 'user-1');

    expect(report.revenue).toBe(7000);
    expect(report.totalExpenses).toBe(1000);
  });

  /**
   * One throwing crop used to reject the whole `Promise.all`, and the Money
   * tab's batching layer catches a failed report by dropping the FARM — so a
   * single bad cycle made an entire farm silently vanish from the tab. Degrade
   * the crop, keep the farm.
   */
  it('keeps the farm when one cycle cannot be read', async () => {
    const service = build({
      cycleFinancials: [
        { totalRevenue: 5000, totalExpenses: 1000, expensesByCategory: { Seed: 1000 } },
        null as any, // the crop that throws, wired below
      ],
      transactions: [],
    });
    const original = (service as any).expensesService.getCycleFinancials;
    (service as any).expensesService.getCycleFinancials = jest
      .fn()
      .mockImplementation(async (cropId: string) => {
        // Async, like the real service: a manager 403s inside a promise.
        if (cropId === 'crop-1') throw new Error('Forbidden');
        return original(cropId);
      });

    const report = await service.getFinancialReport('farm-1', 'user-1');

    expect(report.revenue).toBe(5000);
    expect(report.totalExpenses).toBe(1000);
  });

  it('keeps the farm when one pond cannot be listed', async () => {
    const service = build({
      cycleFinancials: [
        { totalRevenue: 5000, totalExpenses: 1000, expensesByCategory: {} },
      ],
      transactions: [{ type: 'income', category: 'Fish sales', amount: 2000 }],
    });
    (service as any).cropsService.findAllAccessible = jest
      .fn()
      .mockRejectedValue(new Error('Forbidden'));

    const report = await service.getFinancialReport('farm-1', 'user-1');

    // The cycle ledger is lost, but the farm still reports — and still shows
    // the transactions ledger — instead of disappearing from the Money tab.
    expect(report.revenue).toBe(2000);
    expect(report.profit).toBe(2000);
  });
});
