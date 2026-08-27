import { ForbiddenException } from '@nestjs/common';
import { PondContextService } from './pond-context.service';
import { ShrimpCalculationsService } from '../shrimp-calculations/shrimp-calculations.service';

function makeService(
  over: {
    pond?: any;
    crop?: any;
    wqRecords?: any[];
    sampling?: any;
    deaths?: any[];
    feeds?: any[];
    tray?: any;
    accessiblePonds?: string[];
    accessibleFarms?: string[];
  } = {},
) {
  const samplingRepo = {
    findOne: jest.fn().mockResolvedValue(over.sampling ?? null),
  };
  // getContext now sums via SQL (SUM/MAX) instead of loading rows — mock the
  // aggregate query builders to return the same total the row arrays imply.
  const mortalityTotal = (over.deaths ?? []).reduce(
    (a: number, d: any) => a + (Number(d.estimatedTotal) || 0),
    0,
  );
  const mortalityRepo = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: mortalityTotal }),
    })),
  };
  const feedTotal = (over.feeds ?? []).reduce(
    (a: number, f: any) => a + (Number(f.quantityKg) || 0),
    0,
  );
  const feedLastAt = (over.feeds ?? []).reduce(
    (latest: string | null, f: any) =>
      f.recordedAt && (!latest || f.recordedAt > latest)
        ? f.recordedAt
        : latest,
    null,
  );
  const feedRepo = {
    createQueryBuilder: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getRawOne: jest
        .fn()
        .mockResolvedValue({ totalFeed: feedTotal, lastFeedAt: feedLastAt }),
    })),
  };
  const trayRepo = { findOne: jest.fn().mockResolvedValue(over.tray ?? null) };
  const wqRepo = { find: jest.fn().mockResolvedValue(over.wqRecords ?? []) };
  // Pond context is a dashboard read: it goes through the member-aware
  // helpers at READ, not the owner-only / financial-strict variants.
  const pondsService = {
    findOneAccessible: jest
      .fn()
      .mockResolvedValue(
        over.pond ?? { id: 'p1', calculatedAreaM2: 4000, activeCycleId: 'c1' },
      ),
  };
  const cropsService = {
    findOneForVerifiedPond: jest.fn().mockResolvedValue(over.crop ?? null),
  };
  const farmAccess = {
    getAccessiblePondIds: jest.fn().mockResolvedValue(over.accessiblePonds ?? []),
    getAccessibleFarmIds: jest.fn().mockResolvedValue(over.accessibleFarms ?? []),
  };
  const svc = new PondContextService(
    samplingRepo as any,
    mortalityRepo as any,
    feedRepo as any,
    trayRepo as any,
    wqRepo as any,
    pondsService as any,
    cropsService as any,
    new ShrimpCalculationsService(),
    farmAccess as any,
  );
  return { svc, pondsService, cropsService, farmAccess };
}

