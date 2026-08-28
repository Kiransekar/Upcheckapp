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

/** AUDIT id 143: liveBriefing fans per-pond context fetches out, not N+1. */
describe('EngineAlertService.liveBriefing', () => {
  it('fetches contexts for all active ponds and skips a pond that errors', async () => {
    const ponds = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];
    const pondRepo = { find: jest.fn().mockResolvedValue(ponds) };
    const getContext = jest.fn((pondId: string) =>
      pondId === 'p2'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ ...baseCtx, pondId }),
    );
    const pondContext = { getContext };
    const alertCenter = { buildBriefing: jest.fn((drafts) => drafts) };
    const farmAccess = {
      getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-1']),
    };

    const svc = new EngineAlertService(
      pondRepo as any,
      pondContext as any,
      new LunarService(),
      alertCenter as any,
      farmAccess as any,
    );

    await svc.liveBriefing('user-1');

    // All 3 ponds fetched (fanned out), including the one that errors.
    expect(getContext).toHaveBeenCalledTimes(3);
    expect(getContext).toHaveBeenCalledWith('p1', 'user-1');
    expect(getContext).toHaveBeenCalledWith('p2', 'user-1');
    expect(getContext).toHaveBeenCalledWith('p3', 'user-1');
  });
});

/**
 * `today` exists so the home screen stops computing every pond context twice
 * — once for the briefing, once via /pond-context. It must return the same
 * briefing liveBriefing does, off ONE pass over the contexts.
 */
describe('EngineAlertService.today', () => {
  const build = (getContext: jest.Mock) => {
    const pondRepo = {
      find: jest.fn().mockResolvedValue([{ id: 'p1' }, { id: 'p2' }]),
    };
    return new EngineAlertService(
      pondRepo as any,
      { getContext } as any,
      new LunarService(),
      { buildBriefing: jest.fn((drafts) => drafts) } as any,
      {
        getAccessibleFarmIds: jest.fn().mockResolvedValue(['farm-1']),
      } as any,
    );
  };

  it('returns the contexts alongside the briefing, computing each once', async () => {
    const getContext = jest.fn((pondId: string) =>
      Promise.resolve({ ...baseCtx, pondId }),
    );
    const svc = build(getContext);

    const { contexts, briefing } = await svc.today('user-1');

    expect(contexts.map((c) => c.pondId)).toEqual(['p1', 'p2']);
    expect(getContext).toHaveBeenCalledTimes(2);
    // Same body live-briefing would have returned for the same data.
    expect(briefing).toEqual(await svc.liveBriefing('user-1'));
  });

  it('surfaces a pond alert in the briefing and its context in the same response', async () => {
    // A pond over the free-ammonia threshold: the alert and the numbers it was
    // derived from have to travel together, or the screen renders one without
    // the other.
    const getContext = jest.fn((pondId: string) =>
      Promise.resolve({ ...baseCtx, pondId, freeAmmoniaMgL: 0.5 }),
    );
    const svc = build(getContext);

    const { contexts, briefing } = await svc.today('user-1');

    expect(briefing.length).toBeGreaterThan(0);
    expect(contexts).toHaveLength(2);
    for (const item of briefing) {
      expect(contexts.some((c) => c.pondId === item.pondId)).toBe(true);
    }
  });

  it('drops a pond whose context fails rather than failing the whole screen', async () => {
    const getContext = jest.fn((pondId: string) =>
      pondId === 'p2'
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ ...baseCtx, pondId }),
    );
    const svc = build(getContext);

    const { contexts } = await svc.today('user-1');

    expect(contexts.map((c) => c.pondId)).toEqual(['p1']);
  });
});
