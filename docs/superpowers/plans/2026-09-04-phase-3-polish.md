# Phase 3 — Data Freshness and §5 Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make un-logged ponds visibly untrustworthy on every screen that shows pond health, and land §5 of the remediation spec (inventory ledger and pairing, inventory↔money, push on approvals, invite-by-link, chemistry de-duplication, dead-code removal) plus two data-losing defects found while tracing.

**Architecture:** Part A adds one pure function (`pondFreshness`) to the module that already owns the definition of "done", threads it through the single `healthOf()` that four screens read, and renders a compact age hint beside each surface. Part B adds four additive migrations, an `inventory_movements` ledger written inside the existing atomic stock UPDATE, an `inventory_farms` join table mirroring `farm_member_ponds`, and push fan-out on the two approval events.

**Tech Stack:** NestJS 10 + TypeORM (Postgres/Supabase) backend; Expo SDK 54 / React Native 0.81 + React Navigation + TanStack Query + i18next frontend; Jest on both sides.

**Spec:** `docs/superpowers/specs/2026-09-04-phase-3-design.md`

## Global Constraints

- **OTA only on the frontend.** Add NO new native dependency to `frontend/package.json`. `expo-linking`, `expo-sharing`, `expo-print`, `expo-file-system`, `react-native-gesture-handler`, `react-native-reanimated`, `@react-native-community/datetimepicker` and `react-native-keyboard-controller` are NOT in the shipped binary and must not be imported. Already available and usable: `expo-camera`, `expo-clipboard`, `expo-web-browser`, `react-native-qrcode-svg`, `@react-native-picker/picker`, `react-native-chart-kit`, `@expo/vector-icons`, and React Native core `Share` / `Linking`.
- **Auth untouched.** No edits under `frontend/src/screens/auth`, `backend/src/auth`, or the Truecaller plugin.
- **Six locales, always:** `en, hi, bn, ta, te, or` at `frontend/src/i18n/locales/<lang>/<ns>.ts`. These are **TS namespace files, not JSON**. `localeParity.test.ts` is **bidirectional** — a key present in `en` and missing from any other locale fails, and a key present in another locale and missing from `en` also fails. Every new key lands in all six in the same commit, with a real translation, not the English string.
- **`keyUsage.test.ts` ratchets at `KNOWN_DEFAULTED_BACKLOG = 63`** with a `<=` bound. Any `t('some.key')` whose key does not resolve in the `en` bundle and carries no inline `defaultValue` is a hard build failure. Never raise the constant.
- **Gate every commit:** in the package changed, `npx tsc --noEmit` and `npx jest --maxWorkers=2 --forceExit`. On frontend additionally `bash scripts/check-calculator-i18n.sh`.
- **Migrations are hand-run in production** (`migrationsRun: false`). Every migration must be additive, idempotent (`IF NOT EXISTS`), reversible (a real `down`), and follow the house style of `backend/src/migrations/1780600200000-AddInventoryIcon.ts`. FKs go inside `DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN NULL; END $$;`.
- **Files have mixed CRLF/LF.** Use the Edit tool, never `sed -i`. **`python` is not available on this box.** Bash heredocs of the form `cat > file <<EOF` may be blocked by the harness classifier — use the Write tool.
- **Read a file before editing it.** Grep output does not count as having read it.
- Branch: `feat/phase3-polish`, already created off master `7b20fdf`, with the spec committed as `3e6ac1e`.

---

## File Structure

**Part A — freshness (frontend only, no backend change)**

| File | Responsibility |
|---|---|
| `frontend/src/features/logProgress.ts` | **Modify.** Owns the freshness rule (`pondFreshness`, thresholds). Already the single definition of "done"; staleness is its multi-day sibling. |
| `frontend/src/utils/formatDate.ts` | **Modify.** Gains `formatAge` — the never-throws, app-language age string. |
| `frontend/src/utils/pondHealth.ts` | **Modify.** `PondHealth` gains `stale`; `healthOf` gains a third parameter; `FarmRollup` gains a count. |
| `frontend/src/api/pondContext.ts` | **Modify.** Type-only: add the five per-parameter `…AsOf` fields the backend already sends. |
| `frontend/src/theme/colorRoles.ts` | **Modify.** Three new roles for the stale state. |
| `frontend/src/screens/farms/FarmsListScreen.tsx` | **Modify.** Card third stat, strip, legend, totals. |
| `frontend/src/screens/farms/FarmDetailScreen.tsx` | **Modify.** Pond row age chip and border. |
| `frontend/src/screens/ponds/PondDashboardScreen.tsx` | **Modify.** `ConfidenceChip` + per-reading age. |
| `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/common.ts` | **Modify.** Age strings. |
| `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/farms.ts` | **Modify.** Stale labels. |
| `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/ponds.ts` | **Modify.** Last-log chip label. |

**Part B — §5 (backend + frontend)**

| File | Responsibility |
|---|---|
| `backend/src/migrations/1780600300000-AddInventoryMovements.ts` | **Create.** Ledger table. |
| `backend/src/migrations/1780600400000-AddInventoryFarms.ts` | **Create.** Join table, backfill, `farm_id` nullable. |
| `backend/src/migrations/1780600500000-AddTransactionInventoryItem.ts` | **Create.** `transactions.inventory_item_id`. |
| `backend/src/migrations/1780600600000-FixExpensesUserFk.ts` | **Create.** `expenses.user_id` nullable + SET NULL. |
| `backend/src/inventory/inventory-movement.entity.ts` | **Create.** Ledger entity. |
| `backend/src/inventory/inventory-farm.entity.ts` | **Create.** Join entity — carries the zero-rows-means-unpaired comment. |
| `backend/src/inventory/inventory.service.ts` | **Modify.** Movement write inside the atomic UPDATE; multi-farm authorisation; purchase transaction. |
| `backend/src/inventory/inventory.controller.ts` | **Modify.** Movements list endpoint. |
| `backend/src/transactions/transaction.entity.ts` | **Modify.** `inventoryItemId`. |
| `backend/src/transactions/transactions.service.ts` | **Modify.** Write capability gate. |
| `backend/src/finances/expense.entity.ts` | **Modify.** `userId` nullable. |
| `backend/src/farm-members/farm-invites.service.ts` | **Modify.** Push on both join paths. |
| `backend/src/leave-requests/leave-requests.service.ts` | **Modify.** Push on create. |
| `backend/src/farm-members/farm-members.module.ts`, `backend/src/leave-requests/leave-requests.module.ts` | **Modify.** Import `PushModule`. |
| `backend/src/crops/crops.service.ts` | **Modify.** Delete dead `findByPond`. |
| `frontend/src/features/notificationRouting.ts` | **Modify.** Two new push types. |
| `frontend/src/navigation/linking.ts` | **Modify.** `JoinFarm: 'join/:code'`. |
| `frontend/src/screens/onboarding/JoinFarmScreen.tsx` | **Modify.** Accept route param. |
| `frontend/src/screens/farms/AddWorkerScreen.tsx` | **Modify.** Not-found → invite branch. |
| `frontend/src/screens/inventory/InventoryFormScreen.tsx` | **Modify.** Pairing chooser. |
| `frontend/src/screens/inventory/InventoryDetailScreen.tsx` | **Modify.** Movements list replaces the single reason row. |
| `frontend/src/constants/ranges.ts` | **Delete.** Consolidated into `waterQualityThresholds.ts`. |
| `frontend/src/screens/main/ReportsScreen.tsx` | **Delete.** Unreachable. |
| `frontend/src/navigation/MainNavigator.tsx:19` | **Modify.** Drop the dead import. |

---

# PART A — DATA FRESHNESS

### Task 1: The freshness rule

**Files:**
- Modify: `frontend/src/api/pondContext.ts:26-31` (the `waterQuality` block)
- Modify: `frontend/src/features/logProgress.ts` (append after `chemistryDone`, around `:72`)
- Test: `frontend/src/features/__tests__/logProgress.test.ts`

**Interfaces:**
- Consumes: `PondContext` from `frontend/src/api/pondContext.ts`.
- Produces: `type Freshness = 'fresh' | 'stale' | 'noData'`; `interface PondFreshness { state: Freshness; asOf: string | null; ageMs: number | null }`; `const STALE_AFTER_MS: number`; `const NO_DATA_AFTER_MS: number`; `const pondFreshness: (ctx: PondContext, now: Date) => PondFreshness`. Task 3 consumes `pondFreshness` and `PondFreshness`; Tasks 5 and 6 consume `PondFreshness.ageMs`.

- [ ] **Step 1: Add the missing context fields (type-only, no logic)**

The backend already sends these (`backend/src/pond-context/pond-context.service.ts:62-72`); the client interface just never declared them. In `frontend/src/api/pondContext.ts`, inside the `waterQuality` object type, replace:

```ts
    /** When the daily probe params were last logged. */
    recordedAt: string | null;
    /** When ammonia (chemistry) was last measured — may be older. */
    chemistryAsOf: string | null;
  } | null;
```

with:

```ts
    /** When the newest water-quality record was logged. */
    recordedAt: string | null;
    /**
     * Each parameter's OWN source-record time. Probe params can come from
     * different records than one another, so freshness is per-parameter —
     * a pH-only log does not make yesterday's DO reading current.
     */
    dissolvedOxygenAsOf: string | null;
    phAsOf: string | null;
    temperatureAsOf: string | null;
    salinityAsOf: string | null;
    /** When ammonia (chemistry) was last measured — may be older. */
    chemistryAsOf: string | null;
    /** When alkalinity was last measured — independent of ammonia's date. */
    alkalinityAsOf: string | null;
  } | null;
```

- [ ] **Step 2: Write the failing tests**

Append to `frontend/src/features/__tests__/logProgress.test.ts`. Read the top of that file first and reuse its existing `ctx(...)` factory if one is present; if not, define the local helper shown here.

```ts
import { pondFreshness, STALE_AFTER_MS, NO_DATA_AFTER_MS } from '../logProgress';
import type { PondContext } from '../../api/pondContext';

const NOW = new Date('2026-09-04T10:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

const freshCtx = (recordedAt: string | null): PondContext =>
    ({ pondId: 'p1', waterQuality: recordedAt ? { recordedAt } : null }) as PondContext;

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
```

- [ ] **Step 3: Run the tests and verify they fail**

Run: `cd frontend && npx jest src/features/__tests__/logProgress.test.ts -t pondFreshness --forceExit`
Expected: FAIL — `pondFreshness is not a function` / import error.

- [ ] **Step 4: Implement**

Append to `frontend/src/features/logProgress.ts`:

