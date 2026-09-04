# Phase 3 — Data Freshness, Inventory Ledger, and §5 Polish

**Date:** 2026-09-04 · **Status:** design approved, plan pending
**Baseline:** master `7b20fdf` (PR #123), OTA group `5cab4156`, runtime `1.0.0`
**Branch:** `feat/phase3-polish` off master
**Predecessors:** Phase 1 `8fabec3`, Phase 2 Stage A `f24387b`, Stage B `0cca4c1`

This release combines two bodies of work that the user asked to ship together:

- **Part A — data freshness.** New. Not in the original research spec. A colour
  bar that says "fine" because the alert engine had nothing to say is
  indistinguishable from one that says "fine" because nobody has logged this
  pond in three weeks. Part A makes silence visible.
- **Part B — §5 of the phased-remediation research spec**
  (`2026-09-03-phased-remediation-research.md`), every item except the shelf
  grid (#30), with #36 reduced to its non-destructive half.

Global constraints from the research spec still bind: OTA-only on the frontend
(no new native dependency), auth untouched, six locales at parity, migrations
hand-run in production, `tsc --noEmit` + `jest` + `check-calculator-i18n.sh`
green on every commit.

---

## Decisions taken

Recorded here because each one closed a real fork, and a later reader will
otherwise re-open it.

1. **One combined release**, not freshness-first. Costs the freshness fix a few
   days on phones; buys one deploy, one migration window, one OTA.
2. **Staleness is two-tier: >2 days and >7 days**, not the backend's own 1-day
   confidence window. The 1-day window is correct for scoring an engine's
   input; applied to a colour bar it paints nearly every pond grey every
   morning, and a signal that fires constantly is not a signal.
3. **Stale replaces green.** A stocked pond with no fresh log never renders as
   `fine`. A real alert still outranks silence — `critical` and `watch` win over
   `stale`.
4. **Compact age hints everywhere the state appears** ("4 h", "3 d"), so the
   farmer sees *how* stale at a glance rather than only *that* it is stale.
5. **Phase 3 excludes the shelf grid (#30).** Most UI in §5, least daily value.
6. **#36 is non-destructive only.** No table merge. See Part B §6.
7. **`inventory.farm_id` is kept, not dropped**, when the join table lands. It
   stays as the single-farm fast path; the join table is authoritative.

---

# Part A — Data freshness

## A.1 The defect

`frontend/src/utils/pondHealth.ts:64` — `healthOf()`:

```ts
if (isFallow(pond)) return 'fallow';
if (severity === 'critical') return 'critical';
if (severity === 'watch') return 'watch';
return 'fine';
```

`severity` comes from the alert engine's briefing. The engine reports on
readings it has; it does not report "nobody gave me a reading". So `fine` is
the branch for *no alert*, which silently includes *no data*.

Four screens read this one function, so all four inherit the lie:
`FarmsListScreen` (card border, pond strip, legend), `FarmDetailScreen` (pond
row left border), `HomeScreen` via `components/dashboard/FarmOverview.tsx`
(strip), and the pond dashboard border.

The sharpest instance is `FarmsListScreen.tsx:399-408`, which picks the card's
third stat as `actNow` → else `watch` → else the literal string **"All fine"**.
A farm untouched for a month renders a green card that says *All fine* in
words.

## A.2 Where the rule lives

`frontend/src/features/logProgress.ts`. That module already declares itself the
only definition of "done" — `pondSlotDone`, `pondFedThisSession`,
`chemistryDone` live there, and the reminders, the Today progress card and the
farm rows all read it precisely so they cannot drift apart. Staleness is the
multi-day sibling of the same question. Putting it anywhere else creates a
third opinion about how fresh a pond is.

It is pure — no React, no stores, no network — and stays that way.

```ts
export type Freshness = 'fresh' | 'stale' | 'noData';

export interface PondFreshness {
  state: Freshness;
  /** The newest water-quality record's time, or null if there has never been one. */
  asOf: string | null;
  ageMs: number | null;
}

export const STALE_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
export const NO_DATA_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export const pondFreshness = (ctx: PondContext, now: Date): PondFreshness;
```

Driven off `ctx.waterQuality.recordedAt` — the newest water-quality record,
which is exactly the question "has anyone logged this pond". Feed and sampling
deliberately do **not** count toward freshness: a pond can be fed daily and
still have entirely unmeasured water, and treating a feed log as evidence of
freshness would reintroduce the same false green in a new place.

A pond that has never been logged (`recordedAt === null`) is `noData`, not
`stale` — `ageMs` is null and the UI says "never logged", not "logged ∞ days
ago".

## A.3 Where it bites

`pondHealth.ts` gains a fifth state and one branch, and every screen changes at
once:

```ts
export type PondHealth = 'critical' | 'watch' | 'stale' | 'fine' | 'fallow';

// healthOf(pond, severity, freshness)
if (isFallow(pond)) return 'fallow';        // empty pond: nothing to be stale about
if (severity === 'critical') return 'critical';
if (severity === 'watch') return 'watch';
if (freshness !== 'fresh') return 'stale';  // never green without fresh data
return 'fine';
```

`healthOf` takes freshness as a third argument rather than reaching for the
context itself, so it stays a pure function of its inputs and the existing
tests keep their shape. `buildPondRows` — which already receives `contexts` —
computes it per pond and passes it down.

- `HEALTH_RANK`: `stale` sits between `watch` and `fine`, so worst-first
  sorting floats un-logged ponds up every list without a second sort key.
- `HEALTH_COLOR.stale`: a desaturated slate. **Not amber** — amber already
  means `watch`, and a farmer must never read "nobody logged it" as "the water
  is bad". `stale` and `noData` share the one colour: the bar answers "can I
  trust this", which is the same answer for both. What differs is the age hint
  beside it — "8 d" versus "never logged".
- `PondWithHealth` gains `freshness: PondFreshness` so screens can render the
  age without recomputing it.
- `FarmRollup` gains `stale: number` (ponds in `stale`), consumed by the farm
  card's third stat and the Farms-screen totals.

## A.4 Age formatting

New `formatAge(iso, now?)` in `frontend/src/utils/formatDate.ts` — no new file,
because it is the same never-throws, app-language-not-device-language problem
that module already exists to solve.

Returns `"4 h"` / `"3 d"` / `"—"` (null input). Under one hour reads `"<1 h"`.
Localised in all six locales via a new `common.age*` key group; the numeral
goes through the existing `formatNumber` so Indian locales get their own
digits where the locale calls for it.

## A.5 What the farmer sees

| Surface | Change |
|---|---|
| `FarmsListScreen` card | Third stat gains a stale branch **ahead of** the "All fine" fallthrough: `3 not updated`. Strip bar and card border go slate. |
| `FarmsListScreen` legend (`:465`) | Fifth swatch, "Not updated". |
| `FarmDetailScreen` pond row | A third chip beside the existing `SessionHint` badges: `Last log 3 d`. Row border goes slate. |
| `HomeScreen` / `FarmOverview` | Same strip colour and roll-up count — it reads the same util, so this is free. |
| `PondDashboardScreen` | `ConfidenceChip` (already built, currently only on the six engine screens) at the top; per-reading `as of` age on the water-quality tile. |

## A.6 One type fix on the way

`frontend/src/api/pondContext.ts` is missing five fields the backend already
sends (`pond-context.service.ts:62-72`): `dissolvedOxygenAsOf`, `phAsOf`,
`temperatureAsOf`, `salinityAsOf`, `alkalinityAsOf`. Adding them to the
interface is what lets the pond dashboard show per-reading freshness instead of
one timestamp for the whole tile. No backend change — the data is already on
the wire.

## A.7 Scope note — Part A needs no backend work

No endpoint, no migration, no new dependency. Every input is already fetched by
the screens that need it.

---

# Part B — §5 items

## B.1 Inventory pairing (#31)

`inventory.farm_id` is `uuid NOT NULL` with `ON DELETE CASCADE`
(`inventory-item.entity.ts:18-24`). Multi-farm pairing needs a join table.

New `inventory_farms`, mirroring `farm_member_ponds`
(`farm-access/farm-member-pond.entity.ts`): composite primary key
`(inventory_id, farm_id)`, both relations `onDelete: 'CASCADE'`, no surrogate
id, no timestamps, class-level `@Index(['inventoryId'])`.

**One deliberate inversion from the mirrored pattern, and it must be commented
on the entity.** In `farm_member_ponds`, zero rows means *access to every
pond*. In `inventory_farms`, zero rows means *unpaired* — the opposite default.
Copying the pattern without noting this would silently pair every item to every
farm.

Migration order matters: create the table, backfill one row per existing
`inventory.farm_id`, *then* make `farm_id` nullable. `farm_id` is kept rather
than dropped — it remains the fast path for the common single-farm read, with
the join table authoritative when they disagree.

"Unpaired" is permitted, with the not-recommended warning the research spec
calls for.

**Frontend:** the chooser lands in `InventoryFormScreen.tsx` — the only screen
that owns `farmId` (state `:63`, resolution `:98-103`, sent on create `:159`,
deliberately absent from the PATCH payload `:141-152`). One / many / all.
Display surfaces: `InventoryDetailScreen.tsx` (shows no farm today) and the
per-farm sectioning at `InventoryListScreen.tsx:133-143`.

**Access:** `InventoryService` authorises farm-by-farm through
`FarmAccessService.assertCanAccessFarm` with no controller decorators
(`inventory.controller.ts` carries none). With multiple farms per item, a read
must require the capability on **at least one** paired farm and a write on
**every** paired farm — otherwise a user with rights on one farm could edit an
item another farm depends on.

## B.2 Inventory → money (#32)

`transactions.category` is free text — no enum, no check constraint
(`1700000000000-BaselineSchema.ts:95`), only `@IsString()` in the DTO — so
category `'inventory'` needs no migration.

`transactions` has **no item column**, so "tagged with the item" needs a new
nullable `inventory_item_id` with `ON DELETE SET NULL`. Deleting an inventory
item must not delete the record of having paid for it.

A purchase on create/adjust writes one `transactions` row (`type: 'expense'`,
`category: 'inventory'`). `transactions` is canonical because it is farm-scoped
and already drives the Money screens; `expenses` is untouched.

## B.3 Stock movements ledger (#33)

The item that pays for itself. Today `adjustStock` overwrites a single
`last_adjustment_reason` column (`inventory.service.ts:169-182`), and the feed
pipeline writes four literals into it — `'Feed log'`, `'Feed log failed'`,
`'Feed log edited'`, `'Feed log deleted'`. After the fact, a deduction, its
compensating credit, an edit and a delete are indistinguishable, with no
quantity and no actor retained.

New `inventory_movements`: `inventory_id`, `delta` numeric, `reason` text,
`created_by_id` uuid null FK → `users` `ON DELETE SET NULL`, `created_at`
timestamptz, nullable `feed_record_id`. Written **inside the same atomic
UPDATE** that already does `quantity + delta` — the existing statement is what
guarantees stock never goes negative (`where: 'id = :id AND quantity + delta >=
0'`), and a movement row written outside it could record a change that did not
happen.

`last_adjustment_reason` **stays** and keeps being written. It is one column, it
costs nothing, and removing it would break `InventoryDetailScreen.tsx:233-250`
for no gain.

## B.4 Push on pending join / leave (#34)

`PushService.sendToUser` (`push.service.ts:40-43`) takes a single userId, never
throws, and returns `false` on failure. There is no `sendToUsers`, so a
fan-out loop is needed.

**Recipients.** For a pending join, the set that `assertCanApprove`
(`farm-invites.service.ts:363-378`) would let through: the owner always, plus
active `manager` members iff `farm.joinApprover === 'managers'` (the default).
For a leave request, `decide()` gates on `WRITE_MANAGEMENT`, so: owner plus all
active managers, unconditionally.

**Three traps, each of which silently breaks the feature:**

1. **Two join paths create a pending row** — `farm-invites.service.ts:261` and
   the legacy `legacyJoinByFarmCode` at `:309-317`. Firing from only the first
   makes the second push nothing at all.
2. **The primary path runs inside a transaction** with a `pessimistic_write`
   lock opened at `:209`. The push fires *after* commit, not at the save, or it
   announces a membership that may still roll back.
3. **Leave has an offline-replay guard** at `leave-requests.service.ts:48-58`
   that returns the existing row before the save. Fire at `:79`, after it, or a
   queue drain double-pushes.

`farm-members.module.ts` and `leave-requests.module.ts` both need `PushModule`
added to their imports.

**Not optional, though the research spec omits it:**
`frontend/src/features/notificationRouting.ts:25-34` is a whitelist that
recognises exactly one `data.type` (`feedback_reply`) and deliberately ignores
everything else. Without the two new types registered there, a join-request
push opens the app and lands nowhere, which makes the notification worse than
useless. This is part of the item.

There is no server-side notification-preference table; the only opt-out is
deleting the push token (`SettingsScreen.tsx:141`). Per-event preferences are
out of scope — noted so a future reader does not assume they exist.

## B.5 Invite unregistered people (#35)

Confirmed OTA-safe: `expo-linking` and `expo-sharing` are both absent from
`package.json` and `node_modules`, and stay absent. Everything needed is
already installed.

- `frontend/app.config.ts:9` already sets `scheme: "upcheckapp"`.
- `frontend/src/navigation/linking.ts:18-23` is a live React Navigation linking
  config with `prefixes: ['upcheckapp://']` and two routes. Adding
  `JoinFarm: 'join/:code'` is a one-line change.
- `FarmMembersScreen.tsx:180-186` already opens the OS share sheet using core
  React Native `Share` with `t('members.shareInviteMessage', { code, farm })`.
  The string gains a link beside the bare code — six locales.
- `JoinFarmScreen.tsx:63` starts `code` at `''` and only ever sets it by typing
  or scanning. It accepts a route param.

**The actual gap** is `AddWorkerScreen.tsx:59-67`: a failed `lookupUser` alerts
"not found" and re-arms the scanner, with no branch offering to invite the
person instead. That dead end is what #35 is really about.

Note the QR encodes the bare 8-char code (`FarmMembersScreen.tsx:297`,
`JoinFarmScreen.tsx:124-131`). It stays that way — existing printed QR codes
must keep working. The link is additive.

## B.6 Chemistry consolidation (#36) — non-destructive half only

Two live tables hold real farmer data: `chemical_data` (crop-scoped,
`measurement_date` + `measurement_time`) and `water_quality_records`
(pond-scoped, single `recorded_at`), duplicating five measurements — ammonia,
nitrite, nitrate, alkalinity, hardness.

**No table merge.** Migrating live production rows across a crop-scoped /
pond-scoped mismatch, for an item filed under "polish", is a bad trade. Two
things are done instead:

1. **The two identical tiles.** `PondDashboardScreen.tsx:96` and `:106` both
   render icon `science`, leading to overlapping forms. Distinct icons and
   labels that say which is which.
2. **The two threshold tables, collapsed to one source.**
   `frontend/src/constants/ranges.ts:1-15` (flat min/max, 10 params) and
   `frontend/src/features/waterQualityThresholds.ts:56-66` (five-zone,
   per-species) both export a `ParameterStatus` type and a live status
   function. They **already disagree**: transparency's upper bound is 40 in
   `ranges.ts:9` and 45 in `waterQualityThresholds.ts:65`. That is a live
   wrong-status bug, not a tidiness concern. `waterQualityThresholds` wins —
   it is species-aware, and the alert engine is the thing the UI must agree
   with.

The unused `cropId` route param on `WeeklyChemistryScreen` (`:59`, callers pass
it at `WeeklyChemistryHistoryScreen.tsx:128,225`) is dropped here.

## B.7 Dead code (#37)

Two confirmed removals:

1. `backend/src/crops/crops.service.ts:128-135` — `findByPond(pondId, userId)`.
   Zero callers, and a byte-for-byte duplicate of `findAll`'s body (`:113-126`)
   minus the empty-`pondId` guard. Textual hits elsewhere are different
   classes; `reports.service.ts:163` has a comment explaining why it is *not*
   used.
2. `frontend/src/screens/main/ReportsScreen.tsx` and its dead import at
   `frontend/src/navigation/MainNavigator.tsx:19`. No `Tab.Screen`, no
   `Stack.Screen`, no `navigate('Reports')` anywhere in `frontend/src`. The
   jest mock at `navigation/__tests__/MainNavigator.tabs.test.tsx:18` goes with
   it.

**A stale ledger claim, corrected here so it is not re-chased:** row 37 says
`WeeklyChemistry` ignores `queued`. It does not — `:120-123` handles it. Only
the unused-`cropId` half holds, and that is folded into B.6.

## B.8 Two defects found in these files, folded in

Neither is in §5. Both sit inside files this release already opens, and both
lose data.

1. **`expenses.user_id` deletes money history.** The research spec asks for the
   FK to become `ON DELETE SET NULL`. It is currently `ON DELETE CASCADE`
   (`1740487200000-DatabaseQualityFixes.ts:169`, dropped at
   `1780287841640-AddInventoryNotes.ts:35` and re-added **still CASCADE** at
   `:293`) — so deleting a user silently deletes their expense rows. The column
   is also `NOT NULL`, which the spec does not mention and which means
   `SET NULL` alone cannot apply: it must become nullable **and** `SET NULL`.
2. **`transactions` writes are gated on read.** `transactions.service.ts:117`
   `remove` is a hard delete, and `update` (`:97-105`) runs at
   `VIEW_FINANCIALS` — the same capability as reading. Anyone who can see the
   money can rewrite or erase it. Same family as the ungated-harvest gap Phase
   1 fixed. Writes move to a write capability; the hard delete becomes a soft
   one or is gated to owner.

---

## Migrations

Four, in this order. House style per `1780600200000-AddInventoryIcon.ts`:
additive, idempotent (`IF NOT EXISTS`), FKs wrapped in
`DO $$ BEGIN … EXCEPTION WHEN duplicate_object THEN NULL; END $$;`, always
reversible, applied by hand — `migrationsRun` is false in production.

| Timestamp | Name | What |
|---|---|---|
| `1780600300000` | `AddInventoryMovements` | `inventory_movements` table (B.3) |
| `1780600400000` | `AddInventoryFarms` | join table, backfill from `farm_id`, then `farm_id` nullable (B.1) |
| `1780600500000` | `AddTransactionInventoryItem` | `transactions.inventory_item_id` nullable, FK SET NULL (B.2) |
| `1780600600000` | `FixExpensesUserFk` | `expenses.user_id` nullable + FK CASCADE → SET NULL (B.8) |

`1780600400000` is the only one with a data step; its `down` drops the join
table without restoring nullability, which is safe because `farm_id` is
backfilled and never cleared.

---

## Testing

- `logProgress.pondFreshness` — the boundary cases are the whole feature:
  never-logged, 47 h, 49 h, 6 d, 8 d, and a fallow pond (exempt).
- `pondHealth.healthOf` — `critical` and `watch` beat `stale`; `stale` beats
  `fine`; `fallow` beats everything. Existing tests keep their shape because
  the new argument is additive.
- `formatAge` — hours/days boundary, null, and the Intl-unavailable fallback
  path the rest of `formatDate.ts` already guards.
- `rollUpFarm` — the new `stale` count, and that "All fine" cannot appear
  alongside a non-zero stale count.
- `inventory.service.adjustStock` — a movement row is written on success and
  **not** written when the negative-stock guard rejects the update.
- Feed pipeline — deduct, compensating credit, edit reconcile and delete each
  leave a distinguishable movement row, which is the defect B.3 exists to fix.
- `route-capabilities.spec.ts` — the transactions write gate from B.8.
- Push — recipient resolution for `joinApprover: 'owner'` vs `'managers'`, and
  that the legacy join path fires too.
- Locale parity across all six, and `check-calculator-i18n.sh`.

## Release order

Migrations (all additive, invisible to the running backend) → merge → Render
deploy live → OTA. The new bundle must never reach phones before its endpoints
exist.

## Out of scope, recorded

- Shelf grid (#30) — dropped by decision.
- Chemistry table merge — see B.6.
- Per-event push preferences — no table exists; not built.
- The 63-key defaulted-i18n backlog. `keyUsage.test.ts` ratchets at `<= 63` and
  never prints the list; it is derivable by re-running the scan but is its own
  task, not this release's.
- Native-speaker review of the hi/bn/ta/te/or strings, now including this
  release's.
- Credential rotation carried forward from Phase 2.
