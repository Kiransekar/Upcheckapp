import type { PondContext } from '../../api/pondContext';
import {
    slotAt, pondSlotDone, pondFedThisSession, chemistryDone, progressFor,
    pondFreshness, STALE_AFTER_MS, NO_DATA_AFTER_MS,
} from '../logProgress';

const at = (iso: string) => new Date(iso);

const ctx = (over: Partial<PondContext>): PondContext =>
    ({
        pondId: 'p1', farmId: 'f1', cropId: 'c1', species: null, areaM2: null,
        installedAeratorHp: null, doc: 10, waterQuality: null,
        freeAmmoniaMgL: null, abwG: null, livePopulation: null, biomassKg: null,
        crop: null, cumulativeFeedKg: null, runningFcr: null,
        latestTrayResidue: null, lastFeedAt: null, lastTrayAt: null,
        samplingAt: null,
        confidence: { score: 0, band: 'low', missing: [], stale: [] },
        ...over,
    }) as PondContext;

const wq = (recordedAt: string | null) =>
    ({ dissolvedOxygen: 6, ph: 8, temperature: 30, salinity: 15,
       ammonia: null, nitrite: null, nitrate: null, alkalinity: null,
       recordedAt, chemistryAsOf: null }) as PondContext['waterQuality'];

describe('slotAt', () => {
    it('maps the day into three windows', () => {
        expect(slotAt(at('2026-09-02T05:00:00'))).toBe('morning');
        expect(slotAt(at('2026-09-02T11:59:00'))).toBe('morning');
        expect(slotAt(at('2026-09-02T12:00:00'))).toBe('afternoon');
        expect(slotAt(at('2026-09-02T16:59:00'))).toBe('afternoon');
        expect(slotAt(at('2026-09-02T17:00:00'))).toBe('evening');
        expect(slotAt(at('2026-09-02T23:59:00'))).toBe('evening');
    });

    // Midnight must land in morning, not roll off the end of the table.
    it('puts the small hours in the morning window', () => {
        expect(slotAt(at('2026-09-02T00:00:00'))).toBe('morning');
    });
});

describe('pondSlotDone', () => {
    const now = at('2026-09-02T09:00:00');

    it('is false when nothing was ever logged', () => {
        expect(pondSlotDone(ctx({ waterQuality: null }), 'morning', now)).toBe(false);
    });

    it('is true for a reading inside this slot today', () => {
        const c = ctx({ waterQuality: wq('2026-09-02T07:15:00') });
        expect(pondSlotDone(c, 'morning', now)).toBe(true);
    });

    // The whole point: yesterday's reading must not silence today's reminder.
    it('is false for the same slot yesterday', () => {
        const c = ctx({ waterQuality: wq('2026-09-01T07:15:00') });
        expect(pondSlotDone(c, 'morning', now)).toBe(false);
    });

    it('is false for a reading in a different slot today', () => {
        const c = ctx({ waterQuality: wq('2026-09-02T13:30:00') });
        expect(pondSlotDone(c, 'morning', now)).toBe(false);
    });

    it('counts a reading exactly on the slot boundary as inside it', () => {
        const c = ctx({ waterQuality: wq('2026-09-02T12:00:00') });
        expect(pondSlotDone(c, 'afternoon', now)).toBe(true);
    });
});

describe('pondFedThisSession', () => {
    const now = at('2026-09-02T09:00:00');

    it('is true when feed was logged in this slot today', () => {
        expect(pondFedThisSession(ctx({ lastFeedAt: '2026-09-02T08:00:00' }), 'morning', now)).toBe(true);
    });

    it('is false when the pond has never been fed', () => {
        expect(pondFedThisSession(ctx({ lastFeedAt: null }), 'morning', now)).toBe(false);
    });
});

describe('chemistryDone', () => {
    const now = at('2026-09-08T09:00:00');

    it('is true within the last seven days', () => {
        const c = ctx({ waterQuality: { ...wq(null)!, chemistryAsOf: '2026-09-03T09:00:00' } });
        expect(chemistryDone(c, now)).toBe(true);
    });

    it('is false once it is older than a week', () => {
        const c = ctx({ waterQuality: { ...wq(null)!, chemistryAsOf: '2026-08-25T09:00:00' } });
        expect(chemistryDone(c, now)).toBe(false);
    });

    it('is false when it was never measured', () => {
        expect(chemistryDone(ctx({ waterQuality: wq(null) }), now)).toBe(false);
    });
});

describe('progressFor', () => {
    const now = at('2026-09-02T09:00:00');

    // Decision D6: a slot is done only when EVERY active pond is logged.
    it('counts per farm and overall, and one outstanding pond keeps it incomplete', () => {
        const p = progressFor([
            ctx({ pondId: 'a', farmId: 'f1', waterQuality: wq('2026-09-02T07:00:00') }),
            ctx({ pondId: 'b', farmId: 'f1', waterQuality: null }),
            ctx({ pondId: 'c', farmId: 'f2', waterQuality: wq('2026-09-02T07:30:00') }),
        ], now);

        expect(p.overall).toEqual({ done: 2, total: 3 });
        expect(p.byFarm.f1).toEqual({ done: 1, total: 2 });
        expect(p.byFarm.f2).toEqual({ done: 1, total: 1 });
        expect(p.byPond).toEqual({ a: true, b: false, c: true });
    });

    it('reports an empty account as nothing to do rather than dividing by zero', () => {
        expect(progressFor([], now).overall).toEqual({ done: 0, total: 0 });
    });
});

const NOW = new Date('2026-09-04T10:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

// Reuses the file's own `ctx` and `wq` factories rather than a new one.
const freshCtx = (recordedAt: string | null): PondContext =>
    ctx({ waterQuality: recordedAt ? wq(recordedAt) : null });

describe('pondFreshness', () => {
    it('is fresh inside the two-day window', () => {
        expect(pondFreshness(freshCtx(hoursAgo(47)), NOW).state).toBe('fresh');
    });

    it('goes stale just past two days', () => {
        expect(pondFreshness(freshCtx(hoursAgo(49)), NOW).state).toBe('stale');
    });

    it('is still stale, not noData, at six days', () => {
        expect(pondFreshness(freshCtx(hoursAgo(24 * 6)), NOW).state).toBe('stale');
    });

    it('becomes noData past seven days', () => {
        expect(pondFreshness(freshCtx(hoursAgo(24 * 8)), NOW).state).toBe('noData');
    });

    it('reports noData with a null age when the pond has never been logged', () => {
        // "never logged" must not render as "logged infinity days ago".
        const f = pondFreshness(freshCtx(null), NOW);
        expect(f).toEqual({ state: 'noData', asOf: null, ageMs: null });
    });

    it('carries the source timestamp and age so callers need not recompute', () => {
        const at = hoursAgo(50);
        const f = pondFreshness(freshCtx(at), NOW);
        expect(f.asOf).toBe(at);
        expect(f.ageMs).toBe(50 * 3600_000);
    });

    it('treats an unparseable timestamp as noData rather than throwing', () => {
        expect(pondFreshness(freshCtx('not-a-date'), NOW).state).toBe('noData');
    });

    it('exports thresholds as two and seven days', () => {
        expect(STALE_AFTER_MS).toBe(2 * 24 * 3600_000);
        expect(NO_DATA_AFTER_MS).toBe(7 * 24 * 3600_000);
    });
});