```ts
/**
 * How much a pond's health colour can be trusted.
 *
 * The alert engine reports on readings it HAS; it cannot report "nobody gave
 * me a reading". So a pond with no alerts and a pond nobody has logged for
 * three weeks arrived at the same green bar. This is the missing half.
 *
 * Measured off the newest water-quality record and nothing else. Feed and
 * sampling deliberately do NOT count: a pond can be fed every day and still
 * have entirely unmeasured water, and letting a feed log stand in for a water
 * reading would put the same false green back in a new place.
 *
 * Thresholds are two days and seven days, NOT the backend's own one-day
 * confidence window (pond-context.service.ts). That window is right for
 * scoring an engine's input; applied to a colour bar it turns nearly every
 * pond grey every morning, and a signal that fires constantly is not a signal.
 */
export type Freshness = 'fresh' | 'stale' | 'noData';

export interface PondFreshness {
    state: Freshness;
    /** The source record's time, or null if there has never been one. */
    asOf: string | null;
    /** null when there is nothing to measure from — never Infinity. */
    ageMs: number | null;
}

export const STALE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
export const NO_DATA_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export const pondFreshness = (ctx: PondContext, now: Date): PondFreshness => {
    const asOf = ctx.waterQuality?.recordedAt ?? null;
    const t = asOf ? new Date(asOf).getTime() : NaN;
    if (!Number.isFinite(t)) return { state: 'noData', asOf: null, ageMs: null };

    const ageMs = now.getTime() - t;
    const state: Freshness =
        ageMs > NO_DATA_AFTER_MS ? 'noData' : ageMs > STALE_AFTER_MS ? 'stale' : 'fresh';
    return { state, asOf, ageMs };
};
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `cd frontend && npx jest src/features/__tests__/logProgress.test.ts --forceExit`
Expected: PASS, including the pre-existing tests in that file.

- [ ] **Step 6: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/logProgress.ts frontend/src/features/__tests__/logProgress.test.ts frontend/src/api/pondContext.ts
git commit -m "feat(freshness): pondFreshness rule and the per-parameter asOf fields"
```

---

### Task 2: Compact age formatting

**Files:**
- Modify: `frontend/src/utils/formatDate.ts` (append after `formatNumber`)
- Modify: `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/common.ts`
- Test: `frontend/src/utils/__tests__/formatDate.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `const formatAge: (value: string | number | Date | null | undefined, now?: Date) => string`. Tasks 4, 5 and 6 render its result.

- [ ] **Step 1: Add the i18n keys to all six locales**

`keyUsage.test.ts` fails the build on a key that does not resolve in `en`, and `localeParity.test.ts` is bidirectional — so all six files change together, in this commit. Add to each `frontend/src/i18n/locales/<lang>/common.ts`, just before the closing `};`:

`en`:
```ts
  // Compact data-age hints — "4 h", "3 d", "never". Deliberately terse: these
  // sit inside chips and strip captions, not sentences.
  ageJustNow: "<1 h",
  ageHours: "{{count}} h",
  ageDays: "{{count}} d",
  ageNever: "never",
```

`hi`:
```ts
  ageJustNow: "<1 घं",
  ageHours: "{{count}} घं",
  ageDays: "{{count}} दि",
  ageNever: "कभी नहीं",
```

`bn`:
```ts
  ageJustNow: "<১ ঘ",
  ageHours: "{{count}} ঘ",
  ageDays: "{{count}} দি",
  ageNever: "কখনও নয়",
```

`ta`:
```ts
  ageJustNow: "<1 ம",
  ageHours: "{{count}} ம",
  ageDays: "{{count}} நா",
  ageNever: "இல்லை",
```

`te`:
```ts
  ageJustNow: "<1 గం",
  ageHours: "{{count}} గం",
  ageDays: "{{count}} రో",
  ageNever: "ఎప్పుడూ లేదు",
```

`or`:
```ts
  ageJustNow: "<1 ଘ",
  ageHours: "{{count}} ଘ",
  ageDays: "{{count}} ଦି",
  ageNever: "କେବେ ନୁହେଁ",
```

- [ ] **Step 2: Write the failing test**

Create or append to `frontend/src/utils/__tests__/formatDate.test.ts`:

```ts
import { formatAge } from '../formatDate';

const NOW = new Date('2026-09-04T10:00:00.000Z');
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3600_000).toISOString();

