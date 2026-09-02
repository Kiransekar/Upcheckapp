# Smart Reminders and Log-Progress Visibility Implementation Plan (Workstream B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop reminding a farmer to do work they have already done, show at a glance what is still outstanding across every farm and pond, and tell them when support replies.

**Architecture:** One pure derivation module (`logProgress.ts`) is the single definition of "done"; the reminder engine, the Today card and the farm/pond hints all read it, so they cannot disagree. Reminders move from repeating triggers that fire blindly to a rolling 7-day window of one-shot triggers, re-armed whenever the app can see the truth.

**Tech Stack:** Expo/React Native, `expo-notifications`, `@react-native-picker/picker`, TanStack Query, NestJS backend.

**Spec:** `docs/superpowers/specs/2026-09-02-qa-defect-remediation-design.md` (Workstream B, §B1–B8)

## Global Constraints

- **No new native dependency.** `expo-notifications@~0.32.16`, `expo-device@~8.0.10` and `@react-native-picker/picker@2.11.1` are all already in the shipped binary — the picker since commit `00df9c5` (2026-02-17), well before the 2026-08-24 build. Anything needing a *new* native module must be marked **NATIVE** and scheduled against a binary release. Nothing in this plan is.
- **Gate every commit:** `npx tsc --noEmit` and `npx jest --maxWorkers=2 --forceExit` in the package you changed.
- **`logProgress.ts` must stay pure.** No imports from React, stores, or the network. It is the only place the "done" rules live, and its purity is what makes them testable without a device.
- **A slot is done only when EVERY active pond is logged** (decision D6).
- **Reminder defaults stay 06:30 / 13:00 / 18:00 daily and Sunday 07:30** (decision D7), editable by the farmer and persisted locally.
- **Notification copy is a nudge, never an accusation** — the multi-device false positive in §B4 means the app can be wrong about what the farmer has done.
- Six locales for every user-visible string: `en`, `hi`, `bn`, `ta`, `te`, `or`.

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `backend/src/pond-context/pond-context.service.ts` | Add `farmId` to the context payload | 1 |
| `backend/src/feedback/feedback.service.ts` + module | Push when an admin response is written | 2 |
| `frontend/src/api/pondContext.ts` | Mirror `farmId` on the client type | 1 |
| `frontend/src/features/logProgress.ts` *(new)* | The only definition of "done" — pure | 3 |
| `frontend/src/utils/notifications.ts` | Rolling-window conditional scheduling | 4 |
| `frontend/src/components/today/LogProgressCard.tsx` *(new)* | Overall / per-farm / per-pond progress | 5 |
| `frontend/src/components/ui/SessionHint.tsx` *(new)* | Shared "logged / fed this session" badge | 6 |
| `frontend/src/screens/settings/SettingsScreen.tsx` | Editable reminder times | 7 |
| `frontend/src/navigation/` + notification handler | Deep-link a support reply to `FeedbackDetailScreen` | 8 |

---

# PR 5 (extended) — backend deploy

> Folds into the backend PR already scheduled in Workstream A, rather than adding a third deploy.

### Task 1: Put `farmId` on the pond context

**Files:**
- Modify: `backend/src/pond-context/pond-context.service.ts` — the `PondContext` interface (line 16) and `buildContext` (line 525)
- Modify: `frontend/src/api/pondContext.ts` — the client-side `PondContext` interface
- Test: `backend/src/pond-context/pond-context.service.spec.ts`

**Interfaces:**
- Consumes: `Pond.farmId` (`backend/src/ponds/pond.entity.ts:33`).
- Produces: `PondContext.farmId: string` on both sides. Task 5 groups by it.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/pond-context/pond-context.service.spec.ts`:

```ts
/**
 * The Today screen groups ponds by farm to show per-farm progress, and
 * fetchTodaySnapshot flattens its per-farm results, losing the association.
 * Carrying farmId on the context is what makes that grouping possible without
 * a second request.
 */
