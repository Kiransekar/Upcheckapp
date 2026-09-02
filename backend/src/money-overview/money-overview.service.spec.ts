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
    findAll: jest.fn().mockResolvedValue(over.entries ?? [{ id: 'tx1' }]),
  };
  const credit = { list: jest.fn().mockResolvedValue(over.credit ?? []) };
  const svc = new MoneyOverviewService(
    farms as any,
    reports as any,
    transactions as any,
    credit as any,
  );
  return { svc, farms, reports, transactions, credit };
}

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

  it('returns nothing for a caller on no farms', async () => {
    const { svc, reports } = makeService({ farms: [] });

    const out = await svc.forUser('stranger');

    expect(out.farms).toEqual([]);
    expect(out.reports).toEqual({});
    expect(reports.getFinancialReport).not.toHaveBeenCalled();
  });
});