describe('formatAge', () => {
    it('reads under an hour as a floor, not "0 h"', () => {
        expect(formatAge(hoursAgo(0.5), NOW)).toBe('<1 h');
    });

    it('reads hours below a day', () => {
        expect(formatAge(hoursAgo(4), NOW)).toBe('4 h');
        expect(formatAge(hoursAgo(23), NOW)).toBe('23 h');
    });

    it('switches to days at 24 hours', () => {
        expect(formatAge(hoursAgo(24), NOW)).toBe('1 d');
        expect(formatAge(hoursAgo(24 * 12), NOW)).toBe('12 d');
    });

    it('says never for a missing timestamp', () => {
        expect(formatAge(null, NOW)).toBe('never');
        expect(formatAge(undefined, NOW)).toBe('never');
    });

    it('says never for an unparseable timestamp rather than throwing', () => {
        expect(formatAge('not-a-date', NOW)).toBe('never');
    });

    it('does not render a future timestamp as a negative age', () => {
        // Phone clocks drift and offline records carry client-minted times.
        expect(formatAge(new Date(NOW.getTime() + 3600_000).toISOString(), NOW)).toBe('<1 h');
    });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `cd frontend && npx jest src/utils/__tests__/formatDate.test.ts --forceExit`
Expected: FAIL — `formatAge is not a function`.

- [ ] **Step 4: Implement**

Append to `frontend/src/utils/formatDate.ts`:

```ts
/**
 * "4 h" / "3 d" / "never" — how old a piece of data is, in the width of a chip.
 *
 * Floors rather than rounds: a reading 23.9 hours old is "23 h", not "1 d".
 * Rounding up would let a stale reading read fresher than it is, which is the
 * exact failure this whole feature exists to remove.
 *
 * A future timestamp clamps to "<1 h" rather than showing a negative age —
 * phone clocks drift and offline records carry client-minted times.
 */
export const formatAge = (
    value: string | number | Date | null | undefined,
    now: Date = new Date(),
): string => {
    if (value == null) return i18n.t('common.ageNever');
    const d = toDate(value);
    if (!d) return i18n.t('common.ageNever');

    const ms = Math.max(0, now.getTime() - d.getTime());
    const hours = Math.floor(ms / 3_600_000);
    if (hours < 1) return i18n.t('common.ageJustNow');
    if (hours < 24) return i18n.t('common.ageHours', { count: hours });
    return i18n.t('common.ageDays', { count: Math.floor(hours / 24) });
};
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `cd frontend && npx jest src/utils/__tests__/formatDate.test.ts --forceExit`
Expected: PASS.

- [ ] **Step 6: Run the i18n gates**

Run: `cd frontend && npx jest src/i18n --forceExit && bash scripts/check-calculator-i18n.sh`
Expected: PASS; `localeParity` green, `keyUsage` still at or under 63, `calculator i18n check passed`.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/formatDate.ts frontend/src/utils/__tests__/formatDate.test.ts frontend/src/i18n/locales
git commit -m "feat(freshness): formatAge compact data-age hint in six locales"
```

---

### Task 3: The stale health state

**Files:**
- Modify: `frontend/src/theme/colorRoles.ts:31-41` (the Status block)
- Modify: `frontend/src/utils/pondHealth.ts` (`PondHealth`, `HEALTH_RANK`, `HEALTH_COLOR`, `HEALTH_TEXT`, `healthOf`, `PondWithHealth`, `FarmRollup`, `rollUpFarm`, `buildPondRows`)
- Test: `frontend/src/utils/__tests__/pondHealth.test.ts`

**Interfaces:**
- Consumes: `pondFreshness`, `PondFreshness` from Task 1.
- Produces: `PondHealth` now includes `'stale'`; `healthOf(pond, severity, freshness?)` takes a third parameter of type `Freshness | undefined`; `PondWithHealth` gains `freshness: PondFreshness`; `FarmRollup` gains `stale: number`. Tasks 4, 5 and 6 consume all four.

- [ ] **Step 1: Add the theme roles**

In `frontend/src/theme/colorRoles.ts`, inside the Status block after the `info*` triple, add:

```ts
    // Stale — "this data is too old to trust", NOT "this water is bad".
    // Deliberately not amber: amber is `watch`, and a farmer must never read
    // "nobody logged it" as "something is wrong with the pond". Darker than
    // borderDefault (#E0E8EC) so a stale bar is distinguishable from a fallow one.
    staleText: '#3E5163',
    staleBg: '#EDF1F4',
    staleBorder: '#8496A6',
```

- [ ] **Step 2: Write the failing tests**

Append to `frontend/src/utils/__tests__/pondHealth.test.ts`:

```ts
describe('healthOf with freshness', () => {
    it('never reports fine when the data is not fresh', () => {
        // The whole point: green must mean "checked recently and OK".
        expect(healthOf(pond(), null, 'stale')).toBe('stale');
        expect(healthOf(pond(), null, 'noData')).toBe('stale');
    });

    it('lets a real alert outrank silence', () => {
        expect(healthOf(pond(), 'critical', 'noData')).toBe('critical');
        expect(healthOf(pond(), 'watch', 'stale')).toBe('watch');
    });

    it('leaves a fallow pond fallow — an empty pond has nothing to be stale about', () => {
        expect(healthOf(pond({ activeCycleId: null }), null, 'noData')).toBe('fallow');
    });

    it('still reads fine when the data is fresh', () => {
        expect(healthOf(pond(), null, 'fresh')).toBe('fine');
    });

    it('defaults to the old behaviour when freshness is not supplied', () => {
        // Keeps every existing caller and test honest during the rollout.
        expect(healthOf(pond(), null)).toBe('fine');
    });
});

describe('stale ranking and roll-up', () => {
    it('sorts stale above fine and below watch', () => {
        const row = (health: any, id: string): PondWithHealth =>
            ({ pond: pond({ id, name: id }), health, reason: null, context: null }) as any;
        const sorted = sortByHealth([
            row('fine', 'a'),
            row('stale', 'b'),
            row('watch', 'c'),
        ]);
        expect(sorted.map((r) => r.health)).toEqual(['watch', 'stale', 'fine']);
    });

    it('counts stale ponds on the roll-up', () => {
        const rows = buildPondRows(
            [pond({ id: 'p1' }), pond({ id: 'p2' })],
            [
                ctx({ pondId: 'p1', waterQuality: { recordedAt: new Date().toISOString() } as any }),
                ctx({ pondId: 'p2', waterQuality: { recordedAt: '2026-01-01T00:00:00.000Z' } as any }),
            ],
            [],
            new Date('2026-09-04T10:00:00.000Z'),
        );
        expect(rollUpFarm(rows).stale).toBe(1);
    });

    it('attaches freshness to each row so screens need not recompute it', () => {
        const rows = buildPondRows(
            [pond({ id: 'p1' })],
            [ctx({ pondId: 'p1', waterQuality: null as any })],
            [],
            new Date('2026-09-04T10:00:00.000Z'),
        );
        expect(rows[0].freshness).toEqual({ state: 'noData', asOf: null, ageMs: null });
    });
});
```

- [ ] **Step 3: Run the tests and verify they fail**

Run: `cd frontend && npx jest src/utils/__tests__/pondHealth.test.ts --forceExit`
Expected: FAIL — `healthOf` ignores the third argument, `rollUpFarm(...).stale` is undefined, `buildPondRows` takes three arguments.

- [ ] **Step 4: Implement in `frontend/src/utils/pondHealth.ts`**

4a. Import the rule and widen the type:

```ts
import { pondFreshness, type Freshness, type PondFreshness } from '../features/logProgress';
```

```ts
export type PondHealth = 'critical' | 'watch' | 'stale' | 'fine' | 'fallow';
```

4b. Rank — `stale` between `watch` and `fine`, so worst-first sorting floats un-logged ponds up with no second sort key:

```ts
export const HEALTH_RANK: Record<PondHealth, number> = {
    critical: 0,
    watch: 1,
    stale: 2,
    fine: 3,
    fallow: 4,
};
```

4c. Colours — add to both maps:

```ts
export const HEALTH_COLOR: Record<PondHealth, string> = {
    critical: theme.roles.light.dangerBorder,
    watch: theme.roles.light.warningBorder,
    // Slate, not amber. `stale` and `noData` share one colour because the bar
    // answers "can I trust this", and the answer is the same for both; the age
    // hint beside it is what distinguishes "8 d" from "never logged".
    stale: theme.roles.light.staleBorder,
    fine: theme.roles.light.successBorder,
    fallow: theme.roles.light.borderDefault,
};

export const HEALTH_TEXT: Record<PondHealth, string> = {
    critical: theme.roles.light.dangerText,
    watch: theme.roles.light.warningText,
    stale: theme.roles.light.staleText,
    fine: theme.roles.light.textTertiary,
    fallow: theme.roles.light.textTertiary,
};
```

4d. `healthOf` — the third parameter is optional so existing callers and tests keep compiling; the screens all pass it after Tasks 4-6:

```ts
export const healthOf = (
    pond: Pick<Pond, 'status' | 'activeCycleId'>,
    severity?: AlertSeverity | null,
    freshness?: Freshness,
): PondHealth => {
    if (isFallow(pond)) return 'fallow';
    if (severity === 'critical') return 'critical';
    if (severity === 'watch') return 'watch';
    // A real alarm outranks silence; silence outranks a confident green.
    if (freshness && freshness !== 'fresh') return 'stale';
    return 'fine';
};
```

4e. `PondWithHealth` gains the freshness detail:

```ts
export interface PondWithHealth {
    pond: Pond;
    health: PondHealth;
    /** The engine's one-line reason, when there is one. */
    reason: string | null;
    context: PondContext | null;
    freshness: PondFreshness;
}
```

4f. `FarmRollup` and `rollUpFarm`:

```ts
    actNow: number;
    watch: number;
    /** Ponds whose colour is only "fine" because nobody has logged them. */
    stale: number;
```

```ts
        actNow: rows.filter((r) => r.health === 'critical').length,
        watch: rows.filter((r) => r.health === 'watch').length,
        stale: rows.filter((r) => r.health === 'stale').length,
```

4g. `buildPondRows` takes the clock so the whole thing stays pure and testable:

```ts
export const buildPondRows = (
    ponds: Pond[],
    contexts: PondContext[],
    briefing: BriefingItem[],
    now: Date = new Date(),
): PondWithHealth[] => {
    const severity = severityByPond(briefing);
    const reason = new Map(
        briefing.filter((b) => b.pondId).map((b) => [b.pondId as string, b.topTitle]),
    );
    const ctxById = new Map(contexts.map((c) => [c.pondId, c]));

    return ponds.map((pond) => {
        const context = ctxById.get(pond.id) ?? null;
        // No context at all is not evidence of freshness — treat it as unknown.
        const freshness: PondFreshness = context
            ? pondFreshness(context, now)
            : { state: 'noData', asOf: null, ageMs: null };
        const health = healthOf(pond, severity.get(pond.id), freshness.state);
        return {
            pond,
            health,
            reason: health === 'critical' || health === 'watch' ? reason.get(pond.id) ?? null : null,
            context,
            freshness,
        };
    });
};
```

- [ ] **Step 5: Run the tests and verify they pass**

Run: `cd frontend && npx jest src/utils/__tests__/pondHealth.test.ts --forceExit`
Expected: PASS, including the pre-existing tests in the file.

- [ ] **Step 6: Typecheck and full suite**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: exit 0. Screens that build a `PondWithHealth` literal by hand will now fail to typecheck on the missing `freshness` — fix those at their call sites by letting `buildPondRows` produce the row rather than hand-rolling it.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/utils/pondHealth.ts frontend/src/utils/__tests__/pondHealth.test.ts frontend/src/theme/colorRoles.ts
git commit -m "feat(freshness): stale pond health state, ranked below watch and above fine"
```

---

### Task 4: Farms list — the card that said "All fine"

**Files:**
- Modify: `frontend/src/screens/farms/FarmsListScreen.tsx:181` (`cards` memo), `:399-408` (third stat), `:452-463` (`PondStrip`), `:465-483` (`Legend`), `:207-217` (`totals`)
- Modify: `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/farms.ts`
- Test: `frontend/src/screens/farms/__tests__/FarmsListScreen.test.tsx`

**Interfaces:**
- Consumes: `FarmRollup.stale`, `HEALTH_COLOR.stale` (Task 3); `formatAge` (Task 2).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Add the i18n keys to all six locales**

Add to each `frontend/src/i18n/locales/<lang>/farms.ts`:

`en`:
```ts
  notUpdated: "Not updated",
  notUpdatedCount_one: "{{count}} not updated",
  notUpdatedCount_other: "{{count}} not updated",
```
`hi`:
```ts
  notUpdated: "अपडेट नहीं",
  notUpdatedCount_one: "{{count}} अपडेट नहीं",
  notUpdatedCount_other: "{{count}} अपडेट नहीं",
```
`bn`:
```ts
  notUpdated: "আপডেট হয়নি",
  notUpdatedCount_one: "{{count}}টি আপডেট হয়নি",
  notUpdatedCount_other: "{{count}}টি আপডেট হয়নি",
```
`ta`:
```ts
  notUpdated: "புதுப்பிக்கவில்லை",
  notUpdatedCount_one: "{{count}} புதுப்பிக்கவில்லை",
  notUpdatedCount_other: "{{count}} புதுப்பிக்கவில்லை",
```
`te`:
```ts
  notUpdated: "నవీకరించలేదు",
  notUpdatedCount_one: "{{count}} నవీకరించలేదు",
  notUpdatedCount_other: "{{count}} నవీకరించలేదు",
```
`or`:
```ts
  notUpdated: "ଅପଡେଟ୍ ହୋଇନାହିଁ",
  notUpdatedCount_one: "{{count}} ଅପଡେଟ୍ ହୋଇନାହିଁ",
  notUpdatedCount_other: "{{count}} ଅପଡେଟ୍ ହୋଇନାହିଁ",
```

- [ ] **Step 2: Write the failing test**

Read the existing `frontend/src/screens/farms/__tests__/FarmsListScreen.test.tsx` first and follow its mocking style for `farmsApi`, `pondsApi`, `alertCenterApi` and `pondContextApi`. Append:

```tsx
it('does not claim "All fine" for a farm nobody has logged', async () => {
    // The defect this screen shipped with: a farm untouched for a month
    // rendered a green card reading "All fine" in words, not just colour.
    mockFarms([{ id: 'f1', name: 'Farm A' }]);
    mockPonds([{ id: 'p1', farmId: 'f1', name: 'Pond 01', activeCycleId: 'c1', status: 'active' }]);
    mockBriefing([]);
    mockContexts([
        { pondId: 'p1', farmId: 'f1', waterQuality: { recordedAt: '2026-01-01T00:00:00.000Z' } },
    ]);

    const { queryByText, findByText } = render(<FarmsListScreen navigation={nav} />);

    // StatRow renders value and label as separate nodes, so assert on the
    // label and the absence of the claim — not on a joined string.
    expect(await findByText('Not updated')).toBeTruthy();
    expect(queryByText('All fine')).toBeNull();
});

it('counts un-logged ponds across every farm in the header', async () => {
    mockFarms([{ id: 'f1', name: 'Farm A' }, { id: 'f2', name: 'Farm B' }]);
    mockPonds([
        { id: 'p1', farmId: 'f1', name: 'Pond 01', activeCycleId: 'c1', status: 'active' },
        { id: 'p2', farmId: 'f2', name: 'Pond 02', activeCycleId: 'c2', status: 'active' },
    ]);
    mockBriefing([]);
    mockContexts([
        { pondId: 'p1', farmId: 'f1', waterQuality: { recordedAt: '2026-01-01T00:00:00.000Z' } },
        { pondId: 'p2', farmId: 'f2', waterQuality: { recordedAt: '2026-01-01T00:00:00.000Z' } },
    ]);

    const { findByText } = render(<FarmsListScreen navigation={nav} />);
    expect(await findByText('2 not updated')).toBeTruthy();
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `cd frontend && npx jest src/screens/farms/__tests__/FarmsListScreen.test.tsx --forceExit`
Expected: FAIL — "All fine" is still rendered.

- [ ] **Step 4: Implement**

4a. Pass a stable clock into the rows memo so a re-render mid-second cannot flip a bar. In the `cards` memo at `:181`:

```ts
    const cards: FarmCardData[] = useMemo(() => {
        const now = new Date();
        const rows = buildPondRows(ponds, contexts, briefing, now);
        return farms.map((farm) => ({
            farm,
            role: roleForFarm(farm.id),
            roll: rollUpFarm(rows.filter((r) => r.pond.farmId === farm.id)),
        }));
    }, [farms, ponds, contexts, briefing, roleForFarm]);
```

4b. The third stat — a stale branch **ahead of** the "All fine" fallthrough, at `:399-408`:

```ts
        const third =
            roll.actNow > 0
                ? { value: String(roll.actNow), label: t('farms.actNow'), tone: 'danger' as const }
                : roll.watch > 0
                  ? { value: String(roll.watch), label: t('farms.watch'), tone: 'warning' as const }
                  : roll.stale > 0
                    ? {
                          // Never "All fine" while a pond is unaccounted for.
                          value: String(roll.stale),
                          label: t('farms.notUpdated'),
                          tone: 'neutral' as const,
                      }
                    : {
                          value: t('farms.allFine'),
                          label: t('farms.status'),
                          tone: 'success' as const,
                          text: true,
                      };
```

If `StatRow`'s `tone` union has no `'neutral'` member, read `frontend/src/components/ui/StatRow.tsx` and add one mapping to `theme.roles.light.staleText`; do not reuse `warning`, which would read as an alarm.

4c. The legend at `:465` gains a fifth swatch:

```ts
    const entries: [PondHealth, string][] = [
        ['critical', t('farms.actNow')],
        ['watch', t('farms.watch')],
        ['stale', t('farms.notUpdated')],
        ['fine', t('farms.fine')],
        ['fallow', t('farms.fallow')],
    ];
```

4d. The screen totals at `:207-217` gain the count, and the eyebrow says it — this is where the pluralised `notUpdatedCount` key is used:

```ts
    const totals = useMemo(() => {
        const actNow = cards.reduce((a, c) => a + c.roll.actNow, 0);
        const stale = cards.reduce((a, c) => a + c.roll.stale, 0);
        const farmsAffected = cards.filter((c) => c.roll.actNow > 0).length;
        const biomassCards = cards.filter((c) => c.roll.biomassKg != null);
        const biomass = biomassCards.reduce((a, c) => a + (c.roll.biomassKg ?? 0), 0);
        return {
            actNow,
            stale,
            farmsAffected,
            biomassKg: biomassCards.length ? biomass : null,
        };
    }, [cards]);
```

and in the `eyebrow` memo at `:190-203`, after the existing parts:

```ts
        if (totals.stale > 0) parts.push(t('farms.notUpdatedCount', { count: totals.stale }));
```

`totals` is declared after `eyebrow` today — move the `eyebrow` memo below `totals` so the reference resolves, and add `totals` to its dependency array.

- [ ] **Step 5: Run the test and verify it passes**

Run: `cd frontend && npx jest src/screens/farms/__tests__/FarmsListScreen.test.tsx --forceExit`
Expected: PASS.

- [ ] **Step 6: Gates**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit && bash scripts/check-calculator-i18n.sh`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/screens/farms/FarmsListScreen.tsx frontend/src/screens/farms/__tests__ frontend/src/i18n/locales
git commit -m "feat(freshness): farms card stops reading All fine for un-logged ponds"
```

---

### Task 5: Farm detail — the age chip on each pond row

**Files:**
- Modify: `frontend/src/screens/farms/FarmDetailScreen.tsx:160` (rows memo), `:592-620` (`PondRow` body)
- Modify: `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/ponds.ts`
- Test: `frontend/src/screens/farms/__tests__/FarmDetailScreen.test.tsx`

**Interfaces:**
- Consumes: `PondWithHealth.freshness` (Task 3), `formatAge` (Task 2).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Add the i18n keys to all six locales**

Add to each `frontend/src/i18n/locales/<lang>/ponds.ts`:

`en`: `lastLog: "Last log {{age}}",`
`hi`: `lastLog: "अंतिम लॉग {{age}}",`
`bn`: `lastLog: "শেষ লগ {{age}}",`
`ta`: `lastLog: "கடைசி பதிவு {{age}}",`
`te`: `lastLog: "చివరి లాగ్ {{age}}",`
`or`: `lastLog: "ଶେଷ ଲଗ୍ {{age}}",`

- [ ] **Step 2: Write the failing test**

Append to `frontend/src/screens/farms/__tests__/FarmDetailScreen.test.tsx`, following the file's existing mock style:

```tsx
it('shows how old a pond row is when the log is stale', async () => {
    mockPonds([{ id: 'p1', farmId: 'f1', name: 'Pond 01', activeCycleId: 'c1', status: 'active' }]);
    mockContexts([
        {
            pondId: 'p1',
            farmId: 'f1',
            waterQuality: { recordedAt: new Date(Date.now() - 3 * 86400_000).toISOString() },
        },
    ]);
    mockBriefing([]);

    const { findByText } = render(<FarmDetailScreen route={route} navigation={nav} />);
    expect(await findByText('Last log 3 d')).toBeTruthy();
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `cd frontend && npx jest src/screens/farms/__tests__/FarmDetailScreen.test.tsx --forceExit`
Expected: FAIL — no such text.

- [ ] **Step 4: Implement**

4a. Pass the clock at `:160`:

```ts
    const rows = useMemo(
        () => sortByHealth(buildPondRows(ponds, contexts, briefing, new Date())),
        [ponds, contexts, briefing],
    );
```

4b. In `PondRow`, destructure `freshness` and render a third chip beside the existing `SessionHint`. Replace the `sessionHint` block:

```tsx
                {!!context && (
                    <View style={styles.sessionHint}>
                        <SessionHint ctx={context} />
                        {freshness.state !== 'fresh' && (
                            <View style={styles.staleChip}>
                                <Icon name="schedule" size={12} color={theme.roles.light.staleText} />
                                <Text style={styles.staleChipLabel} numberOfLines={1}>
                                    {t('ponds.lastLog', { age: formatAge(freshness.asOf) })}
                                </Text>
                            </View>
                        )}
                    </View>
                )}
```

The chip renders only when the data is not fresh — a fresh pond needs no caption, and adding one to every row would bury the signal in noise.

4c. Add the styles and imports (`formatAge` from `../../utils/formatDate`; `Icon` and `theme` are already imported in this file — verify before adding):

```ts
    staleChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: theme.spacing[2],
        height: theme.tokens.chip.height,
        borderRadius: theme.radius.full,
        borderWidth: 1,
        backgroundColor: theme.roles.light.staleBg,
        borderColor: theme.roles.light.staleBorder,
    },
    staleChipLabel: { ...theme.typeScale.labelSmall, color: theme.roles.light.staleText },
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `cd frontend && npx jest src/screens/farms/__tests__/FarmDetailScreen.test.tsx --forceExit`
Expected: PASS.

- [ ] **Step 6: Gates**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit && bash scripts/check-calculator-i18n.sh`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/screens/farms/FarmDetailScreen.tsx frontend/src/screens/farms/__tests__ frontend/src/i18n/locales
git commit -m "feat(freshness): last-log age chip on farm detail pond rows"
```

---

### Task 6: Pond dashboard — confidence and per-reading age

**Files:**
- Modify: `frontend/src/screens/ponds/PondDashboardScreen.tsx`
- Test: `frontend/src/screens/ponds/__tests__/PondDashboardScreen.test.tsx`

**Interfaces:**
- Consumes: `formatAge` (Task 2), the per-parameter `…AsOf` fields (Task 1), `ConfidenceChip` (existing, `frontend/src/components/ui/ConfidenceChip.tsx`).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Write the failing test**

```tsx
it('captions each water-quality reading with its own age', async () => {
    // A pH-only log must not make yesterday's DO reading look current.
    mockContext({
        pondId: 'p1',
        waterQuality: {
            dissolvedOxygen: 5.2,
            ph: 7.9,
            recordedAt: new Date(Date.now() - 3600_000).toISOString(),
            phAsOf: new Date(Date.now() - 3600_000).toISOString(),
            dissolvedOxygenAsOf: new Date(Date.now() - 3 * 86400_000).toISOString(),
        },
        confidence: { score: 40, band: 'low', missing: [], stale: ['DO'] },
    });

    const { findByText } = render(<PondDashboardScreen route={route} navigation={nav} />);
    expect(await findByText('3 d')).toBeTruthy();
    expect(await findByText(/low/i)).toBeTruthy();
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `cd frontend && npx jest src/screens/ponds/__tests__/PondDashboardScreen.test.tsx --forceExit`
Expected: FAIL.

- [ ] **Step 3: Implement**

3a. Import and render `ConfidenceChip` near the top of the screen body, where the pond's headline numbers are:

```tsx
import { ConfidenceChip } from '../../components/ui/ConfidenceChip';
```

```tsx
{ctx?.confidence && <ConfidenceChip confidence={ctx.confidence} showHint />}
```

`showHint` is on deliberately: this is the screen where the farmer can act on "log the chemistry", so the improve-hint has somewhere to lead.

3b. On the water-quality tile, caption each reading with its own timestamp. Read the tile's current render first, then add a caption under each value:

```tsx
const readingAge = (asOf: string | null | undefined) =>
    asOf ? formatAge(asOf) : t('common.ageNever');
```

```tsx
<Text style={styles.readingAge}>{readingAge(ctx?.waterQuality?.dissolvedOxygenAsOf)}</Text>
```

and the same for `phAsOf`, `temperatureAsOf`, `salinityAsOf`, `chemistryAsOf`, `alkalinityAsOf`. Style:

```ts
    readingAge: { ...theme.typeScale.caption, color: theme.roles.light.textTertiary },
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `cd frontend && npx jest src/screens/ponds/__tests__/PondDashboardScreen.test.tsx --forceExit`

- [ ] **Step 5: Gates**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit && bash scripts/check-calculator-i18n.sh`

- [ ] **Step 6: Commit**

```bash
git add frontend/src/screens/ponds frontend/src/i18n/locales
git commit -m "feat(freshness): confidence chip and per-reading age on the pond dashboard"
```

---

# PART B — §5 ITEMS

### Task 7: Inventory movements ledger

**Files:**
- Create: `backend/src/migrations/1780600300000-AddInventoryMovements.ts`
- Create: `backend/src/inventory/inventory-movement.entity.ts`
- Modify: `backend/src/inventory/inventory.service.ts:140-205` (`adjustStock`), `backend/src/inventory/inventory.module.ts`, `backend/src/inventory/inventory.controller.ts`
- Test: `backend/src/inventory/inventory.service.spec.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: entity `InventoryMovement` with `{ id, inventoryId, delta, reason, createdById, createdAt, feedRecordId }`; `InventoryService.listMovements(itemId: string, userId: string): Promise<InventoryMovement[]>`; `AdjustStockOptions` gains `feedRecordId?: string`. Task 8 consumes the entity; Task 9 does not.

- [ ] **Step 1: Write the migration**

Create `backend/src/migrations/1780600300000-AddInventoryMovements.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The stock ledger the single `last_adjustment_reason` column was standing in for.
 *
 * Today every adjustment overwrites one text column, and the feed pipeline
 * writes four literals into it — 'Feed log', 'Feed log failed', 'Feed log
 * edited', 'Feed log deleted'. After the fact a deduction, its compensating
 * credit, an edit and a delete are indistinguishable, with no quantity and no
 * actor retained. This table keeps all four.
 *
 * `last_adjustment_reason` is deliberately NOT dropped — it is one column, it
 * costs nothing, and InventoryDetailScreen still reads it.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddInventoryMovements1780600300000 implements MigrationInterface {
  name = 'AddInventoryMovements1780600300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_movements" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "inventory_id" uuid NOT NULL,
        "delta" numeric NOT NULL,
        "reason" text,
        "created_by_id" uuid,
        "feed_record_id" uuid,
        "created_at" timestamp with time zone NOT NULL DEFAULT now(),
        CONSTRAINT "PK_inventory_movements" PRIMARY KEY ("id")
      )
    `);
    // The query the detail screen runs: one item's history, newest first.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_movements_item_created"
        ON "inventory_movements" ("inventory_id", "created_at" DESC)
    `);

    // Actor and feed link are SET NULL, never CASCADE: deleting a user or a
    // feed record must not erase the record that the stock moved.
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "inventory_movements"
          ADD CONSTRAINT "FK_inventory_movements_inventory"
          FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "inventory_movements"
          ADD CONSTRAINT "FK_inventory_movements_user"
          FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    await queryRunner.query(
      `ALTER TABLE "inventory_movements" ENABLE ROW LEVEL SECURITY`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_movements"`);
  }
}
```

`feed_record_id` intentionally carries no FK: feed records are hard-deleted (`feed-records.service.ts:235-249`), and the movement must outlive the record it describes.

- [ ] **Step 2: Write the entity**

Create `backend/src/inventory/inventory-movement.entity.ts`:

```ts
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { InventoryItem } from './inventory-item.entity';