it('carries the pond farmId so callers can group by farm', () => {
  const pond = { id: 'p1', farmId: 'farm-9', activeCycleId: null } as any;
  const ctx = (service as any).buildContext(pond, {
    crop: null, wqRecords: [], sampling: null,
    mortalityAgg: null, feedAgg: null, tray: null,
  });
  expect(ctx.farmId).toBe('farm-9');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest pond-context.service --maxWorkers=1 --forceExit`
Expected: FAIL — `ctx.farmId` is `undefined`.

- [ ] **Step 3: Add the field**

In the `PondContext` interface, after `pondId`:

```ts
  pondId: string;
  /** Owning farm — lets a caller group contexts without a second request. */
  farmId: string;
```

In `buildContext`, beside `const pondId = pond.id;`:

```ts
    const pondId = pond.id;
    const farmId = pond.farmId;
```

and include `farmId` in the returned object. Both the single-pond path and `buildContextsFor` route through `buildContext`, so both inherit it.

- [ ] **Step 4: Mirror the type on the client**

In `frontend/src/api/pondContext.ts`, add to the interface:

```ts
  pondId: string;
  /** Owning farm — lets the Today screen group by farm with no extra request. */
  farmId: string;
```

- [ ] **Step 5: Run both gates**

Run: `cd backend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Then: `cd frontend && npx tsc --noEmit`
Expected: PASS. `tsc` may flag test fixtures that build a `PondContext` literal — add `farmId: 'farm-1'` to each.

- [ ] **Step 6: Commit**

```bash
git add backend/src/pond-context frontend/src/api/pondContext.ts
git commit -m "feat(pond-context): carry farmId so contexts can be grouped by farm

The Today progress card shows per-farm rows, but fetchTodaySnapshot flattens
its per-farm results and loses the association, and the single-request path
never had it. Additive and backwards-compatible; both the single-pond and bulk
paths inherit it because both build through buildContext."
```

### Task 2: Push when support replies

**Files:**
- Modify: `backend/src/feedback/feedback.service.ts` (where `adminResponse` is written)
- Modify: `backend/src/feedback/feedback.module.ts` (import the push module)
- Test: `backend/src/feedback/feedback.service.spec.ts`

**Interfaces:**
- Consumes: `PushService.sendToUser(userId, { title, body, data? }): Promise<boolean>` from `backend/src/push/push.service.ts`.
- Produces: a push with `data: { type: 'feedback_reply', reportId }`, which Task 8 routes on.

- [ ] **Step 1: Write the failing test**

Add to `backend/src/feedback/feedback.service.spec.ts`:

```ts
/**
 * feedback_reports.admin_response has always been stored and PATCHable, but
 * nothing told the farmer. They had to reopen the report and check.
 */
describe('admin response notification', () => {
  it('pushes to the reporter when a response is written', async () => {
    const sendToUser = jest.fn().mockResolvedValue(true);
    // ...construct the service with { sendToUser } as the push dependency...
    await service.adminUpdate('report-1', { adminResponse: 'We have fixed this.' });

    expect(sendToUser).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        data: { type: 'feedback_reply', reportId: 'report-1' },
      }),
    );
  });

  it('does not push when only the status changed', async () => {
    const sendToUser = jest.fn();
    await service.adminUpdate('report-1', { status: 'in_progress' });
    expect(sendToUser).not.toHaveBeenCalled();
  });

  // sendToUser's contract is "never throws into the caller"; the admin's write
  // must succeed even if delivery does not.
  it('still saves the response when the push fails', async () => {
    const sendToUser = jest.fn().mockRejectedValue(new Error('expo down'));
    await expect(
      service.adminUpdate('report-1', { adminResponse: 'Fixed.' }),
    ).resolves.toBeTruthy();
  });
});
```

Fill in the service construction to match the existing spec's setup style in this file.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest feedback.service --maxWorkers=1 --forceExit`
Expected: FAIL — `sendToUser` never called.

- [ ] **Step 3: Send the push**

Inject `PushService` into `FeedbackService` (and add `PushModule` to `feedback.module.ts` imports). After the response is persisted:

```ts
    // Tell the farmer, rather than making them reopen the report to find out.
    // Best-effort by design: sendToUser never throws into its caller, and an
    // admin's reply must save whether or not delivery succeeds.
    if (dto.adminResponse) {
      await this.push
        .sendToUser(report.userId, {
          title: 'Support replied to your report',
          body: 'Tap to read the reply.',
          data: { type: 'feedback_reply', reportId: report.id },
        })
        .catch(() => undefined);
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/feedback
git commit -m "feat(feedback): notify the reporter when support replies

admin_response was stored and PATCHable but nothing told the farmer, who had to
reopen the report to discover it. Best-effort: the reply saves whether or not
delivery succeeds."
```

---

# PR 9 — the derivation module and the reminder engine (OTA)

### Task 3: One pure definition of "done"

**Files:**
- Create: `frontend/src/features/logProgress.ts`
- Create: `frontend/src/features/__tests__/logProgress.test.ts`

**Interfaces:**
- Consumes: `PondContext` (with `farmId` from Task 1).
- Produces:
  - `type Slot = 'morning' | 'afternoon' | 'evening'`
  - `SLOT_BOUNDS: Record<Slot, { fromHour: number; toHour: number }>`
  - `slotAt(date: Date): Slot`
  - `pondSlotDone(ctx: PondContext, slot: Slot, now: Date): boolean`
  - `pondFedThisSession(ctx: PondContext, slot: Slot, now: Date): boolean`
  - `chemistryDone(ctx: PondContext, now: Date): boolean`
  - `progressFor(contexts: PondContext[], now: Date): { overall: { done: number; total: number }; byFarm: Record<string, { done: number; total: number }>; byPond: Record<string, boolean> }`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/__tests__/logProgress.test.ts`:

```ts
import type { PondContext } from '../../api/pondContext';
import {
    slotAt, pondSlotDone, pondFedThisSession, chemistryDone, progressFor,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest logProgress --maxWorkers=1 --forceExit`
Expected: FAIL — "Cannot find module '../logProgress'".

- [ ] **Step 3: Write the implementation**

Create `frontend/src/features/logProgress.ts`:

```ts
import type { PondContext } from '../api/pondContext';

/**
 * What the farmer has and has not done, derived from data the app already
 * fetches.
 *
 * This module is the ONLY definition of "done". The reminders, the Today
 * progress card and the farm/pond hints all read it, so they cannot drift apart
 * and tell the farmer three different things — the failure mode QA BUG-019 is
 * an instance of elsewhere in this codebase.
 *
 * Pure by design: no React, no stores, no network. Every rule below is
 * unit-testable without a device.
 */
export type Slot = 'morning' | 'afternoon' | 'evening';

/** Half-open windows [fromHour, toHour) covering the whole day. */
export const SLOT_BOUNDS: Record<Slot, { fromHour: number; toHour: number }> = {
    morning: { fromHour: 0, toHour: 12 },
    afternoon: { fromHour: 12, toHour: 17 },
    evening: { fromHour: 17, toHour: 24 },
};

export const slotAt = (date: Date): Slot => {
    const h = date.getHours();
    if (h < SLOT_BOUNDS.morning.toHour) return 'morning';
    if (h < SLOT_BOUNDS.afternoon.toHour) return 'afternoon';
    return 'evening';
};

/** Start and end of `slot` on the calendar day of `now`. */
const slotWindow = (slot: Slot, now: Date): { from: Date; to: Date } => {
    const { fromHour, toHour } = SLOT_BOUNDS[slot];
    const from = new Date(now);
    from.setHours(fromHour, 0, 0, 0);
    const to = new Date(now);
    to.setHours(0, 0, 0, 0);
    to.setHours(toHour, 0, 0, 0);
    return { from, to };
};

const within = (iso: string | null | undefined, from: Date, to: Date): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= from.getTime() && t < to.getTime();
};

/** Has this pond's water quality been logged in `slot` today? */
export const pondSlotDone = (ctx: PondContext, slot: Slot, now: Date): boolean => {
    const { from, to } = slotWindow(slot, now);
    return within(ctx.waterQuality?.recordedAt, from, to);
};

/** Has this pond been fed in `slot` today? */
export const pondFedThisSession = (ctx: PondContext, slot: Slot, now: Date): boolean => {
    const { from, to } = slotWindow(slot, now);
    return within(ctx.lastFeedAt, from, to);
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Chemistry is a weekly cadence, not a daily one, so this asks "within the last
 * seven days" rather than "in a window today".
 */
export const chemistryDone = (ctx: PondContext, now: Date): boolean => {
    const asOf = ctx.waterQuality?.chemistryAsOf;
    if (!asOf) return false;
    const t = new Date(asOf).getTime();
    return Number.isFinite(t) && now.getTime() - t < WEEK_MS;
};

export interface Progress {
    overall: { done: number; total: number };
    byFarm: Record<string, { done: number; total: number }>;
    byPond: Record<string, boolean>;
}

/**
 * Progress for the CURRENT slot. A slot counts as complete only when every
 * active pond has been logged (decision D6) — one outstanding pond keeps the
 * bar short, which is the whole point of showing it.
 */
export const progressFor = (contexts: PondContext[], now: Date): Progress => {
    const slot = slotAt(now);
    const byFarm: Progress['byFarm'] = {};
    const byPond: Progress['byPond'] = {};
    let done = 0;

    for (const ctx of contexts) {
        const ok = pondSlotDone(ctx, slot, now);
        byPond[ctx.pondId] = ok;
        if (ok) done += 1;
        const farm = (byFarm[ctx.farmId] ??= { done: 0, total: 0 });
        farm.total += 1;
        if (ok) farm.done += 1;
    }

    return { overall: { done, total: contexts.length }, byFarm, byPond };
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest logProgress --maxWorkers=1 --forceExit`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/logProgress.ts frontend/src/features/__tests__/logProgress.test.ts
git commit -m "feat(log-progress): one pure definition of what the farmer has already done

Derived from data the app already fetches - PondContext carries recordedAt,
chemistryAsOf and lastFeedAt, and /alert-center/today returns every pond's
context in one request - so this needs no new endpoint and no extra requests.

Kept pure and in one place deliberately: the reminders, the Today card and the
farm/pond hints all read it, so they cannot tell the farmer three different
things about the same pond."
```

### Task 4: Reminders that skip what is already done

**Files:**
- Modify: `frontend/src/utils/notifications.ts`
- Create: `frontend/src/utils/__tests__/notifications.test.ts`

**Interfaces:**
- Consumes: `progressFor`, `pondSlotDone`, `chemistryDone`, `Slot`, `SLOT_BOUNDS` from Task 3.
- Produces:
  - `type ReminderTimes = { morning: HM; afternoon: HM; evening: HM; chemistry: HM & { weekday: number } }` where `HM = { hour: number; minute: number }`
  - `DEFAULT_REMINDER_TIMES: ReminderTimes`
  - `syncReminders(contexts: PondContext[], times: ReminderTimes, now?: Date): Promise<void>`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/utils/__tests__/notifications.test.ts`:

```ts
const mockSchedule = jest.fn().mockResolvedValue('id');
const mockCancel = jest.fn().mockResolvedValue(undefined);
const mockGetAll = jest.fn().mockResolvedValue([]);

jest.mock('expo-notifications', () => ({
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(),
    scheduleNotificationAsync: mockSchedule,
    cancelScheduledNotificationAsync: mockCancel,
    getAllScheduledNotificationsAsync: mockGetAll,
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest utils/__tests__/notifications --maxWorkers=1 --forceExit`
Expected: FAIL — `syncReminders` is not exported.

- [ ] **Step 3: Write the implementation**

In `frontend/src/utils/notifications.ts`, keep `registerForPushNotificationsAsync` unchanged. Replace the four scheduling/cancelling functions with:

```ts
import type { PondContext } from '../api/pondContext';
import { pondSlotDone, chemistryDone, type Slot } from '../features/logProgress';

const REMINDER_TAG = 'wq-reminder';
const CHEM_REMINDER_TAG = 'chem-reminder';

export interface HM { hour: number; minute: number }
export interface ReminderTimes {
    morning: HM;
    afternoon: HM;
    evening: HM;
    /** weekday: 1 = Sunday … 7 = Saturday, matching expo-notifications. */
    chemistry: HM & { weekday: number };
}

export const DEFAULT_REMINDER_TIMES: ReminderTimes = {
    morning: { hour: 6, minute: 30 },
    afternoon: { hour: 13, minute: 0 },
    evening: { hour: 18, minute: 0 },
    chemistry: { weekday: 1, hour: 7, minute: 30 },
};

const DAILY_SLOTS: Slot[] = ['morning', 'afternoon', 'evening'];

/** How far ahead the rolling window reaches. See the lapse note below. */
const WINDOW_DAYS = 7;

/** Cancel every notification this module owns, leaving others alone. */
async function cancelOurs(): Promise<void> {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
        scheduled
            .filter((n) => {
                const tag = (n.content?.data as any)?.tag;
                return tag === REMINDER_TAG || tag === CHEM_REMINDER_TAG;
            })
            .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
}

/**
 * (Re)arm the reminder window, skipping anything the farmer has already done.
 *
 * WHY ONE-SHOTS RATHER THAN A REPEATING TRIGGER
 *
 * A local notification can be made conditional only when it is SCHEDULED —
 * nothing of ours runs at fire time, so a repeating DAILY trigger cannot ask
 * whether today's check is already logged. It therefore fired at a farmer who
 * had logged everything an hour earlier, which is exactly the complaint this
 * replaces. One-shots let a satisfied slot simply not be scheduled.
 *
 * TWO ACCEPTED CONSEQUENCES
 *
 * 1. If the app is not opened for WINDOW_DAYS the reminders lapse, where the
 *    repeating triggers never did. Acceptable: the window is re-armed on every
 *    open, and a farmer who has not opened the app in a week has been reminded
 *    every day of that week.
 * 2. If a worker logs the morning check on their own phone, this phone still
 *    reminds until it next syncs. Removing that needs a server deciding at send
 *    time (the QStash follow-up); until then the copy stays a nudge, never an
 *    accusation.
 *
 * Called on app foreground and from saveRecord()'s success path — the same
 * choke point that already drives invalidateForEntity().
 */
export async function syncReminders(
    contexts: PondContext[],
    times: ReminderTimes = DEFAULT_REMINDER_TIMES,
    now: Date = new Date(),
): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
        await cancelOurs();
        if (contexts.length === 0) return;

        for (let day = 0; day < WINDOW_DAYS; day++) {
            for (const slot of DAILY_SLOTS) {
                const { hour, minute } = times[slot];
                const when = new Date(now);
                when.setDate(when.getDate() + day);
                when.setHours(hour, minute, 0, 0);
                if (when <= now) continue; // already past

                // Today only: skip a slot every pond has already logged.
                const satisfied =
                    day === 0 && contexts.every((c) => pondSlotDone(c, slot, now));
                if (satisfied) continue;

                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: i18n.t(`notifications.wq.${slot}.title`, 'Water check'),
                        body: i18n.t(
                            `notifications.wq.${slot}.body`,
                            'Log DO, pH, salinity and temperature so your feed and risk advice stay accurate.',
                        ),
                        data: { tag: REMINDER_TAG, slot },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: when,
                    },
                });
            }
        }

        // Weekly chemistry: one occurrence inside the window, skipped when every
        // pond has a measurement inside the last seven days.
        if (!contexts.every((c) => chemistryDone(c, now))) {
            const when = nextWeekday(now, times.chemistry);
            if (when.getTime() - now.getTime() < WINDOW_DAYS * 86_400_000) {
                await Notifications.scheduleNotificationAsync({
                    content: {
                        title: i18n.t('notifications.chemTitle', 'Weekly chemistry check'),
                        body: i18n.t(
                            'notifications.chemBody',
                            'Test ammonia, nitrite, nitrate, alkalinity and hardness — it keeps your feed and disease advice sharp.',
                        ),
                        data: { tag: CHEM_REMINDER_TAG, slot: 'chemistry' },
                    },
                    trigger: {
                        type: Notifications.SchedulableTriggerInputTypes.DATE,
                        date: when,
                    },
                });
            }
        }
    } catch (e) {
        console.warn('[Notifications] Could not sync reminders', e);
    }
}

/** Next occurrence of `weekday` (1 = Sunday) at the given time, after `now`. */
function nextWeekday(now: Date, t: { weekday: number; hour: number; minute: number }): Date {
    const when = new Date(now);
    when.setHours(t.hour, t.minute, 0, 0);
    const target = t.weekday - 1; // expo is 1-based Sunday; Date is 0-based
    let delta = (target - when.getDay() + 7) % 7;
    if (delta === 0 && when <= now) delta = 7;
    when.setDate(when.getDate() + delta);
    return when;
}
```

Delete `WQ_REMINDER_TIMES`, `scheduleDailyWaterQualityReminders`, `cancelWaterQualityReminders`, `CHEM_REMINDER`, `scheduleWeeklyChemistryReminder` and `cancelWeeklyChemistryReminder`, and update their callers to call `syncReminders`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest utils/__tests__/notifications --maxWorkers=1 --forceExit`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the notification strings to all six locales**

Add `notifications.wq.morning.title/body`, `.afternoon.*`, `.evening.*` (plus the existing `chemTitle`/`chemBody`) to each locale file. Keep the copy a nudge — the app can be wrong about what the farmer has done.

- [ ] **Step 6: Call it where the truth is known**

Call `syncReminders(contexts, times)` from the app-foreground handler and from `saveRecord()`'s success path in `frontend/src/sync/recordSync.ts`, beside the existing `invalidateForEntity(entity)`.

- [ ] **Step 7: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/utils frontend/src/sync frontend/src/i18n/locales
git commit -m "feat(reminders): stop reminding a farmer to do what they have already done

The three daily reminders and the weekly chemistry reminder fired
unconditionally - nothing checked whether the log already existed, so a farmer
who finished at 06:00 was still nagged at 06:30.

A local notification can only be made conditional at SCHEDULE time, since
nothing of ours runs when it fires. So the repeating triggers become a rolling
seven-day window of one-shots, re-armed on foreground and after every log, and
a slot every pond has already logged is simply not scheduled.

Two consequences are accepted and documented in the code rather than hidden: the
window lapses if the app goes unopened for a week, and a log made on another
device does not silence this one until it syncs."
```

---

# PR 10 — Today progress card (OTA)

### Task 5: Show what is done and what is left, on open

**Files:**
- Create: `frontend/src/components/today/LogProgressCard.tsx`
- Create: `frontend/src/components/today/__tests__/LogProgressCard.test.tsx`
- Modify: `frontend/src/screens/main/HomeScreen.tsx`

**Interfaces:**
- Consumes: `progressFor`, `Progress` from Task 3; `PondContext.farmId` from Task 1; the `home` query's existing `contexts`.
- Produces: `<LogProgressCard contexts={PondContext[]} farmNames={Record<string, string>} pondNames={Record<string, string>} />`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/today/__tests__/LogProgressCard.test.tsx`:

```tsx
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { LogProgressCard } from '../LogProgressCard';
import type { PondContext } from '../../../api/pondContext';

const ctx = (pondId: string, farmId: string, recordedAt: string | null): PondContext =>
    ({
        pondId, farmId, cropId: 'c1', species: null, areaM2: null,
        installedAeratorHp: null, doc: 10,
        waterQuality: recordedAt
            ? ({ dissolvedOxygen: 6, ph: 8, temperature: 30, salinity: 15,
                 ammonia: null, nitrite: null, nitrate: null, alkalinity: null,
                 recordedAt, chemistryAsOf: null } as PondContext['waterQuality'])
            : null,
        freeAmmoniaMgL: null, abwG: null, livePopulation: null, biomassKg: null,
        crop: null, cumulativeFeedKg: null, runningFcr: null,
        latestTrayResidue: null, lastFeedAt: null, lastTrayAt: null,
        samplingAt: null,
        confidence: { score: 0, band: 'low', missing: [], stale: [] },
    }) as PondContext;

const names = { farmNames: { f1: 'North Farm', f2: 'South Farm' }, pondNames: { a: 'P01', b: 'P02', c: 'P03' } };

describe('LogProgressCard', () => {
    const now = new Date('2026-09-02T09:00:00');

    it('shows overall progress so the farmer sees it on open', () => {
        const { getByText } = render(
            <LogProgressCard
                now={now}
                contexts={[
                    ctx('a', 'f1', '2026-09-02T07:00:00'),
                    ctx('b', 'f1', null),
                    ctx('c', 'f2', '2026-09-02T07:30:00'),
                ]}
                {...names}
            />,
        );
        expect(getByText('2/3')).toBeTruthy();
    });

    it('breaks progress down per farm when expanded', () => {
        const { getByText, getByTestId } = render(
            <LogProgressCard
                now={now}
                contexts={[ctx('a', 'f1', '2026-09-02T07:00:00'), ctx('b', 'f1', null)]}
                {...names}
            />,
        );
        fireEvent.press(getByTestId('log-progress-toggle'));
        expect(getByText('North Farm')).toBeTruthy();
        expect(getByText('1/2')).toBeTruthy();
    });

    it('names the ponds still outstanding rather than only counting them', () => {
        const { getByTestId, getByText } = render(
            <LogProgressCard now={now} contexts={[ctx('b', 'f1', null)]} {...names} />,
        );
        fireEvent.press(getByTestId('log-progress-toggle'));
        expect(getByText('P02')).toBeTruthy();
    });

    it('renders nothing when the account has no active ponds', () => {
        const { queryByTestId } = render(
            <LogProgressCard now={now} contexts={[]} {...names} />,
        );
        expect(queryByTestId('log-progress-card')).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest LogProgressCard --maxWorkers=1 --forceExit`
Expected: FAIL — cannot find `../LogProgressCard`.

- [ ] **Step 3: Build the component**

Create `frontend/src/components/today/LogProgressCard.tsx`. Requirements it must meet, all pinned by the tests above:

- Returns `null` when `contexts` is empty — an account with no ponds has nothing to show and must not render an empty bar or divide by zero.
- Renders `testID="log-progress-card"`, an overall `done/total` label and a progress bar whose width is `done / total` (guard `total === 0`).
- A `testID="log-progress-toggle"` control expands to per-farm rows (name + `done/total` + bar), each expanding to per-pond rows.
- Outstanding ponds are **named**, not just counted — "P02" is actionable, "1 remaining" is not.
- Derives everything from `progressFor(contexts, now)`; it computes no rules of its own.
- Accepts an optional `now` prop defaulting to `new Date()` purely so the tests are deterministic.

Follow the existing card styling in `frontend/src/components/ui/` and use `theme` tokens; add every user-visible string to all six locales.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest LogProgressCard --maxWorkers=1 --forceExit`
Expected: PASS, 4 tests.

- [ ] **Step 5: Mount it on Today**

In `HomeScreen.tsx`, render `<LogProgressCard>` near the top of the screen, passing the `home` query's existing `contexts` and the farm/pond names the screen already holds. **Do not add a new query or request** — the whole point is that this data is already fetched.

- [ ] **Step 6: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS, including the existing `HomeScreen` suite.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/today frontend/src/screens/main/HomeScreen.tsx frontend/src/i18n/locales
git commit -m "feat(today): show what is logged and what is still outstanding

Overall, per farm and per pond, on the screen the farmer opens first. Reads the
contexts the Today query already fetches, so it costs no new endpoint and no
extra request.

Outstanding ponds are named rather than counted: '1 remaining' is not something
a farmer can act on, 'P02' is."
```

---

# PR 11 — farm and pond session hints (OTA)

### Task 6: Say whether this pond was logged and fed this session

**Files:**
- Create: `frontend/src/components/ui/SessionHint.tsx`
- Create: `frontend/src/components/ui/__tests__/SessionHint.test.tsx`
- Modify: the farm screen's pond rows and `frontend/src/screens/ponds/PondDashboardScreen.tsx`

**Interfaces:**
- Consumes: `pondSlotDone`, `pondFedThisSession`, `slotAt` from Task 3.
- Produces: `<SessionHint ctx={PondContext} now?={Date} />`

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/ui/__tests__/SessionHint.test.tsx` covering four cases, using the same `ctx` helper shape as Task 5's test:

```tsx
describe('SessionHint', () => {
    const now = new Date('2026-09-02T09:00:00');

    it('shows both done when the pond was logged and fed this session', () => {
        const { getByTestId } = render(
            <SessionHint now={now} ctx={ctx({ waterQuality: wqAt('2026-09-02T07:00:00'), lastFeedAt: '2026-09-02T07:30:00' })} />,
        );
        expect(getByTestId('session-hint-logged').props.accessibilityState.checked).toBe(true);
        expect(getByTestId('session-hint-fed').props.accessibilityState.checked).toBe(true);
    });

    it('shows logged but not fed', () => {
        const { getByTestId } = render(
            <SessionHint now={now} ctx={ctx({ waterQuality: wqAt('2026-09-02T07:00:00'), lastFeedAt: null })} />,
        );
        expect(getByTestId('session-hint-logged').props.accessibilityState.checked).toBe(true);
        expect(getByTestId('session-hint-fed').props.accessibilityState.checked).toBe(false);
    });

    it('shows neither when nothing happened this session', () => {
        const { getByTestId } = render(
            <SessionHint now={now} ctx={ctx({ waterQuality: null, lastFeedAt: null })} />,
        );
        expect(getByTestId('session-hint-logged').props.accessibilityState.checked).toBe(false);
        expect(getByTestId('session-hint-fed').props.accessibilityState.checked).toBe(false);
    });

    // Yesterday's work must not read as today's.
    it('does not count yesterday as this session', () => {
        const { getByTestId } = render(
            <SessionHint now={now} ctx={ctx({ waterQuality: wqAt('2026-09-01T07:00:00'), lastFeedAt: '2026-09-01T07:30:00' })} />,
        );
        expect(getByTestId('session-hint-logged').props.accessibilityState.checked).toBe(false);
        expect(getByTestId('session-hint-fed').props.accessibilityState.checked).toBe(false);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest SessionHint --maxWorkers=1 --forceExit`
Expected: FAIL — module not found.

- [ ] **Step 3: Build the component**

Two small badges — "logged" and "fed" — driven entirely by `pondSlotDone(ctx, slotAt(now), now)` and `pondFedThisSession(ctx, slotAt(now), now)`. Each carries `accessibilityState={{ checked }}` so the state is available to screen readers and to the tests, and does not rely on colour alone to convey meaning.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest SessionHint --maxWorkers=1 --forceExit`
Expected: PASS, 4 tests.

- [ ] **Step 5: Place it on both screens**

Add `<SessionHint>` to each pond row on the farm screen and to the pond dashboard header. Both screens already load contexts; do not add a request.

- [ ] **Step 6: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ui/SessionHint.tsx frontend/src/components/ui/__tests__/SessionHint.test.tsx frontend/src/screens frontend/src/i18n/locales
git commit -m "feat(ponds): show whether each pond was logged and fed this session

On the farm page's pond rows and the pond dashboard header, driven by the same
logProgress rules as the reminders and the Today card so the three cannot
disagree. State is carried in accessibilityState rather than colour alone."
```

---

# PR 12 — editable times and the support-reply deep link (OTA)

### Task 7: Let the farmer choose the times

**Files:**
- Modify: `frontend/src/screens/settings/SettingsScreen.tsx`
- Create: `frontend/src/features/reminderTimes.ts` (load/save)
- Create: `frontend/src/features/__tests__/reminderTimes.test.ts`

**Interfaces:**
- Consumes: `ReminderTimes`, `DEFAULT_REMINDER_TIMES`, `syncReminders` from Task 4.
- Produces: `loadReminderTimes(): Promise<ReminderTimes>`, `saveReminderTimes(t: ReminderTimes): Promise<void>`

- [ ] **Step 1: Write the failing test**

```ts
import { loadReminderTimes, saveReminderTimes } from '../reminderTimes';
import { DEFAULT_REMINDER_TIMES } from '../../utils/notifications';

describe('reminderTimes', () => {
    it('returns the defaults when the farmer has never chosen', async () => {
        expect(await loadReminderTimes()).toEqual(DEFAULT_REMINDER_TIMES);
    });

    it('round-trips a saved choice', async () => {
        const t = { ...DEFAULT_REMINDER_TIMES, morning: { hour: 5, minute: 0 } };
        await saveReminderTimes(t);
        expect(await loadReminderTimes()).toEqual(t);
    });

    // A corrupt or partial value must not brick the reminders.
    it('falls back to the defaults on unreadable stored data', async () => {
        await AsyncStorage.setItem('upcheck-reminder-times', '{not json');
        expect(await loadReminderTimes()).toEqual(DEFAULT_REMINDER_TIMES);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest reminderTimes --maxWorkers=1 --forceExit`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement load/save**

AsyncStorage-backed, key `upcheck-reminder-times`, wrapped in try/catch returning `DEFAULT_REMINDER_TIMES` on any failure — a corrupt value must degrade to the defaults, never to no reminders.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest reminderTimes --maxWorkers=1 --forceExit`
Expected: PASS, 3 tests.

- [ ] **Step 5: Add the Settings UI**

Four rows (morning, afternoon, evening, weekly chemistry) using `@react-native-picker/picker` — already in the binary, already used by `MeasurementsScreen`. **Do not add `@react-native-community/datetimepicker`**; that is a new native module and would break the OTA constraint. On save, call `saveReminderTimes` then `syncReminders(contexts, times)` so the change takes effect immediately. Add all strings to six locales.

- [ ] **Step 6: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features frontend/src/screens/settings frontend/src/i18n/locales
git commit -m "feat(settings): let the farmer choose their reminder times

Defaults unchanged at 06:30 / 13:00 / 18:00 and Sunday 07:30, but a farm that
starts at 5am can now say so. Uses @react-native-picker/picker, already in the
binary - deliberately NOT datetimepicker, which would be a new native module and
break the OTA constraint."
```

### Task 8: Open the reply when the farmer taps the notification

**Files:**
- Modify: the app's notification-response handler (alongside `setNotificationHandler` in `frontend/src/utils/notifications.ts`, wired where the navigation container is created)
- Modify: `frontend/src/store/notificationStore.ts` (unread marker)

**Interfaces:**
- Consumes: `data: { type: 'feedback_reply', reportId }` sent by Task 2.
- Produces: navigation to `FeedbackDetailScreen` with `reportId`.

- [ ] **Step 1: Write the failing test**

```ts
import { routeForNotification } from '../notificationRouting';

describe('routeForNotification', () => {
    it('routes a support reply to the report it answers', () => {
        expect(routeForNotification({ type: 'feedback_reply', reportId: 'r-9' }))
            .toEqual({ screen: 'FeedbackDetail', params: { reportId: 'r-9' } });
    });

    it('ignores a reminder, which has no destination of its own', () => {
        expect(routeForNotification({ tag: 'wq-reminder', slot: 'morning' })).toBeNull();
    });

    it('ignores an unknown or malformed payload rather than crashing', () => {
        expect(routeForNotification({})).toBeNull();
        expect(routeForNotification({ type: 'feedback_reply' })).toBeNull();
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest notificationRouting --maxWorkers=1 --forceExit`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure router**

Create `frontend/src/features/notificationRouting.ts` returning `{ screen, params } | null`. Keeping the decision pure and separate from navigation is what makes it testable without a navigator.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest notificationRouting --maxWorkers=1 --forceExit`
Expected: PASS, 4 tests.

- [ ] **Step 5: Wire the response listener**

Add `Notifications.addNotificationResponseReceivedListener`, pass the payload through `routeForNotification`, and navigate when it returns a route. Also handle the cold-start case via `getLastNotificationResponseAsync`, or a tap that launches the app does nothing. Mark the report unread in `notificationStore` when the push arrives in the foreground.

- [ ] **Step 6: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features frontend/src/utils frontend/src/store
git commit -m "feat(notifications): tapping a support reply opens the report it answers

Handles the cold-start case too - without getLastNotificationResponseAsync a tap
that launches the app lands on Today and the farmer never finds the reply.

The routing decision is a pure function so it is testable without a navigator."
```

---

## Verification summary

**Verified here:** every rule in `logProgress.ts`, the scheduling decisions in `syncReminders` (against a faked `expo-notifications`), the progress card and session hint rendering, reminder-time persistence, and notification routing. Plus `tsc` and the full suites on both sides.

**Requires the handset — do not claim these from the development machine:**
- A notification actually arriving at the scheduled time
- Tap-through from a real notification, cold and warm start
- The picker UI
- That a real support reply reaches a real device

## Known limitations shipped deliberately

State these when reporting; they are design decisions from spec §B4, not oversights.

- **Reminders lapse if the app is unopened for 7 days.** The repeating triggers they replace never lapsed.
- **A log made on another device, or by a worker, does not silence this phone** until it next syncs. Removing this needs the QStash follow-up, where a server decides at send time.
- **Chemistry is treated as a single account-wide cadence** — the reminder is skipped only when every pond has a measurement inside the last seven days.
