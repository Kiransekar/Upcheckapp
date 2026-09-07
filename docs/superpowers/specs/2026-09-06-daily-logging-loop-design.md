# Daily Logging Loop — Design

**Date:** 2026-09-06 · **Status:** design approved, NOT YET IMPLEMENTED
**Baseline:** master `2df023e`, tree clean.
**Companion:** `docs/superpowers/specs/2026-09-06-onboarding-activation-design.md`. W6/W7 there end
where this document begins — onboarding's finish line is a stocked pond and a first log; this
is what happens on every day after that.

## Purpose

The daily loop is the product. Every engine, report and money figure is downstream of a farmer
standing at a pond deciding whether to open the app or the notebook. This document covers what
still makes the notebook win, and two correctness gaps that let the app tell a farmer they are
up to date when they are not.

---

## What is already solved — do not re-solve it

`docs/USER_PERSPECTIVE_PRODUCT_ANALYSIS.md` (July) rates logging friction as the top unfixed
retention risk. Most of it has since been fixed. Verified by reading the screens:

1. **Quick mode.** `WaterQualityLogScreen` shows pH / DO / temperature by default; the other
   seven fields sit behind one tap. July's finding #2 is closed.
2. **Per-field prefill with a freshness rule.** Slow-changing fields (salinity, alkalinity,
   hardness, transparency) younger than 12 h are filled silently and captioned "carried over";
   anything older is *offered* via `staleOffers`, never written. Typing in a carried-over field
   clears its warning. The age test is per field against that field's own `<field>AsOf`, so a
   pond can carry an hour-old salinity and a week-old alkalinity and only the first is filled.
3. **`recordedAt` is stamped at press time**, so an offline drain does not misdate a reading —
   the same lesson as the attendance check-in fix (`f7c3e3e`).
4. **A permanent rejection is parked, not dropped.** `syncStore` routes 400/422 to
   `failedOperations` ("never silently drop"), 401/403/5xx/network to retry, 409 to done.
   `ARCHITECTURE.md` §3.3 still says "2xx or 4xx → drop"; **that text is stale and the code is
   correct.** Fix the doc, not the code.
5. **`logProgress.ts` is the single definition of "done"**, so reminders, the Today progress
   card and the farm/pond hints cannot drift apart.
6. **Per-parameter `asOf` + confidence decay** in `pond-context.service.ts`. Stale values cannot
   masquerade as fresh to the engines; `computeConfidence` decays a stale input toward a 0.3
   floor. This layer is sound.
7. **`cycleRequirement.ts`** blocks crop-keyed logs on an unstocked pond, because such a row
   saves successfully and is then excluded from every cycle figure.

---

## Decisions taken

| # | Decision | Chosen |
|---|---|---|
| D1 | Multi-pond friction | **One grid screen, all ponds at once.** Rows = ponds, columns = the quick-mode parameters. |
| D2 | Empty records | **Require at least one value, client *and* server.** |
| D3 | Range validation | **Warn, do not block.** A crisis reading is exactly the extreme value worth recording. |
| D4 | Mortality | **Add it to the QuickLog tiles.** It feeds live population → biomass → FCR → feed advice. |
| D5 | Where the grid lives | **A new screen, entered from a restructured QuickLog** with two explicit sections: "Morning rounds" (one action, all ponds) and "Log for one pond" (the existing picker + tiles). |

---

# The workstreams

## L1 — QuickLog must work offline  🔴 highest priority

### The defect

`QuickLogScreen` is the only major screen that does not use the read cache. It holds ponds in
`useState` and calls `pondsApi.getMine()` directly inside `useFocusEffect`.

Meanwhile `'ponds'` is already in `PERSISTED_ROOTS` (`query/client.ts:56`), and `HomeScreen`
fetches **exactly the key QuickLog needs** — `qk.ponds()` — so the data is already on disk and
already warm.

The result: offline at the pond, the centre **"+" tab button** — the primary entrance to the
entire daily loop — hits `error && ponds.length === 0` and renders `ErrorState` with a retry
button. The farmer never reaches a form. `saveRecord` behind it would have queued the reading
perfectly.

**An offline-first write queue behind an online-only door.** This is the single sharpest
contradiction in the product, and the fix is to stop doing something rather than to build
anything.

### The fix

Replace the manual fetch with `useAppQuery({ queryKey: qk.ponds(), queryFn: … })`, the same key
`HomeScreen` already warms. Keep the existing three-way render (loading / error-with-no-cache /
empty), because "failed" must never look like "loading" or "empty" — that distinction is
deliberate and correct, it simply never gets a chance to show cached data today.

**Test:** with a populated persisted cache and the network failing, QuickLog renders the pond
list and routes to a log form. Mutation-check it — reverting to the raw fetch must fail.

---