describe('PondContextService', () => {
  it('estimates live population as stocking − cumulative mortality (≥0)', () => {
    const { svc } = makeService();
    expect(svc.estimateLivePopulation(400000, 40000)).toBe(360000);
    expect(svc.estimateLivePopulation(100000, 200000)).toBe(0); // clamp
    expect(svc.estimateLivePopulation(null, 0)).toBeNull();
  });

  it('computes biomass = population × ABW / 1000', () => {
    const { svc } = makeService();
    expect(svc.biomass(120000, 25)).toBe(3000);
    expect(svc.biomass(null, 25)).toBeNull();
  });

  it('computes running FCR = cumulative feed / biomass', () => {
    const { svc } = makeService();
    expect(svc.runningFcr(3681, 3000)).toBe(1.23); // ~1.227 rounded
    expect(svc.runningFcr(100, 0)).toBeNull();
    expect(svc.runningFcr(100, null)).toBeNull();
  });

  it('scores data confidence by completeness + freshness', () => {
    const { svc } = makeService();
    const factor = (
      key: string,
      present: boolean,
      ageDays: number | null,
      weight: number,
      w: number,
    ) => ({ key, present, ageDays, weight, freshWindowDays: w });

    // All present and fresh → high.
    const all = svc.computeConfidence([
      factor('DO', true, 0, 2, 1),
      factor('pH', true, 0, 1.5, 1),
      factor('Ammonia', true, 3, 2, 10),
      factor('ABW', true, 5, 2, 14),
    ]);
    expect(all.score).toBe(100);
    expect(all.band).toBe('high');
    expect(all.missing).toEqual([]);

    // Ammonia missing + ABW very stale → lower band, flagged.
    const partial = svc.computeConfidence([
      factor('DO', true, 0, 2, 1),
      factor('pH', true, 0, 1.5, 1),
      factor('Ammonia', false, null, 2, 10),
      factor('ABW', true, 40, 2, 14),
    ]);
    expect(partial.score).toBeLessThan(75);
    expect(partial.missing).toContain('Ammonia');
    expect(partial.stale).toContain('ABW');
  });

  it('surfaces cumulative feed, running FCR and latest tray residue', async () => {
    const { svc } = makeService({
      crop: {
        stockingCount: 100000,
        get computedDOC() {
          return 50;
        },
      },
      sampling: { mbwG: 25 },
      feeds: [{ quantityKg: 1500 }, { quantityKg: 1200 }, { quantityKg: 981 }],
      tray: { remainingFeedStatus: 'a_lot_left', checkDate: '2026-06-13' },
    });
    const ctx = await svc.getContext('p1', 'u');
    // biomass = 100000 × 25 / 1000 = 2500 kg; cumFeed = 3681 kg → FCR ≈ 1.47
    expect(ctx.cumulativeFeedKg).toBe(3681);
    expect(ctx.runningFcr).toBeCloseTo(1.47, 1);
    expect(ctx.latestTrayResidue).toBe('a_lot_left');
  });

  it('assembles the latest-log snapshot the engines consume', async () => {
    const { svc } = makeService({
      pond: {
        id: 'p1',
        calculatedAreaM2: 4000,
        overrideAreaM2: null,
        activeCycleId: 'c1',
      },
      crop: {
        stockingCount: 400000,
        carryingCapacityKgM2: 1.25,
        feedPriceRpPerKg: 95,
        targetSrPercent: 75,
        targetSize: 40,
        targetCultivationDays: 120,
        get computedDOC() {
          return 60;
        },
      },
      wqRecords: [
        {
          dissolvedOxygen: 3.8,
          ph: 8.1,
          temperature: 31,
          salinity: 18,
          ammonia: 2,
          nitrite: 0.1,
          alkalinity: 130,
          recordedAt: '2026-06-13T06:00:00.000Z',
        },
      ],
      sampling: { mbwG: 22 },
      deaths: [{ estimatedTotal: 30000 }, { estimatedTotal: 10000 }],
    });

    const ctx = await svc.getContext('p1', 'u');
    expect(ctx.areaM2).toBe(4000);
    expect(ctx.cropId).toBe('c1');
    expect(ctx.abwG).toBe(22);
    expect(ctx.livePopulation).toBe(360000); // 400000 − 40000
    expect(ctx.biomassKg).toBe(7920); // 360000 × 22 / 1000
    expect(ctx.waterQuality?.dissolvedOxygen).toBe(3.8);
    expect(ctx.freeAmmoniaMgL).toBeGreaterThan(0); // derived from TAN+pH+temp
    expect(ctx.crop?.feedPriceRpPerKg).toBe(95);
    expect(ctx.doc).toBe(60);
  });

  it('carries chemistry forward: daily DO/pH/temp from today, ammonia from an earlier test-kit entry', async () => {
    const { svc } = makeService({
      // Newest first: today is a probe-only entry (ammonia null); ammonia was
      // last measured 4 days ago in a chemistry entry.
      wqRecords: [
        {
          dissolvedOxygen: 5.2,
          ph: 8.0,
          temperature: 30,
          salinity: 17,
          ammonia: null,
          nitrite: null,
          nitrate: null,
          alkalinity: null,
          recordedAt: '2026-06-13T06:00:00.000Z',
        },
        {
          dissolvedOxygen: 4.9,
          ph: 7.9,
          temperature: 29.5,
          salinity: 17,
          ammonia: 1.5,
          nitrite: 0.2,
          nitrate: 5,
          alkalinity: 120,
          recordedAt: '2026-06-09T07:00:00.000Z',
        },
      ],
    });
    const ctx = await svc.getContext('p1', 'u');
    expect(ctx.waterQuality?.dissolvedOxygen).toBe(5.2); // today's probe value
    expect(ctx.waterQuality?.ammonia).toBe(1.5); // carried forward from Jun 9
    expect(ctx.waterQuality?.nitrate).toBe(5); // carried forward
    expect(ctx.waterQuality?.recordedAt).toBe('2026-06-13T06:00:00.000Z');
    expect(ctx.waterQuality?.chemistryAsOf).toBe('2026-06-09T07:00:00.000Z');
    expect(ctx.freeAmmoniaMgL).toBeGreaterThan(0); // uses carried ammonia + today's pH/temp
  });

  it('degrades gracefully when nothing is logged yet', async () => {
    const { svc } = makeService({
      pond: { id: 'p1', calculatedAreaM2: 4000, activeCycleId: null },
    });
    const ctx = await svc.getContext('p1', 'u');
    expect(ctx.cropId).toBeNull();
    expect(ctx.waterQuality).toBeNull();
    expect(ctx.abwG).toBeNull();
    expect(ctx.livePopulation).toBeNull();
    expect(ctx.freeAmmoniaMgL).toBeNull();
  });
});

