import { EngineAlertService } from './engine-alert.service';
import { LunarService } from '../lunar/lunar.service';

function makeService() {
  return new EngineAlertService(
    null as any, // pondRepo (unused by evaluate)
    null as any, // pondContext
    new LunarService(),
    null as any, // alertCenter
    null as any, // farmAccess (unused by evaluate)
  );
}

const baseCtx: any = {
  pondId: 'p1',
  waterQuality: { dissolvedOxygen: 6, ph: 8, temperature: 30 },
  freeAmmoniaMgL: null,
  abwG: null,
  runningFcr: null,
};

describe('EngineAlertService.evaluate', () => {
  const svc = makeService();

  it('emits a critical ammonia alert when free NH3 is toxic', () => {
    const drafts = svc.evaluate({ ...baseCtx, freeAmmoniaMgL: 0.45 });
    const a = drafts.find((d) => d.source === 'water');
    expect(a?.severity).toBe('critical');
    expect(a?.title).toMatch(/ammonia/i);
    expect(a?.steps.length).toBeGreaterThan(0);
  });

  it('emits a low-DO alert (critical under 3, watch under 4)', () => {
    expect(
      svc
        .evaluate({ ...baseCtx, waterQuality: { dissolvedOxygen: 2.5 } })
        .find((d) => d.source === 'aeration')?.severity,
    ).toBe('critical');
    expect(
      svc
        .evaluate({ ...baseCtx, waterQuality: { dissolvedOxygen: 3.6 } })
        .find((d) => d.source === 'aeration')?.severity,
    ).toBe('watch');
    // Healthy DO → no aeration alert.
    expect(
      svc
        .evaluate({ ...baseCtx, waterQuality: { dissolvedOxygen: 6 } })
        .find((d) => d.source === 'aeration'),
    ).toBeUndefined();
  });

  it('flags poor feed efficiency when running FCR is high', () => {
    expect(
      svc
        .evaluate({ ...baseCtx, runningFcr: 2.1 })
        .find((d) => d.source === 'feed')?.severity,
    ).toBe('watch');
    expect(
      svc
        .evaluate({ ...baseCtx, runningFcr: 1.3 })
        .find((d) => d.source === 'feed'),
    ).toBeUndefined();
  });

  it('emits nothing when everything is healthy', () => {
    expect(svc.evaluate(baseCtx)).toEqual([]);
  });
});

/**
 * activeContexts backs BOTH /alert-center/live-briefing and /alert-center/today.
 *
 * It used to fetch each pond's context individually, in batches of five — a
 * limit chosen when the connection pool was 5. At ~7 queries per pond a
 * 43-pond account meant ~300 statements in nine sequential batches, each a
 * round trip to Supabase in Singapore from a backend in Oregon, so this one
 * method took 10-15s and tripped the client's 15s timeout. Since it runs on
 * both endpoints, it made Today, the pond page and Money slow at once.
 *
 * It now builds every context in ONE set-based pass.
 */
const buildSvc = (over: any = {}) => {
  const buildContextsFor = over.buildContextsFor
    ?? jest.fn(async (ids: string[]) => ids.map((pondId) => ({ ...baseCtx, pondId })));
  const allPonds = over.ponds ?? [{ id: 'p1' }, { id: 'p2' }];
  const pondRepo = {
    // Honour the id filter the way the database would, so the scope test below
    // is testing the scoping rather than the mock.
    find: jest.fn(async (opts: any) => {
      const ids = opts?.where?.id?.value ?? opts?.where?.id?._value ?? null;
      return ids ? allPonds.filter((p: any) => ids.includes(p.id)) : allPonds;
    }),
  };
  const farmAccess = {
    getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-1']),
    getAccessiblePondIds: jest
      .fn()
      .mockResolvedValue(over.readablePonds ?? ['p1', 'p2']),
  };
  const svc = new EngineAlertService(
    pondRepo as any,
    { buildContextsFor } as any,
    new LunarService(),
    { buildBriefing: jest.fn((drafts) => drafts) } as any,
    farmAccess as any,
  );
  return { svc, buildContextsFor, pondRepo, farmAccess };
};

describe('EngineAlertService.activeContexts', () => {
  it('builds every pond context in ONE call, not one per pond', async () => {
    const { svc, buildContextsFor } = buildSvc({
      ponds: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }],
      readablePonds: ['p1', 'p2', 'p3'],
    });

    await svc.liveBriefing('user-1');

    // The invariant that matters: work does not scale with pond count.
    expect(buildContextsFor).toHaveBeenCalledTimes(1);
    expect(buildContextsFor).toHaveBeenCalledWith(['p1', 'p2', 'p3']);
  });

  /**
   * Per-POND scope, not just farm scope. This used to rely on getContext's own
   * check refusing and the error being swallowed; building in bulk means the
   * pond set has to be resolved through the access layer up front instead.
   */
  it("never builds a context for a pond outside the caller scope", async () => {
    const { svc, buildContextsFor, pondRepo } = buildSvc({
      readablePonds: ['p1'],
    });

    await svc.liveBriefing('scoped-worker');

    expect(pondRepo.find).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: expect.anything() }) }),
    );
    const asked = buildContextsFor.mock.calls[0][0];
    expect(asked).not.toContain('p2');
  });

  it('returns nothing, and asks for nothing, when no pond is readable', async () => {
    const { svc, buildContextsFor } = buildSvc({ readablePonds: [] });

    expect(await svc.liveBriefing('stranger')).toEqual([]);
    expect(buildContextsFor).not.toHaveBeenCalled();
  });
});

describe('EngineAlertService.today', () => {
  it('returns the contexts alongside the briefing, computing each once', async () => {
    const { svc, buildContextsFor } = buildSvc();

    const { contexts, briefing } = await svc.today('user-1');

    expect(contexts.map((c) => c.pondId)).toEqual(['p1', 'p2']);
    expect(buildContextsFor).toHaveBeenCalledTimes(1);
    // Same body live-briefing would have returned for the same data.
    expect(briefing).toEqual(await buildSvc().svc.liveBriefing('user-1'));
  });

  it('surfaces a pond alert in the briefing and its context in the same response', async () => {
    // A pond over the free-ammonia threshold: the alert and the numbers it was
    // derived from have to travel together, or the screen renders one without
    // the other.
    const { svc } = buildSvc({
      buildContextsFor: jest.fn(async (ids: string[]) =>
        ids.map((pondId) => ({ ...baseCtx, pondId, freeAmmoniaMgL: 0.5 })),
      ),
    });

    const { contexts, briefing } = await svc.today('user-1');

    expect(briefing.length).toBeGreaterThan(0);
    expect(contexts).toHaveLength(2);
    for (const item of briefing) {
      expect(contexts.some((c) => c.pondId === item.pondId)).toBe(true);
    }
  });
});