## L2 — A log must carry at least one value  (D2)

### The defect

There is no guard requiring a single value, on either side. Every field on
`CreateWaterQualityRecordDto` is `@IsOptional()`, and `WaterQualityLogScreen.handleSave` parses
floats and submits with no validation at all. And `logProgress.pondSlotDone` tests only
`within(ctx.waterQuality?.recordedAt, from, to)` — that a record *exists* in the slot, not that
it contains anything.

So tapping Save on a blank form: the reminder stops, the Today card goes green, the streak holds.
Meanwhile every `*AsOf` stays old, so `computeConfidence` correctly stays low.

**The app is arguing with itself.** "Done" is computed from record existence; "useful" is
computed from per-value freshness. Only the optimistic one is ever shown to the farmer. Someone
logging blank or quick-mode-only records every day sees a perfect green streak while the engines
quietly lose confidence, and is never told why the advice got vaguer.

### The fix

- **Client:** Save is disabled until at least one parameter has a value. Notes alone do not
  count — a note is not a reading.
- **Server:** a validator on the DTO rejecting a payload whose every parameter is null, so a
  record queued offline by an older build is rejected on drain rather than stored empty. It will
  park in `failedOperations` and be visible, which is the correct outcome.
- Apply the same rule to the other parameter-style logs, not water quality alone.

This is deliberately enforced at both ends. Client-only leaves the queue able to write empties;
server-only means the farmer learns at drain time. The parity is the point — the same lesson as
PWDVAL-1.

---

## L3 — The multi-pond grid  (D1)  ⭐ the retention bet

### The problem

**No batch, no apply-to-all, no next-pond continuation exists anywhere in the codebase**
(verified by grep across `screens/`, `components/`, `features/`).

Quick mode cut each form from ten fields to three. Nobody cut the count of forms. A four-pond
farmer doing morning water quality walks QuickLog → pond picker → tile → form → save → back,
four times over — roughly 35–40 interactions — then again in the evening, plus feed.
Twice-daily DO is standard practice, not an edge case.

This is where paper still wins, and **not on field count**: one notebook page holds all four
ponds in a single pass. Depth was fixed; breadth was not.

### Which screen this is, exactly  (D5)

**A new screen. `WaterQualityLogScreen` is not modified, and four of its five entry points are
untouched.**

There are five ways into the water-quality form today, and only one of them means "I am about to
walk the farm":

| Entry | What the farmer already decided | Changes? |
|---|---|---|
| `QuickLogScreen` — picker + tile | nothing yet | **yes — see below** |
| `PondDashboardScreen:84` action grid, and `:693` | which pond | no |
| `DailyRoutineScreen:144` | which pond | no |
| `WaterQualityHistoryScreen:306` FAB | which pond | no |
| `WaterQualityHistoryScreen:236` edit | which record | no |

Once a farmer has navigated *into* a pond, a grid of every pond is wrong — they already answered
the "which pond" question. So the grid hangs off QuickLog alone, and the per-pond form remains
the right screen for one pond, for editing, and for the full ten parameters behind "more".

### QuickLog is restructured into two intents

QuickLog's model today is *pick a pond → pick an action*. The grid is *pick an action → all
ponds*. These do not compose: if the water-quality tile fans out across every pond, the pond
picker above it means nothing for that tile while remaining necessary for feed, sampling and
measurements.

They are two genuinely different tasks, and the screen should say so:

- **"Morning rounds"** (top) — one action, every pond, one pass. The grid.
- **"Log for one pond"** (below) — the existing pond picker and action tiles, unchanged.

This also makes the grid discoverable, rather than hiding it behind a tile that silently behaves
differently from its neighbours depending on pond count.

With one pond, the rounds section collapses to nothing useful — render only the second section,
so a single-pond farmer sees exactly today's screen.

### The design

Rows are ponds, columns are the quick-mode three (pH, DO, temperature). One Save writes N
records through `saveRecord`, each with its own client-minted UUID, so the existing idempotent
replay and offline queue carry it unchanged. No new sync machinery.

Rules carried over from the single-pond form, because they are what make the data honest:

- **Prefill and the 12 h freshness rule apply per pond**, exactly as today. A carried-over cell
  is captioned, not silently filled.
- **A blank row is not a record.** Ponds left empty are skipped, not written as empties (L2).
- **Warnings are per cell** (L4), and never block the save.
- **Partial failure is reported per pond**, and the grid stays open with the failed rows intact.
  This is the mistake `PondNamesScreen` makes today — it toasts a count and resets to Home with
  no retry path — and it must not be repeated here.

The per-pond form stays. It remains the right screen for one pond, for editing, and for the full
ten-parameter entry behind "more".

### Feed is the obvious second instance, and should follow