/**
 * One stock change. Append-only: nothing updates or deletes a row here.
 *
 * `delta` is signed — negative is a deduction (a feed log), positive a credit
 * (a purchase, or the compensating credit when a feed save fails after the
 * stock was already taken).
 */
@Entity('inventory_movements')
@Index(['inventoryId', 'createdAt'])
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'inventory_id', type: 'uuid' })
  inventoryId: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_id' })
  item: InventoryItem;

  @Column({ type: 'numeric' })
  delta: number;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** Null when the actor is gone — the movement still happened. */
  @Column({ name: 'created_by_id', type: 'uuid', nullable: true })
  createdById: string | null;

  /** No FK: feed records are hard-deleted and the movement must outlive them. */
  @Column({ name: 'feed_record_id', type: 'uuid', nullable: true })
  feedRecordId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
```

- [ ] **Step 3: Write the failing tests**

Append to `backend/src/inventory/inventory.service.spec.ts`, following its existing mock-repository style:

```ts
describe('adjustStock movement ledger', () => {
  it('writes a movement row carrying the delta, reason and actor', async () => {
    await service.adjustStock('item-1', -5, 'user-1', {
      capability: 'MANAGE_INVENTORY',
      reason: 'Feed log',
    });
    expect(movementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        inventoryId: 'item-1',
        delta: -5,
        reason: 'Feed log',
        createdById: 'user-1',
      }),
    );
  });

  it('writes no movement when the negative-stock guard rejects the update', async () => {
    // The UPDATE is what enforces `quantity + delta >= 0`. A movement written
    // when affected === 0 would record a change that did not happen.
    updateResult.affected = 0;
    await expect(
      service.adjustStock('item-1', -999, 'user-1', { capability: 'MANAGE_INVENTORY' }),
    ).rejects.toThrow(BadRequestException);
    expect(movementRepo.save).not.toHaveBeenCalled();
  });

  it('links a feed-driven movement back to its feed record', async () => {
    await service.adjustStock('item-1', -2, 'user-1', {
      capability: 'WRITE_OPERATIONAL',
      reason: 'Feed log',
      feedRecordId: 'feed-9',
    });
    expect(movementRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ feedRecordId: 'feed-9' }),
    );
  });
});
```

- [ ] **Step 4: Run the tests and verify they fail**

Run: `cd backend && npx jest src/inventory/inventory.service.spec.ts --forceExit`
Expected: FAIL — no `movementRepo`.

- [ ] **Step 5: Implement**

5a. `inventory.module.ts` — add `InventoryMovement` to `TypeOrmModule.forFeature([...])`.

5b. `inventory.service.ts` — inject the repo, extend the options interface, and write the row **after** the guard, only when the UPDATE actually applied:

```ts
export interface AdjustStockOptions {
  reason?: string;
  capability?: FarmCapability;
  expectedFarmId?: string;
  /** Set by the feed pipeline so a deduction can be traced to its log. */
  feedRecordId?: string;
}
```

Immediately after the existing `if (result.affected === 0) throw new BadRequestException(...)`:

```ts
    // Append-only ledger. Written after the guard, so a rejected adjustment
    // leaves no trace of a change that never happened.
    await this.movementRepo.save(
      this.movementRepo.create({
        inventoryId: id,
        delta: quantityChange,
        reason: options.reason ?? null,
        createdById: userId ?? null,
        feedRecordId: options.feedRecordId ?? null,
      }),
    );