/**
 * getFarmContexts is the redesign's one-request replacement for N per-pond
 * calls. The thing worth pinning is that batching did NOT loosen access: it
 * asks FarmAccessService which ponds the caller may READ and never widens
 * that set.
 */
describe('PondContextService.getFarmContexts', () => {
  it('returns a snapshot per accessible pond, in one call', async () => {
    const { svc, pondsService } = makeService({
      accessiblePonds: ['p1', 'p2', 'p3'],
    });

    const ctxs = await svc.getFarmContexts('farm-1', 'u');

    expect(ctxs).toHaveLength(3);
    expect(pondsService.findOneAccessible).toHaveBeenCalledTimes(3);
    // Every snapshot went through the per-pond READ check, not a bulk query
    // that skips it.
    for (const id of ['p1', 'p2', 'p3']) {
      expect(pondsService.findOneAccessible).toHaveBeenCalledWith(id, 'u', 'READ');
    }
  });

  it('asks the access layer for the pond set — never the farm wholesale', async () => {
    const { svc, farmAccess } = makeService({ accessiblePonds: ['p1'] });

    await svc.getFarmContexts('farm-1', 'u');

    expect(farmAccess.getAccessiblePondIds).toHaveBeenCalledWith(
      'u',
      'farm-1',
      'READ',
    );
  });

  it('returns nothing for someone with no access to the farm', async () => {
    // A pond-scoped worker on another farm, or a non-member: the access layer
    // hands back an empty set and no pond is ever read.
    const { svc, pondsService } = makeService({ accessiblePonds: [] });

    expect(await svc.getFarmContexts('farm-1', 'stranger')).toEqual([]);
    expect(pondsService.findOneAccessible).not.toHaveBeenCalled();
  });

  it('drops a pond that fails rather than failing the whole farm', async () => {
    const { svc, pondsService } = makeService({
      accessiblePonds: ['ok', 'gone'],
    });
    pondsService.findOneAccessible.mockImplementation((id: string) =>
      id === 'gone'
        ? Promise.reject(new Error('deleted mid-flight'))
        : Promise.resolve({ id, calculatedAreaM2: 4000, activeCycleId: null }),
    );

    const ctxs = await svc.getFarmContexts('farm-1', 'u');

    expect(ctxs).toHaveLength(1);
    expect(ctxs[0].pondId).toBe('ok');
  });

  it('chunks a large farm instead of putting every query in flight at once', async () => {
    // 14 ponds × ~6 queries each would be ~84 concurrent statements.
    const ids = Array.from({ length: 14 }, (_, i) => `p${i}`);
    const { svc, pondsService } = makeService({ accessiblePonds: ids });

    let inFlight = 0;
    let peak = 0;
    pondsService.findOneAccessible.mockImplementation((id: string) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      return new Promise((resolve) =>
        setImmediate(() => {
          inFlight -= 1;
          resolve({ id, calculatedAreaM2: 4000, activeCycleId: null });
        }),
      );
    });

    const ctxs = await svc.getFarmContexts('farm-1', 'u');

    expect(ctxs).toHaveLength(14);
    expect(peak).toBeLessThanOrEqual(6);
  });
});

