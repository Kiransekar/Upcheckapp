import { WaterQualityService } from './water-quality.service';

/**
 * Per-column latest (§4.6) and the weekly-chemistry filter (§4.5).
 *
 * The point of both is the same fact about how farmers log: probe readings are
 * daily, chemistry is weekly, so the newest ROW is not the newest VALUE of most
 * columns. `/latest` must date each column honestly, and the chemistry history
 * must not be padded with probe-only rows.
 */
function makeService(records: any[]) {
  const repo = {
    find: jest.fn().mockResolvedValue(records),
    findAndCount: jest.fn().mockResolvedValue([records, records.length]),
  };
  const ponds = { verifyAccess: jest.fn().mockResolvedValue(undefined) };
  const service = new WaterQualityService(
    repo as any,
    ponds as any,
    {} as any,
    {} as any,
  );
  return { service, repo, ponds };
}

describe('WaterQualityService.getLatestPerColumn', () => {
  const TODAY = new Date('2026-09-04T06:00:00Z');
  const LAST_WEEK = new Date('2026-08-28T06:00:00Z');

  it('dates each column by the record it actually came from', async () => {
    const { service, ponds } = makeService([
      { recordedAt: TODAY, ph: 7.8, dissolvedOxygen: 5.1, alkalinity: null },
      { recordedAt: LAST_WEEK, ph: 7.2, alkalinity: 120 },
    ]);

    const out = await service.getLatestPerColumn('pond-1', 'u1');

    expect(ponds.verifyAccess).toHaveBeenCalledWith('pond-1', 'u1', 'READ');
    expect(out.ph).toBe(7.8);
    expect(out.phAsOf).toBe(TODAY.toISOString());
    // Carried forward from last week — and says so, so the client can decide
    // whether it is still fit to prefill.
    expect(out.alkalinity).toBe(120);
    expect(out.alkalinityAsOf).toBe(LAST_WEEK.toISOString());
    expect(out.recordedAt).toBe(TODAY.toISOString());
  });

  it('returns nulls, not a throw, for a pond with no readings', async () => {
    const { service } = makeService([]);

    const out = await service.getLatestPerColumn('pond-1', 'u1');

    expect(out.recordedAt).toBeNull();
    expect(out.ammonia).toBeNull();
    expect(out.ammoniaAsOf).toBeNull();
  });
});

describe('WaterQualityService.findAll — chemistryOnly', () => {
  it('asks for rows carrying at least one chemistry parameter', async () => {
    const { service, repo } = makeService([]);

    await service.findAll('pond-1', 'u1', undefined, true);

    const where = repo.findAndCount.mock.calls[0][0].where;
    expect(Array.isArray(where)).toBe(true); // OR across the six columns
    expect(where.map((w: any) => Object.keys(w)[1])).toEqual([
      'ammonia',
      'nitrite',
      'nitrate',
      'alkalinity',
      'hardness',
      'transparency',
    ]);
  });

  it('is unchanged without the flag', async () => {
    const { service, repo } = makeService([]);

    await service.findAll('pond-1', 'u1');

    expect(repo.findAndCount.mock.calls[0][0].where).toEqual({
      pondId: 'pond-1',
    });
  });
});