```

5c. `listMovements`, gated on the same capability as reading the item:

```ts
  /** One item's stock history, newest first. */
  async listMovements(itemId: string, userId: string): Promise<InventoryMovement[]> {
    await this.loadItem(itemId, userId, 'VIEW_INVENTORY');
    return this.movementRepo.find({
      where: { inventoryId: itemId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }
```

5d. `inventory.controller.ts` — add the route **above** `@Get(':id')`, or `:id` will swallow it:

```ts
  @Get(':id/movements')
  listMovements(@Param('id') id: string, @CurrentUser() user) {
    return this.inventoryService.listMovements(id, user.id);
  }
```

5e. `feed-records.service.ts` — pass `feedRecordId` on each of the four `adjustStock` calls (deduct `:71-83`, compensate `:107-124`, reconcile `:204-217`, credit-on-delete `:235-249`). The compensating call at `:107-124` also currently passes no `expectedFarmId`; add `expectedFarmId: pond.farmId` there for symmetry with the deduction it reverses.

- [ ] **Step 6: Run the tests and verify they pass**

Run: `cd backend && npx jest src/inventory --forceExit`

- [ ] **Step 7: Gates**

Run: `cd backend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`

- [ ] **Step 8: Commit**

```bash
git add backend/src/inventory backend/src/migrations/1780600300000-AddInventoryMovements.ts backend/src/feed-records
git commit -m "feat(inventory): append-only movements ledger replaces the overwritten reason"
```

---

### Task 8: Inventory multi-farm pairing

**Files:**
- Create: `backend/src/migrations/1780600400000-AddInventoryFarms.ts`
- Create: `backend/src/inventory/inventory-farm.entity.ts`
- Modify: `backend/src/inventory/inventory-item.entity.ts:18-24`, `backend/src/inventory/inventory.service.ts:47-135`, `backend/src/inventory/inventory.module.ts`
- Modify: `backend/src/inventory/dto/create-inventory-item.dto.ts`
- Modify: `frontend/src/api/inventory.ts`, `frontend/src/screens/inventory/InventoryFormScreen.tsx`
- Modify: `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/inventory.ts`
- Test: `backend/src/inventory/inventory.service.spec.ts`

**Interfaces:**
- Consumes: nothing from Task 7 beyond the module already being open.
- Produces: entity `InventoryFarm { inventoryId, farmId }`; `CreateInventoryItemDto.farmIds?: string[]`; `InventoryService.setPairing(itemId, farmIds, userId)`.

- [ ] **Step 1: Write the migration**

Create `backend/src/migrations/1780600400000-AddInventoryFarms.ts`:

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Inventory becomes pairable to one, many or no farms.
 *
 * ORDER MATTERS: create the table, backfill one row per existing
 * `inventory.farm_id`, and only then relax the NOT NULL. Relaxing first would
 * leave a window in which a crashed backfill loses the only record of which
 * farm an item belonged to.
 *
 * `farm_id` is kept, not dropped: it stays the fast path for the common
 * single-farm read. The join table is authoritative where they disagree.
 *
 * Additive, idempotent, reversible — applied by hand, not by `migrationsRun`.
 */
export class AddInventoryFarms1780600400000 implements MigrationInterface {
  name = 'AddInventoryFarms1780600400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "inventory_farms" (
        "inventory_id" uuid NOT NULL,
        "farm_id" uuid NOT NULL,
        CONSTRAINT "PK_inventory_farms" PRIMARY KEY ("inventory_id", "farm_id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_inventory_farms_farm"
        ON "inventory_farms" ("farm_id")
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "inventory_farms"
          ADD CONSTRAINT "FK_inventory_farms_inventory"
          FOREIGN KEY ("inventory_id") REFERENCES "inventory"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "inventory_farms"
          ADD CONSTRAINT "FK_inventory_farms_farm"
          FOREIGN KEY ("farm_id") REFERENCES "farms"("id") ON DELETE CASCADE;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);

    // Backfill — idempotent via ON CONFLICT, so a re-run is a no-op.
    await queryRunner.query(`
      INSERT INTO "inventory_farms" ("inventory_id", "farm_id")
      SELECT "id", "farm_id" FROM "inventory" WHERE "farm_id" IS NOT NULL
      ON CONFLICT DO NOTHING
    `);

    await queryRunner.query(
      `ALTER TABLE "inventory" ALTER COLUMN "farm_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory_farms" ENABLE ROW LEVEL SECURITY`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // farm_id was backfilled and is never cleared, so restoring NOT NULL is
    // safe — but only after any unpaired rows created since are given one.
    await queryRunner.query(
      `DELETE FROM "inventory" WHERE "farm_id" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "inventory" ALTER COLUMN "farm_id" SET NOT NULL`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "inventory_farms"`);
  }
}
```

- [ ] **Step 2: Write the entity, with the inversion comment**

Create `backend/src/inventory/inventory-farm.entity.ts`:

```ts
import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { InventoryItem } from './inventory-item.entity';
import { Farm } from '../farms/farm.entity';

/**
 * Which farms an inventory item is stocked for.
 *
 * Shaped after `farm_member_ponds` — composite PK, both sides CASCADE, no
 * surrogate id, no timestamps.
 *
 * ONE DELIBERATE INVERSION, and it is the opposite of the table this copies:
 * in `farm_member_ponds`, ZERO ROWS MEANS ACCESS TO EVERY POND. Here, ZERO
 * ROWS MEANS UNPAIRED — the item belongs to no farm and appears in no farm's
 * list. Do not "fix" this to match the mirror; doing so would silently stock
 * every item at every farm.
 */
