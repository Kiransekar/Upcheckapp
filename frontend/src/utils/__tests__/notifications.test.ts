const mockSchedule = jest.fn().mockResolvedValue('id');
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockGetAll = jest.fn().mockResolvedValue([]);

// The mock*, functions are called through a deferred wrapper (rather than
// assigned directly) because babel-plugin-jest-hoist hoists this jest.mock()
// call above the ES `import` below it, but does NOT hoist the `const mock… =`
// declarations above it — only the static "may reference a mock-prefixed
// name" check is exempted, not the runtime ordering. notifications.ts imports
// 'expo-notifications' too, so requiring it (via the `import` a few lines
// down) runs this factory before the consts are assigned; wrapping each call
// in an arrow function defers the mockX reference until the test actually
// invokes it, by which point the assignment above has run.
jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    scheduleNotificationAsync: (...args: unknown[]) => mockSchedule(...args),
    cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancel(...args),
    getAllScheduledNotificationsAsync: (...args: unknown[]) => mockGetAll(...args),
    getPermissionsAsync: jest.fn(),
    requestPermissionsAsync: jest.fn(),
    getExpoPushTokenAsync: jest.fn(),
    AndroidImportance: { MAX: 5 },
    SchedulableTriggerInputTypes: { DATE: 'date', DAILY: 'daily', WEEKLY: 'weekly' },
}));
jest.mock('expo-device', () => ({ isDevice: true }));

import type { PondContext } from '../../api/pondContext';
import { syncReminders, DEFAULT_REMINDER_TIMES } from '../notifications';

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

const wqAt = (recordedAt: string) =>
    ({ dissolvedOxygen: 6, ph: 8, temperature: 30, salinity: 15,
       ammonia: null, nitrite: null, nitrate: null, alkalinity: null,
       recordedAt, chemistryAsOf: null }) as PondContext['waterQuality'];

/** Slot tags of every notification scheduled in this call. */
const scheduledSlots = () =>
    mockSchedule.mock.calls.map((c) => (c[0].content.data as any).slot);

beforeEach(() => {
    mockSchedule.mockClear();
    mockCancel.mockClear();
    mockGetAll.mockResolvedValue([]);
});

/**
 * A local notification can only be made conditional when it is SCHEDULED, never
 * when it fires — nothing of ours runs at fire time. So the three repeating
 * DAILY triggers became a rolling window of one-shots, re-armed on foreground
 * and after every log, and a slot already satisfied is simply not scheduled.
 */
describe('syncReminders', () => {
    const now = new Date('2026-09-02T05:00:00');

    it('schedules a slot nobody has logged', async () => {
        await syncReminders([ctx({ waterQuality: null })], DEFAULT_REMINDER_TIMES, now);
        expect(scheduledSlots()).toContain('morning');
    });

    it('skips today’s morning once every pond has logged it', async () => {
        await syncReminders(
            [ctx({ pondId: 'a', waterQuality: wqAt('2026-09-02T05:30:00') })],
            DEFAULT_REMINDER_TIMES,
            new Date('2026-09-02T06:00:00'),
        );
        const morningToday = mockSchedule.mock.calls.filter((c) => {
            const d = c[0].content.data as any;
            const when: Date = c[0].trigger.date;
            return d.slot === 'morning' && when.getDate() === 2;
        });
        expect(morningToday).toHaveLength(0);
    });

    // Decision D6 — one outstanding pond keeps the reminder alive.
    it('still reminds when only some ponds are logged', async () => {
        await syncReminders(
            [
                ctx({ pondId: 'a', waterQuality: wqAt('2026-09-02T05:30:00') }),
                ctx({ pondId: 'b', waterQuality: null }),
            ],
            DEFAULT_REMINDER_TIMES,
            new Date('2026-09-02T06:00:00'),
        );
        const morningToday = mockSchedule.mock.calls.filter((c) => {
            const d = c[0].content.data as any;
            const when: Date = c[0].trigger.date;
            return d.slot === 'morning' && when.getDate() === 2;
        });
        expect(morningToday).toHaveLength(1);
    });

    it('clears the previous window before re-arming, so syncing twice does not duplicate', async () => {
        mockGetAll.mockResolvedValue([
            { identifier: 'old-1', content: { data: { tag: 'wq-reminder' } } },
            { identifier: 'keep-me', content: { data: { tag: 'something-else' } } },
        ]);
        await syncReminders([ctx({})], DEFAULT_REMINDER_TIMES, now);
        expect(mockCancel).toHaveBeenCalledWith('old-1');
        expect(mockCancel).not.toHaveBeenCalledWith('keep-me');
    });

    it('arms a rolling seven-day window', async () => {
        await syncReminders([ctx({ waterQuality: null })], DEFAULT_REMINDER_TIMES, now);
        // 7 days x 3 daily slots, minus none today, plus the weekly chemistry slot.
        expect(mockSchedule.mock.calls.length).toBeGreaterThanOrEqual(21);
    });

    it('schedules nothing at all for an account with no ponds', async () => {
        await syncReminders([], DEFAULT_REMINDER_TIMES, now);
        expect(mockSchedule).not.toHaveBeenCalled();
    });
});
