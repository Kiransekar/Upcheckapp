import { ReportsService } from './reports.service';

/**
 * DATE-1 — getCycleAnalysis's growthChart buckets each sampling by IST-local
 * calendar day (via toIstDateString), not UTC. This exercises the actual
 * report code path (not just the pure toIstDateString helper, which already
 * has its own spec in ../common/ist-date.spec.ts) so a future regression that
 * swaps back to `new Date(...).toISOString().split('T')[0]` here is caught.
 */
describe('ReportsService.getCycleAnalysis — IST day bucketing (DATE-1)', () => {
  const buildService = (samplingDate: string) => {
    const cropsService = {
      findOne: jest.fn().mockResolvedValue({ id: 'crop-1', pondId: 'pond-1' }),
    } as any;
    const samplingService = {
      findAll: jest.fn().mockResolvedValue([
        { samplingDate, mbwG: 12.5, srEstimationPercent: 90 },
      ]),
    } as any;
    const harvestsService = { findAll: jest.fn().mockResolvedValue([]) } as any;
    const feedRecordsService = {
      getTotalFeedByPond: jest.fn().mockResolvedValue(0),
      getDailyFeedUsage: jest.fn(),
    } as any;
    const service = new ReportsService(
      {} as any, // pondsService
      {} as any, // inventoryService
      feedRecordsService,
      harvestsService,
      {} as any, // expensesService
      samplingService,
      cropsService,
      {} as any, // farmAccess
      {} as any, // transactionsService
    );
    return service;
  };

  it('keeps a pre-05:30-IST sampling on its own IST calendar date, not the UTC date', async () => {
    // 2026-06-16T20:30:00.000Z === 2026-06-17 02:00 IST. Naive UTC bucketing
    // would misfile this sample under 2026-06-16.
    const service = buildService('2026-06-16T20:30:00.000Z');

    const result = await service.getCycleAnalysis('crop-1', 'user-1');

    expect(result.growthChart).toHaveLength(1);
    expect(result.growthChart[0].date).toBe('2026-06-17');
    expect(result.growthChart[0].date).not.toBe('2026-06-16');
  });

  it('matches UTC when the sampling instant is already the same IST/UTC day', async () => {
    const service = buildService('2026-06-17T09:00:00.000Z');

    const result = await service.getCycleAnalysis('crop-1', 'user-1');

    expect(result.growthChart[0].date).toBe('2026-06-17');
  });
});

/**
 * The dashboard summary used to sit behind a 300s Redis TTL that nothing ever
 * invalidated, so a farmer who logged feed kept seeing the pre-log number for
 * up to five minutes. It reads through every time now — this pins that.
 */
describe('ReportsService.getDashboardSummary — always live', () => {
  const build = (feedUsage: jest.Mock) =>
    new ReportsService(
      {
        countActivePonds: jest.fn().mockResolvedValue(2),
        countTotalPonds: jest.fn().mockResolvedValue(3),
      } as any,
      { countLowStock: jest.fn().mockResolvedValue(0) } as any,
      { getDailyFeedUsage: feedUsage } as any,
      {} as any, // harvestsService
      {} as any, // expensesService
      {} as any, // samplingService
      {} as any, // cropsService
      { assertCanAccessFarm: jest.fn().mockResolvedValue({}) } as any,
      {} as any, // transactionsService
    );

  it('reflects feed logged between two reads', async () => {
    const feedUsage = jest
      .fn()
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(25);
    const service = build(feedUsage);

    expect((await service.getDashboardSummary('u1', 'f1')).todayFeedUsage).toBe(
      10,
    );
    expect((await service.getDashboardSummary('u1', 'f1')).todayFeedUsage).toBe(
      25,
    );
    expect(feedUsage).toHaveBeenCalledTimes(2);
  });

  it('still refuses a farm the caller cannot read', async () => {
    const assertCanAccessFarm = jest
      .fn()
      .mockRejectedValue(new Error('forbidden'));
    const service = new ReportsService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      { assertCanAccessFarm } as any,
      {} as any,
    );

    await expect(service.getDashboardSummary('u1', 'f1')).rejects.toThrow(
      'forbidden',
    );
  });
});