@Entity('inventory_farms')
@Index(['inventoryId'])
export class InventoryFarm {
  @PrimaryColumn({ name: 'inventory_id', type: 'uuid' })
  inventoryId: string;

  @PrimaryColumn({ name: 'farm_id', type: 'uuid' })
  farmId: string;

  @ManyToOne(() => InventoryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'inventory_id' })
  item: InventoryItem;

  @ManyToOne(() => Farm, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'farm_id' })
  farm: Farm;
}
```

Also change `inventory-item.entity.ts:18` to `farmId: string | null` with `nullable: true`, matching the relaxed column.

- [ ] **Step 3: Write the failing tests**

```ts
describe('inventory pairing', () => {
  it('lists an item for every farm it is paired to', async () => {
    pairingRepo.find.mockResolvedValue([
      { inventoryId: 'i1', farmId: 'f1' },
      { inventoryId: 'i1', farmId: 'f2' },
    ]);
    const items = await service.findAll('user-1', 'f2');
    expect(items.map((i) => i.id)).toContain('i1');
  });

  it('reads an item when the caller has VIEW_INVENTORY on any paired farm', async () => {
    // One farm is enough to look; see the write rule below for the contrast.
    farmAccess.assertCanAccessFarm
      .mockRejectedValueOnce(new ForbiddenException())
      .mockResolvedValueOnce(undefined);
    await expect(service.findOne('i1', 'user-1')).resolves.toBeDefined();
  });

  it('refuses a write unless the caller can manage EVERY paired farm', async () => {
    // Otherwise rights on one farm let a user edit stock another farm depends on.
    farmAccess.assertCanAccessFarm
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new ForbiddenException());
    await expect(
      service.update('i1', { name: 'x' } as any, 'user-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('allows an unpaired item and does not surface it under any farm', async () => {
    pairingRepo.find.mockResolvedValue([]);
    const items = await service.findAll('user-1', 'f1');
    expect(items).toEqual([]);
  });
});
```

- [ ] **Step 4: Run and verify they fail**

Run: `cd backend && npx jest src/inventory/inventory.service.spec.ts --forceExit`

- [ ] **Step 5: Implement**

Resolve an item's farms through the join table, falling back to `farm_id` for rows written before the backfill. Read is **any** paired farm; write is **every** paired farm:

```ts
  /** The farms an item is stocked for. Empty means deliberately unpaired. */
  private async farmsFor(itemId: string, item?: InventoryItem): Promise<string[]> {
    const rows = await this.pairingRepo.find({ where: { inventoryId: itemId } });
    if (rows.length) return rows.map((r) => r.farmId);
    return item?.farmId ? [item.farmId] : [];
  }

  /**
   * READ needs the capability on ANY paired farm; WRITE needs it on EVERY one.
   * An item stocked for two farms is a shared resource — a user with rights on
   * only one of them must not be able to edit stock the other depends on.
   */
  private async assertPaired(
    itemId: string,
    item: InventoryItem,
    userId: string,
    capability: FarmCapability,
    mode: 'any' | 'all',
  ): Promise<void> {
    const farmIds = await this.farmsFor(itemId, item);
    if (!farmIds.length) return; // unpaired: nothing to check against
    const results = await Promise.allSettled(
      farmIds.map((f) => this.farmAccess.assertCanAccessFarm(userId, f, capability)),
    );
    const ok =
      mode === 'any'
        ? results.some((r) => r.status === 'fulfilled')
        : results.every((r) => r.status === 'fulfilled');
    if (!ok) throw new ForbiddenException('You cannot access this inventory item');
  }
```

Route `loadItem` through `assertPaired` with `'any'` for `VIEW_INVENTORY` and `'all'` for `MANAGE_INVENTORY`. `findAll(userId, farmId)` joins through `inventory_farms` when `farmId` is given.

`setPairing(itemId, farmIds, userId)` replaces the rows in one transaction after asserting `MANAGE_INVENTORY` on both the old and the new sets — a user must not be able to pair an item *away* from a farm they cannot manage, nor *onto* one they cannot.

`CreateInventoryItemDto` gains `@IsOptional() @IsArray() @IsUUID('4', { each: true }) farmIds?: string[]`, keeping `farmId` for backward compatibility with the shipped client.

- [ ] **Step 6: Frontend chooser**

In `InventoryFormScreen.tsx`, replace the single resolved `farmId` (state `:63`, resolution `:98-103`) with a multi-select. `ChipGroup` already supports multi-select and is already imported by this screen — do not build a new component.

```tsx
    // Was a single farmId. An item can now be stocked for several farms, or
    // deliberately for none.
    const [farmIds, setFarmIds] = useState<string[]>([]);

    // Default to the farm the user arrived from, then the active farm, then
    // the first they can manage — same precedence the single-farm version used.
    useEffect(() => {
        if (farmIds.length || !manageableFarms.length) return;
        const preferred = route?.params?.farmId ?? activeFarmId ?? manageableFarms[0].id;
        setFarmIds(manageableFarms.some((f) => f.id === preferred) ? [preferred] : []);
    }, [manageableFarms, activeFarmId, route?.params?.farmId]);
```

```tsx
    <SectionHeader label={t('inventory.pairedFarms')} />
    <ChipGroup
        multiple
        options={manageableFarms.map((f) => ({ value: f.id, label: f.name }))}
        value={farmIds}
        onChange={setFarmIds}
    />
    {farmIds.length === 0 && (
        <AlertBanner tone="warning" title={t('inventory.unpairedTitle')} message={t('inventory.unpairedWarning')} />
    )}
```

Send `farmIds` on create; on edit, call `setPairing` when the selection changed. An empty selection is legal — it saves, with the warning shown above, and the item appears in no farm's list until it is paired.

Add to all six `inventory.ts` locale files. `en`:
```ts
  pairedFarms: "Stocked for",
  unpairedTitle: "Not stocked for any farm",
  unpairedWarning: "This item will not appear in any farm's inventory until you pair it. Not recommended.",
```
`hi`:
```ts
  pairedFarms: "किन खेतों के लिए",
  unpairedTitle: "किसी खेत से नहीं जुड़ा",
  unpairedWarning: "जब तक आप इसे किसी खेत से नहीं जोड़ेंगे, यह किसी भी खेत की सूची में नहीं दिखेगा। सुझाव नहीं दिया जाता।",
```
`bn`:
```ts
  pairedFarms: "কোন খামারের জন্য",
  unpairedTitle: "কোনো খামারের সঙ্গে যুক্ত নয়",
  unpairedWarning: "যতক্ষণ না আপনি এটি কোনো খামারের সঙ্গে যুক্ত করছেন, এটি কোনো খামারের তালিকায় দেখা যাবে না। এটি সুপারিশ করা হয় না।",
```
`ta`:
```ts
  pairedFarms: "எந்தப் பண்ணைக்கு",
  unpairedTitle: "எந்தப் பண்ணையுடனும் இணைக்கப்படவில்லை",
  unpairedWarning: "நீங்கள் இணைக்கும் வரை இது எந்தப் பண்ணையின் பட்டியலிலும் தோன்றாது. பரிந்துரைக்கப்படவில்லை.",
```
`te`:
```ts
  pairedFarms: "ఏ వ్యవసాయ క్షేత్రానికి",
  unpairedTitle: "ఏ క్షేత్రంతోనూ జతచేయలేదు",
  unpairedWarning: "మీరు జతచేసే వరకు ఇది ఏ క్షేత్రం జాబితాలోనూ కనిపించదు. సిఫారసు చేయబడలేదు.",
```
`or`:
```ts
  pairedFarms: "କେଉଁ ଫାର୍ମ ପାଇଁ",
  unpairedTitle: "କୌଣସି ଫାର୍ମ ସହ ଯୋଡ଼ା ନାହିଁ",
  unpairedWarning: "ଆପଣ ଯୋଡ଼ିବା ପର୍ଯ୍ୟନ୍ତ ଏହା କୌଣସି ଫାର୍ମର ତାଲିକାରେ ଦେଖାଯିବ ନାହିଁ। ସୁପାରିଶ କରାଯାଉ ନାହିଁ।",
```

- [ ] **Step 7: Gates**

Run: `cd backend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit && bash scripts/check-calculator-i18n.sh`

- [ ] **Step 8: Commit**

```bash
git add backend/src/inventory backend/src/migrations/1780600400000-AddInventoryFarms.ts frontend/src/screens/inventory frontend/src/api/inventory.ts frontend/src/i18n/locales
git commit -m "feat(inventory): pair an item to one, many or no farms"
```

---

### Task 9: Inventory purchases write money

**Files:**
- Create: `backend/src/migrations/1780600500000-AddTransactionInventoryItem.ts`
- Modify: `backend/src/transactions/transaction.entity.ts`, `backend/src/inventory/inventory.service.ts`, `backend/src/inventory/inventory.module.ts`
- Test: `backend/src/inventory/inventory.service.spec.ts`

**Interfaces:**
- Consumes: `InventoryMovement` (Task 7), pairing helpers (Task 8).
- Produces: `Transaction.inventoryItemId: string | null`.

- [ ] **Step 1: Migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tie a money row to the inventory item it bought.
 *
 * `transactions.category` is free text with no enum or check constraint, so
 * category 'inventory' needs no migration — only the item link does.
 *
 * SET NULL, never CASCADE: deleting an inventory item must not delete the
 * record of having paid for it.
 */
export class AddTransactionInventoryItem1780600500000 implements MigrationInterface {
  name = 'AddTransactionInventoryItem1780600500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "inventory_item_id" uuid`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "transactions"
          ADD CONSTRAINT "FK_transactions_inventory_item"
          FOREIGN KEY ("inventory_item_id") REFERENCES "inventory"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_transactions_inventory_item"
        ON "transactions" ("inventory_item_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "inventory_item_id"`,
    );
  }
}
```

- [ ] **Step 2: Failing test**

```ts
it('records a purchase as an inventory expense tagged with the item', async () => {
  await service.adjustStock('i1', +10, 'user-1', {
    capability: 'MANAGE_INVENTORY',
    reason: 'Purchase',
    purchase: { amount: 4500, farmId: 'f1' },
  });
  expect(transactionsService.create).toHaveBeenCalledWith(
    expect.objectContaining({
      farmId: 'f1',
      type: 'expense',
      category: 'inventory',
      amount: 4500,
      inventoryItemId: 'i1',
    }),
    'user-1',
  );
});