/**
 * getContext used to READ-check the pond, then read the crop through
 * `cropsService.findOneAccessible`, which re-fetched and re-checked that same
 * pond. Dropping the second check must not drop the FIRST one — that one is
 * the whole gate.
 */
describe('PondContextService.getContext — access', () => {
  it('propagates the pond READ refusal instead of returning a context', async () => {
    const { svc, pondsService, cropsService } = makeService();
    pondsService.findOneAccessible.mockRejectedValue(
      new ForbiddenException('nope'),
    );

    await expect(svc.getContext('p1', 'worker')).rejects.toThrow(
      ForbiddenException,
    );
    // And it must not have gone on to read the crop anyway.
    expect(cropsService.findOneForVerifiedPond).not.toHaveBeenCalled();
  });

  it('hands the crop read the pond it just cleared, so it is not re-checked', async () => {
    const { svc, cropsService } = makeService({
      pond: { id: 'p1', calculatedAreaM2: 4000, activeCycleId: 'c1' },
      crop: { id: 'c1', pondId: 'p1', stockingCount: 100000 },
    });

    await svc.getContext('p1', 'u');

    expect(cropsService.findOneForVerifiedPond).toHaveBeenCalledWith(
      'c1',
      'p1',
      'u',
    );
  });

  it('drops a pond the caller cannot read from a farm-wide fetch, without failing the rest', async () => {
    const { svc, pondsService } = makeService({
      accessiblePonds: ['ok', 'denied'],
    });
    pondsService.findOneAccessible.mockImplementation((id: string) =>
      id === 'denied'
        ? Promise.reject(new ForbiddenException('nope'))
        : Promise.resolve({ id, calculatedAreaM2: 4000, activeCycleId: null }),
    );

    const ctxs = await svc.getFarmContexts('farm-1', 'worker');

    expect(ctxs.map((c) => c.pondId)).toEqual(['ok']);
  });
});

/** `?scope=mine` — every readable pond across every farm, one request. */
describe('PondContextService.getMyContexts', () => {
  it('covers every accessible farm, one farm at a time', async () => {
    const { svc, farmAccess, pondsService } = makeService({
      accessibleFarms: ['farm-1', 'farm-2'],
    });
    farmAccess.getAccessiblePondIds.mockImplementation(
      async (_u: string, farmId: string) =>
        farmId === 'farm-1' ? ['p1', 'p2'] : ['p3'],
    );
    pondsService.findOneAccessible.mockImplementation((id: string) =>
      Promise.resolve({ id, calculatedAreaM2: 4000, activeCycleId: null }),
    );

    const ctxs = await svc.getMyContexts('u');

    expect(ctxs.map((c) => c.pondId)).toEqual(['p1', 'p2', 'p3']);
  });

  it('returns nothing for a user on no farms', async () => {
    const { svc, farmAccess } = makeService({ accessibleFarms: [] });

    await expect(svc.getMyContexts('nobody')).resolves.toEqual([]);
    expect(farmAccess.getAccessiblePondIds).not.toHaveBeenCalled();
  });
});