`FeedLogScreen` carries date, a fasting toggle, four tray values, total kg, feed type, notes and
an inventory item. Most are constant across ponds on a given day — **same sack, different
ponds** — and only the kilograms differ. So the feed grid is: shared feed type and inventory
item chosen once in the header, one kg column per pond row.

Ship water quality first. Prove the shape, then add feed. **Do not build a generic
grid framework for two instances** — parameterise the columns when the second one actually
exists, not before.

---

## L4 — Range warnings, not blocks  (D3)

The server has bounds (`ph` 0–14, `temperature` 0–50, `dissolvedOxygen` 0–30, `salinity` 0–60,
`ammonia`/`nitrite` 0–100, `nitrate` 0–500). The client has none — `ParameterInput` renders a
`rangeHint` caption but enforces nothing.

Online this is a harmless round trip. Offline it means a 6 a.m. fat-finger under screen glare is
queued, toasted as "Saved", and only discovered that evening when it parks in
`failedOperations`. Recoverable and visible — but hours late, and the reading is gone.

**Warn, never block.** An inline "unusually high — sure?" on a cell outside the agronomic range,
and the save proceeds. A real crisis reading (DO 1.2 mg/L, an ammonia spike) is precisely the
extreme value most worth recording, and a hard block would stop the farmer logging the emergency
that the whole product exists to catch.

`features/waterQualityThresholds.ts` already holds the agronomic bands the pond dashboard uses —
read them, do not author a second set.

---

## L5 — Mortality in QuickLog  (D4)

`ACTIONS` in `QuickLogScreen` is water quality, feed, daily routine, sampling, measurements, open
pond. Mortality is absent, reachable only by drilling into the pond dashboard.

It is a daily observation for the target persona, and it is the input to live population →
biomass → running FCR → feed advice. Leaving it off the fast path silently degrades the entire
engine chain, which is the subject of the next design document.

Add it as a tile. It is crop-keyed (`mortality.crop_id` is NOT NULL) so `requiresActiveCycle`
already covers it — the existing lock-and-route-to-CreateCycle behaviour applies with no new
logic.

---

## L6 — Reminder times are device-local  (small, listed for completeness)

`features/reminderTimes.ts` persists to one AsyncStorage key. So the schedule is per *device*,
not per *user*: on a shared phone two workers share one set of reminder times, and a reinstall
silently reverts to defaults.

Real but minor, and it touches the shared-device persona the product explicitly designs for.
Fixing it properly means moving the preference to `users.preferences` — the same mechanism
`onboardingIntent` already uses. Worth doing when something else opens that file; not worth a
dedicated change.

---

# Ordering

| Order | Workstream | Why here |
|---|---|---|
| 1 | **L1** QuickLog offline | Smallest diff, largest correctness win, no dependencies. It is a deletion. |
| 2 | **L2** at-least-one-value | Closes the "green streak on no data" gap; L3's grid depends on the rule existing. |
| 3 | **L4** range warnings | Shares the threshold plumbing L3's cells will reuse. |
| 4 | **L3** water-quality grid + QuickLog restructure | The retention bet. Wants L2 and L4 settled first. |
| 5 | **L5** mortality tile | Independent; trivial. Land it with L3's QuickLog re-layout, not separately — the same file, and the tile belongs in the "log for one pond" section the restructure creates. |
| 6 | **L3-feed** feed grid | Only after the water-quality grid has proven the shape. |
| 7 | **L6** reminder times | Opportunistic. |

---

# Cross-cutting

- **i18n × 6.** L2, L3, L4 and L5 all add strings. Register in all six locales or the namespace
  silently resolves to nothing.
- **One doc fix.** `ARCHITECTURE.md` §3.3's "2xx or 4xx → drop" contradicts `syncStore`. Correct
  the doc in whichever PR touches sync first — a stale claim about data loss is worse than none.
- **No new sync machinery.** L3 writes N records through the existing `saveRecord`. If a design
  discussion starts inventing a batch endpoint or a transactional multi-write, stop: the
  client-minted-UUID queue already gives idempotent replay, and N queued records is the correct
  shape for a farmer who may lose signal between pond two and pond three.
- **Verification gate.** Both suites green and `tsc --noEmit` clean before commit; branch from
  `development`, PR into `development`, no self-merge (`AGENTS.md`).

# Explicitly out of scope

- **A generic multi-entity grid framework.** Two instances (water quality, feed) do not justify
  an abstraction. Parameterise when a third appears.
- **Changing what "done" means for the streak beyond L2.** Whether a quick-mode-only log should
  count as fully done — as opposed to merely non-empty — is a decision-engine question about
  confidence thresholds, and belongs in the next design document, not this one.
- **Voice or photo entry.** Plausibly transformative for this audience and genuinely large.
  Recorded so it is deferred deliberately rather than forgotten.