it('does not write money for a plain stock correction', async () => {
  await service.adjustStock('i1', +10, 'user-1', { capability: 'MANAGE_INVENTORY' });
  expect(transactionsService.create).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: Run and verify they fail**

Run: `cd backend && npx jest src/inventory/inventory.service.spec.ts --forceExit`

- [ ] **Step 4: Implement**

`AdjustStockOptions` gains `purchase?: { amount: number; farmId: string }`. When present — and only then — `adjustStock` calls `transactionsService.create` after the movement row. A stock correction is not a purchase; requiring the caller to say so keeps an accidental money row out of the ledger.

Add `inventoryItemId` to the entity and to `CreateTransactionDto` as `@IsOptional() @IsUUID()`.

- [ ] **Step 5: Gates and commit**

Run: `cd backend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`

```bash
git add backend/src/transactions backend/src/inventory backend/src/migrations/1780600500000-AddTransactionInventoryItem.ts
git commit -m "feat(inventory): a purchase writes a tagged inventory expense"
```

---

### Task 10: Stop deleting money history

**Files:**
- Create: `backend/src/migrations/1780600600000-FixExpensesUserFk.ts`
- Modify: `backend/src/finances/expense.entity.ts:58-64`
- Modify: `backend/src/transactions/transactions.service.ts:97-119`
- Modify: `backend/src/farm-access/route-capabilities.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing consumed downstream.

- [ ] **Step 1: Migration**

```ts
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Deleting a user was deleting their expense history.
 *
 * `expenses.user_id` is `NOT NULL` with `ON DELETE CASCADE` (re-added as
 * CASCADE at 1780287841640-AddInventoryNotes.ts:293 after being dropped at
 * :35). So removing a worker removed every expense they had ever recorded —
 * money data, gone, with no tombstone.
 *
 * The research spec asked only for SET NULL. That alone cannot apply while the
 * column is NOT NULL, so both change together.
 */
export class FixExpensesUserFk1780600600000 implements MigrationInterface {
  name = 'FixExpensesUserFk1780600600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "expenses" ALTER COLUMN "user_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "FK_expenses_user_id"`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "expenses"
          ADD CONSTRAINT "FK_expenses_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL;
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Deliberately does NOT restore CASCADE. Reversing to a state that deletes
    // money on user removal is not a rollback anyone wants; the FK is simply
    // returned to no-action. Rows orphaned meanwhile keep a null user_id.
    await queryRunner.query(
      `ALTER TABLE "expenses" DROP CONSTRAINT IF EXISTS "FK_expenses_user_id"`,
    );
    await queryRunner.query(`
      DO $$ BEGIN
        ALTER TABLE "expenses"
          ADD CONSTRAINT "FK_expenses_user_id"
          FOREIGN KEY ("user_id") REFERENCES "users"("id");
      EXCEPTION WHEN duplicate_object THEN NULL; END $$;
    `);
  }
}
```

Update the entity: `@Column({ name: 'user_id', type: 'uuid', nullable: true }) userId: string | null;` and the relation to `onDelete: 'SET NULL'`.

- [ ] **Step 2: Failing test for the write gate**

```ts
it('refuses to edit or delete a transaction on read-only financial access', async () => {
  // VIEW_FINANCIALS is the capability for SEEING the money. Rewriting or
  // erasing it is a write, and was running on the same key.
  farmAccess.assertCanAccessFarm.mockRejectedValue(new ForbiddenException());
  await expect(service.update('t1', { amount: 1 } as any, 'user-1')).rejects.toThrow(
    ForbiddenException,
  );
  await expect(service.remove('t1', 'user-1')).rejects.toThrow(ForbiddenException);
  expect(farmAccess.assertCanAccessFarm).toHaveBeenCalledWith(
    'user-1',
    expect.any(String),
    'WRITE_MANAGEMENT',
  );
});
```

- [ ] **Step 3: Run and verify it fails**

Run: `cd backend && npx jest src/transactions --forceExit`

- [ ] **Step 4: Implement**

In `transactions.service.ts`, change `update` (`:97-105`) and `remove` (`:117`) from `VIEW_FINANCIALS` to `WRITE_MANAGEMENT`. Leave `create` and every read on `VIEW_FINANCIALS`. Add the two rows to `route-capabilities.spec.ts` so the gate is pinned.

This is a visible behaviour change: a member with financial viewing but not management loses the ability to edit or delete transactions. Call it out in the release note, same as the Phase 1 harvest change.

- [ ] **Step 5: Gates and commit**

Run: `cd backend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`

```bash
git add backend/src/finances backend/src/transactions backend/src/farm-access backend/src/migrations/1780600600000-FixExpensesUserFk.ts
git commit -m "fix(money): stop cascading user deletes onto expenses; gate transaction writes"
```

---

### Task 11: Push on pending join and leave request

**Files:**
- Modify: `backend/src/farm-members/farm-invites.service.ts:261-282` and `:309-317`
- Modify: `backend/src/leave-requests/leave-requests.service.ts:70-79`
- Modify: `backend/src/farm-members/farm-members.module.ts:18`, `backend/src/leave-requests/leave-requests.module.ts:12`
- Modify: `frontend/src/features/notificationRouting.ts:25-34`
- Modify: `backend/src/i18n`-free — push copy is English-only today, matching `feedback.service.ts:167-176`
- Test: `backend/src/farm-members/farm-invites.service.spec.ts`, `backend/src/leave-requests/leave-requests.service.spec.ts`, `frontend/src/features/__tests__/notificationRouting.test.ts`

**Interfaces:**
- Consumes: `PushService.sendToUser(userId, { title, body, data })` — existing, never throws, returns `false` on failure.
- Produces: push payloads `data: { type: 'pending_join', farmId }` and `data: { type: 'leave_request', farmId, leaveRequestId }`.

- [ ] **Step 1: Write the failing tests**

```ts
describe('push on pending join', () => {
  it('notifies the owner and the managers when joinApprover is managers', async () => {
    farm.joinApproval = 'approval';
    farm.joinApprover = 'managers';
    await service.join('CODE1234', 'user-9');
    expect(push.sendToUser).toHaveBeenCalledWith('owner-1', expect.anything());
    expect(push.sendToUser).toHaveBeenCalledWith('manager-1', expect.anything());
  });

  it('notifies only the owner when joinApprover is owner', async () => {
    farm.joinApprover = 'owner';
    await service.join('CODE1234', 'user-9');
    expect(push.sendToUser).toHaveBeenCalledTimes(1);
    expect(push.sendToUser).toHaveBeenCalledWith('owner-1', expect.anything());
  });

  it('sends nothing when the farm auto-approves — there is nothing to approve', async () => {
    farm.joinApproval = 'auto';
    await service.join('CODE1234', 'user-9');
    expect(push.sendToUser).not.toHaveBeenCalled();
  });

  it('also fires on the legacy farm-code join path', async () => {
    // The second path is the one that silently sends nothing if forgotten.
    await service.legacyJoinByFarmCode('OLDCODE', 'user-9');
    expect(push.sendToUser).toHaveBeenCalled();
  });

  it('does not fail the join when the push fails', async () => {
    push.sendToUser.mockResolvedValue(false);
    await expect(service.join('CODE1234', 'user-9')).resolves.toBeDefined();
  });
});
```

And for routing:

```ts
it('routes a pending-join push to the farm team screen', () => {
  expect(routeFor({ type: 'pending_join', farmId: 'f1' })).toEqual({
    screen: 'FarmMembers',
    params: { farmId: 'f1' },
  });
});

it('routes a leave-request push to the leave screen', () => {
  expect(routeFor({ type: 'leave_request', farmId: 'f1' })).toEqual({
    screen: 'LeaveRequests',
    params: { farmId: 'f1' },
  });
});
```

- [ ] **Step 2: Run and verify they fail**

Run: `cd backend && npx jest src/farm-members src/leave-requests --forceExit`
Run: `cd frontend && npx jest src/features/__tests__/notificationRouting.test.ts --forceExit`

- [ ] **Step 3: Implement the recipient resolver**

In `farm-invites.service.ts`, mirroring `assertCanApprove` (`:363-378`) so the two can never disagree about who approves:

```ts
  /**
   * Exactly the set `assertCanApprove` would let through: the owner always,
   * plus active managers when the farm delegates approval to them.
   */
  private async approversOf(farm: Farm): Promise<string[]> {
    const ids = [farm.userId];
    if ((farm.joinApprover ?? 'managers') === 'managers') {
      const managers = await this.memberRepo.find({
        where: { farmId: farm.id, role: 'manager', status: 'active' },
      });
      ids.push(...managers.map((m) => m.userId));
    }
    return [...new Set(ids)];
  }
```

- [ ] **Step 4: Fire the push — after commit, on both paths**

The primary path runs inside `this.dataSource.transaction` opened at `:209` with a `pessimistic_write` lock at `:214`. Firing inside it would announce a membership that can still roll back, so the send goes **after** `join()` returns its result — not at the `manager.save(member)` on `:272`.

```ts
    // After commit, and never inside the transaction: a push announcing a
    // membership that then rolls back cannot be recalled.
    if (status === 'pending') {
      const recipients = await this.approversOf(farm);
      await Promise.all(
        recipients.map((userId) =>
          this.push.sendToUser(userId, {
            title: 'Someone wants to join your farm',
            body: `${joinerName} is waiting for approval at ${farm.name}.`,
            data: { type: 'pending_join', farmId: farm.id },
          }),
        ),
      );
    }
```

Apply the same block to `legacyJoinByFarmCode` (`:309-317`). Forgetting it there is the failure the fourth test pins.

- [ ] **Step 5: Leave requests**

In `leave-requests.service.ts`, fire after the save at `:79` — after the offline-replay guard at `:48-58`, or a queue drain double-pushes. Recipients are the owner plus every active manager of `dto.farmId`, unconditionally: `decide()` gates on `WRITE_MANAGEMENT` with no `joinApprover`-style narrowing.

- [ ] **Step 6: Wire the modules and the client routing**

`farm-members.module.ts` and `leave-requests.module.ts` both add `PushModule` to `imports`.

`frontend/src/features/notificationRouting.ts` is a whitelist that today recognises only `feedback_reply` and deliberately drops everything else. Add `pending_join` → the farm's members screen and `leave_request` → the leave screen. Without this the notification opens the app and lands nowhere, which is worse than not sending it.

- [ ] **Step 7: Gates and commit**

Run: `cd backend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`

```bash
git add backend/src/farm-members backend/src/leave-requests frontend/src/features
git commit -m "feat(push): notify approvers on pending join and leave request"
```

---

### Task 12: Invite someone who has not registered

**Files:**
- Modify: `frontend/src/navigation/linking.ts:18-23`
- Modify: `frontend/src/screens/onboarding/JoinFarmScreen.tsx:63`
- Modify: `frontend/src/screens/farms/AddWorkerScreen.tsx:59-67`
- Modify: `frontend/src/screens/farms/FarmMembersScreen.tsx:180-186`
- Modify: `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/members.ts`
- Test: `frontend/src/screens/farms/__tests__/AddWorkerScreen.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: deep link `upcheckapp://join/<CODE>`.

**No new dependency.** `expo-linking` and `expo-sharing` are absent and stay absent. `app.config.ts:9` already sets `scheme: "upcheckapp"`, `linking.ts` is already a live React Navigation config, and `FarmMembersScreen.tsx:19-20` already imports core `Share` and `expo-clipboard`.

- [ ] **Step 1: Failing test**

```tsx
it('offers to invite a person who has no account instead of dead-ending', async () => {
    // Today a failed lookup alerts "not found" and re-arms the scanner, with
    // no way forward. That dead end is the whole of #35.
    mockLookupUser.mockRejectedValue({ response: { status: 404 } });

    const { getByText, findByText } = render(<AddWorkerScreen route={route} navigation={nav} />);
    fireEvent.changeText(getByText('phone-input'), '9876543210');
    fireEvent.press(getByText('Look up'));

    expect(await findByText('Send an invite instead')).toBeTruthy();
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `cd frontend && npx jest src/screens/farms/__tests__/AddWorkerScreen.test.tsx --forceExit`

- [ ] **Step 3: Route entry**

In `frontend/src/navigation/linking.ts`, add to `config.screens`:

```ts
        JoinFarm: 'join/:code',
```

- [ ] **Step 4: Accept the code from the link**

`JoinFarmScreen.tsx:63` currently starts `code` at `''` and only ever sets it by typing or scanning:

```ts
    const [code, setCode] = useState(route?.params?.code?.toUpperCase() ?? '');
```

Uppercase because the code alphabet is `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` and a link may arrive lower-cased by a messaging app.

- [ ] **Step 5: Put the link in the shared message**

The QR still encodes the **bare 8-char code** (`FarmMembersScreen.tsx:297`, read back at `JoinFarmScreen.tsx:124-131`). It stays that way — printed QR codes in the field must keep working. The link is additive, in the share text only.

`en/members.ts`:
```ts
  shareInviteMessage: "Join {{farm}} on Upcheck with this code: {{code}}\nOr tap: upcheckapp://join/{{code}}",
```
Translate the same shape into `hi`, `bn`, `ta`, `te`, `or`, keeping both placeholders and the URL untranslated.

- [ ] **Step 6: The not-found branch**

At `AddWorkerScreen.tsx:59-67`, replace the bare `Alert.alert(t('members.notFoundTitle'), …)` with a two-button alert: cancel, and "Send an invite instead" which navigates to the farm's invite screen with the share sheet primed. Re-arm the scanner only on cancel.

Add `inviteInstead`, `inviteInsteadBody` to all six `members.ts`.

- [ ] **Step 7: Gates and commit**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit && bash scripts/check-calculator-i18n.sh`

```bash
git add frontend/src/navigation/linking.ts frontend/src/screens/onboarding frontend/src/screens/farms frontend/src/i18n/locales
git commit -m "feat(invites): join link and an invite path for unregistered people"
```

---

### Task 13: Chemistry de-duplication, non-destructive

**Files:**
- Modify: `frontend/src/screens/ponds/PondDashboardScreen.tsx:96` and `:106`
- Delete: `frontend/src/constants/ranges.ts`
- Modify: every importer of `constants/ranges`
- Modify: `frontend/src/features/waterQualityThresholds.ts`
- Modify: `frontend/src/screens/logs/WeeklyChemistryScreen.tsx:59`
- Test: `frontend/src/features/__tests__/waterQualityThresholds.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `waterQualityThresholds` becomes the only exporter of `ParameterStatus` and the only status function.

**No table merge.** `chemical_data` and `water_quality_records` both stay. Migrating live rows across a crop-scoped/pond-scoped mismatch for a polish item is not a trade worth making.

- [ ] **Step 1: Failing test for the disagreement**

```ts
it('has exactly one opinion about transparency', () => {
    // constants/ranges.ts capped transparency at 40 while
    // waterQualityThresholds put cautionHigh at 45. Two live status functions
    // disagreeing means the same reading rendered green on one screen and
    // amber on another.
    expect(evaluateParameter('transparency', 42, 'vannamei').status).toBe('optimal');
});
```

- [ ] **Step 2: Run and verify it fails or is ambiguous**

Run: `cd frontend && npx jest src/features/__tests__/waterQualityThresholds.test.ts --forceExit`

- [ ] **Step 3: Consolidate**

`waterQualityThresholds.ts` wins: it is species-aware and it is what the alert engine agrees with, so the UI must read the same table or the two will keep disagreeing. Move any parameter present only in `ranges.ts` into it, delete `constants/ranges.ts`, and repoint every importer. `getParameterStatus` callers become `evaluateParameter`.

- [ ] **Step 4: Tell the two tiles apart**

`PondDashboardScreen.tsx:96` and `:106` both render icon `science`, leading to two overlapping forms — the user-visible face of the duplication. Give the daily chemistry tile `science` and the weekly one `calendar_month`, and label them so the difference is legible without opening either.

- [ ] **Step 5: Drop the unused param**

`WeeklyChemistryScreen.tsx:59` takes `cropId` from route params and never uses it; its callers pass it at `WeeklyChemistryHistoryScreen.tsx:128,225`. Remove from both sides.

Note: the ledger's other claim about this screen — that it ignores `queued` — is **stale**. `:120-123` handles it. Do not "fix" that.

- [ ] **Step 6: Gates and commit**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit && bash scripts/check-calculator-i18n.sh`

```bash
git add frontend/src
git commit -m "refactor(chemistry): one threshold table, two distinguishable tiles"
```

---

### Task 14: Dead code

**Files:**
- Modify: `backend/src/crops/crops.service.ts:128-135`
- Delete: `frontend/src/screens/main/ReportsScreen.tsx`
- Modify: `frontend/src/navigation/MainNavigator.tsx:19`
- Modify: `frontend/src/navigation/__tests__/MainNavigator.tabs.test.tsx:18`

**Interfaces:** none.

- [ ] **Step 1: Confirm both are still dead before deleting**

Run:
```bash
cd backend && grep -rn "findByPond" src | grep -v "crops.service.ts"
cd ../frontend && grep -rn "ReportsScreen\|'Reports'" src
```
Expected: the backend grep returns only unrelated classes (`simulations.service.ts:239`, `water-quality.service.ts:252`) and the comment at `reports.service.ts:163`; the frontend grep returns only `MainNavigator.tsx:19` and the jest mock. If either returns a real caller, **stop and report** — the finding has gone stale.

- [ ] **Step 2: Delete**

`crops.service.ts:128-135` — `findByPond` has zero callers and is a byte-for-byte duplicate of `findAll`'s body minus the empty-`pondId` guard. Remove it.

`ReportsScreen.tsx` — no `Tab.Screen`, no `Stack.Screen`, no `navigate('Reports')`. Delete the file, the dead import at `MainNavigator.tsx:19`, and the jest mock at `MainNavigator.tabs.test.tsx:18`.

- [ ] **Step 3: Gates**

Run: `cd backend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`

- [ ] **Step 4: Commit**

```bash
git add -A backend/src/crops frontend/src/screens/main frontend/src/navigation
git commit -m "chore: remove dead findByPond and the unreachable Reports screen"
```

---

### Task 15: Movements on the detail screen

**Files:**
- Modify: `frontend/src/screens/inventory/InventoryDetailScreen.tsx:233-250`
- Modify: `frontend/src/api/inventory.ts`
- Modify: `frontend/src/query/client.ts` (`URL_ENTITY_MAP`)
- Modify: `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/inventory.ts`

**Interfaces:**
- Consumes: `GET /inventory/:id/movements` (Task 7).

- [ ] **Step 1: Client method**

```ts
  listMovements: (id: string) =>
    apiClient.get<InventoryMovement[]>(`/inventory/${id}/movements`),
```

with the matching `InventoryMovement` interface (`id`, `delta`, `reason`, `createdById`, `feedRecordId`, `createdAt`).

- [ ] **Step 2: Replace the single-reason row**

`InventoryDetailScreen.tsx:233-250` currently renders one `lastAdjustmentReason`. Replace with a short list — newest first, signed delta, reason, and `formatAge(createdAt)` from Task 2. Keep the single row as the fallback when the list is empty, so an item adjusted before this release still shows what it has.

- [ ] **Step 3: Invalidation**

An adjustment must refresh the list. `URL_ENTITY_MAP` in `frontend/src/query/client.ts` already maps `/inventory` writes to the `inventory` entity; confirm `ENTITY_QUERY_KEYS.inventory` includes the movements key, and add it if not — otherwise the ledger shows yesterday's history after an adjustment, the same class of bug as the Team badge in Phase 2.

- [ ] **Step 4: Gates and commit**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit && bash scripts/check-calculator-i18n.sh`

```bash
git add frontend/src
git commit -m "feat(inventory): stock history on the item detail screen"
```

---

## Release

1. **Migrations first**, in timestamp order, hand-run against production. All four are additive and invisible to the running backend, so they are safe ahead of the deploy: `1780600300000`, `1780600400000`, `1780600500000`, `1780600600000`. Verify with `migration:show` that pending is 0 afterwards.
2. **Merge to master** → Render auto-deploys `srv-dac0tivavr4c73b35mig`.
3. **Wait for the deploy to report live**, then smoke-test `/api/health` (200) and `/api/inventory/<id>/movements` (401 unauthenticated, i.e. present and gated).
4. **Publish the OTA** to the `preview` channel, runtime `1.0.0`. Never before step 3 — the new bundle calls endpoints that must already exist.
5. **Release note** must call out two visible behaviour changes: a farm card no longer says "All fine" when ponds are un-logged, and a member with financial *viewing* can no longer edit or delete transactions.

## Notes for the executor

- Tasks 1-6 are Part A and are frontend-only; they can ship independently of Part B if Part B slips.
- Tasks 7, 8, 9 all open `inventory.service.ts`. Run them in order, not in parallel.
- Task 10's migration is independent of the inventory three and can be run at any point.
- Every new i18n key lands in all six locales in the same commit that uses it, or `localeParity.test.ts` fails the build.
- The hi/bn/ta/te/or strings in this plan are model-authored and of unverified register. They are flagged for native-speaker review, along with Phase 2's.
