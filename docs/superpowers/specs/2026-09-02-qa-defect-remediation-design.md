# QA Defect Remediation — Design

**Date:** 2026-09-02
**Source:** `QA_ENGINEERING_HANDOVER_REPORT.md` (19 defects) and `maestro_tests/` (45 flows)
**Baseline:** report written against `fbd05ba`; every claim re-verified against HEAD before this spec.
**Status:** approved for planning

---

## 1. Purpose

The QA handover reports 19 defects across the five calculator screens, the pond
prefill path, the shared design system and the calculations API. Three are
release-blocking. This spec turns that report into an ordered, verifiable
sequence of changes, and records the four product decisions taken plus the
places where the report's own plan needs correcting.

The release gate is **CONDITIONAL GO**: it becomes GO when BUG-001, BUG-002 and
BUG-019 are fixed and re-verified on device.

## 2. Verification of the report against HEAD

Every code claim in the report was checked against the tree rather than taken on
trust. All of the following reproduce verbatim today:

| Claim | Location | Verified |
|---|---|---|
| Ammonia banded on the raw double, rounded afterwards | `backend/src/shrimp-calculations/shrimp-calculations.service.ts:239-244` | yes, including the stale PRD comment |
| Client fallback uses `>= 0.1` while server uses `> 0.1` | `frontend/src/screens/calculators/FreeAmmoniaScreen.tsx:14-18` | yes |
| Salinity defaults to `'15'`, hint says "For reference only" | `FreeAmmoniaScreen.tsx:60`; `i18n/locales/*/calculators.ts:130` | yes, all six locales, same line |
| `setPrefilled(true)` unconditional; SR derived with no sampling gate | `DailyFeedCalculatorScreen.tsx:74,77-81` | yes |
| Dashboard survival ungated | `PondDashboardScreen.tsx:196-201`, rendered `:420` | yes |
| `pondAreaM2` never read in `handleCalculate` | `DailyFeedCalculatorScreen.tsx:93-135` | yes |
| `recommended-feeding-rate` unvalidated; sibling `biomass` validates | `shrimp-calculations.controller.ts:136-147` vs `:119-134` | yes |
| `calculateSurvivalRate` has no clamp | `shrimp-calculations.service.ts:59-62` | yes |
| No calculator tests exist | `frontend/src/screens/calculators/` | yes, no `__tests__` directory |
| Placeholder contrast 1.88:1; hint contrast 3.32:1 | `theme/tokens.ts:37,40`; `theme/colorRoles.ts:17` | yes, both reproduce exactly |

The report is reliable. Two corrections follow.

### 2.1 Correction — Phase 1 as written is internally inconsistent

The report places BUG-001 and BUG-002 in the same phase, and its Phase 1 exit
checklist requires flows 12 and 14 to "still pass" as proof the band change did
not move a mid-band verdict.

Flows 12, 13, 14, 26 and 27 never type into the salinity field. They ride the
`'15'` default that BUG-002 removes. Re-running the service's own model:

| flow | asserted | salinity 15 | salinity 0 |
|---|---|---|---|
| 12 | `0.1453` | `0.1453` WARNING | `0.1593` WARNING |
| 13 | `2.2693` | `2.2693` CRITICAL | `2.3955` CRITICAL |
| 14 | `0.0025` | `0.0025` SAFE | `0.0028` SAFE |
| 26 | `0.1000` | `0.1000` SAFE | `0.1096` WARNING |
| 27 | `0.1000` | `0.1000` WARNING | `0.1096` WARNING |

Every asserted value moves. Worse, 26 and 27 both become `0.1096`: the boundary
*pair* that is the entire on-device evidence for BUG-001 collapses into two
identical cases and stops testing the boundary at all.

**Resolution.** Flows 12, 13, 14, 26 and 27 must set salinity **explicitly**
(`15`, preserving today's expectations) in the same PR as BUG-002 or earlier.
The flows then no longer depend on a screen default, their numbers hold, and 26
flips band for the intended reason — BUG-001 — rather than as an artefact.

### 2.2 Correction — the proposed accessibility colour misses AA

The report proposes `#5B7286` for `placeholderColor`, quoting 4.63:1 on
`#EEF2F5`. Recomputed by the WCAG 2.1 relative-luminance formula it is
**4.45:1** — below the 4.5:1 bar the ticket itself sets. Its measurements of the
*existing* colours are exact (1.88:1 and 3.32:1 both reproduce), so this is an
isolated slip in the proposed replacement.

**Resolution.** Use `#586E82`: 4.70:1 on `#EEF2F5` and 4.96:1 on `#F5F8FA`. It
is the nearest colour to the report's intent that clears AA on both input
backgrounds.

### 2.3 Smaller corrections

- **BUG-007** additionally needs `Max` added to the `class-validator` import at
  `advanced-calculations.dto.ts:1`; it is not currently imported.
- **Flow 41** asserts `"5000"`, the Pond Area value. Deleting that field
  (BUG-005, decision D2) touches flow 41 a second time, after PR 3 has already
  inverted it.

## 3. Decisions taken

| # | Question | Decision | Consequence |
|---|---|---|---|
| D1 | Scope | All 19, phased | 8 PRs; may stop after any phase |
| D2 | BUG-005 Pond Area | **Delete the field** | Remove input, state, prefill, invalidation dep. Flow 25 deleted, not inverted. No new i18n keys. |
| D3 | BUG-002 salinity | **Blank + honest hint** | No default. The hint states that salinity affects the result and that `0` means freshwater. A blank field is submitted as `0` — the freshwater Emerson form the service documents at `service.ts:218-219` — and the hint is what makes that behaviour stated rather than silent. `FreeAmmoniaScreen.tsx:89` keeps `parseFloat(salinity) \|\| 0`; the change is the removed default and the truthful hint, not the coercion. |
| D4 | BUG-008 SR | **Clamp to 100** | Implements the clamp `calculation.dto.ts:32` already documents. Field counts overshoot stock through estimation error; rejecting would break legitimate callers. |

## 4. Departure from the report — where the regression tests live

The report schedules BUG-016 (test debt) last, as a phase that "absorbs the
guards from every phase above". This spec dissolves BUG-016 into the other PRs
instead: **every fix lands with its regression test in the same PR.**

BUG-016's own finding is that nothing pinned the boundaries, which is why
BUG-001 survived a full screen redesign and BUG-008 survived the very comment
documenting it. Deferring the guards to a final PR reproduces that gap for the
whole duration of the work and ships every earlier PR unguarded. It also
contradicts how this repo already operates (72 frontend suites, 109 backend).

What remains of BUG-016 as standalone work: the theme contrast test, which
belongs with the accessibility pass rather than with any single defect.

## 5. Sequence

Ordered by deploy target and by shared code path. Gate PRs are 1–3.

| PR | Deploy | Tickets | Rationale |
|---|---|---|---|
| **1** | backend | **BUG-001** + boundary spec | Gate. Backend-first is safe: the client fallback already uses `>= 0.1`, so server and client agree the moment the server changes. |
| **2** | OTA | **BUG-002**; `safeMessage` ×6 locales; salinity made explicit in flows 12/13/14/26/27; invert 26 | Gate. Flow hardening must be in this PR or earlier (§2.1). |
| **3** | OTA | **BUG-019 + BUG-018** + tests; invert 41 | Gate. Same 12 lines of `applyContext`; includes the `PondDashboardScreen.tsx:196` survival gate. |
| **4** | OTA | **BUG-003**, **BUG-005** | Both calculator-screen UI. Flow 09 inverted; flow 25 deleted; flow 41's `5000` assertion dropped. |
| **5** | backend | **BUG-004**, **BUG-007**, **BUG-008** + specs | All API-contract work, one deploy. |
| **6** | OTA | **BUG-006** (`#586E82`), **BUG-014**, **BUG-015**, contrast test | One accessibility pass, one visual QA sweep. |
| **7** | OTA | **BUG-017** → **BUG-009**, **BUG-010**, **BUG-011**, StatRow shrink | `parseNumericInput` first: it closes 009 as a side effect and 010/011 become one-line range checks on top. 29 `parseFloat` sites across 5 screens. |
| **8** | OTA | **BUG-012**, **BUG-013** + CI grep guard | Dead code and i18n cleanup. |

### Ordering constraints that are not negotiable

1. Flows 12/13/14/26/27 gain an explicit salinity **before or with** BUG-002 (§2.1).
2. BUG-018 and BUG-019 ship together — same 12 lines.
3. BUG-017 precedes BUG-009/010/011 within PR 7.
4. BUG-006 and BUG-014 ship together — adjacent tokens, one visual sweep.

## 6. Verification strategy

**Runnable here, and gating every PR:** `npx tsc --noEmit` and `npx jest` on
both sides. New suites this work adds:

- `backend/src/shrimp-calculations/shrimp-calculations.boundary.spec.ts` — ammonia
  bands pinned on **both** sides of `0.1` and `0.5`; the SR clamp.
- `frontend/src/screens/calculators/__tests__/validation.test.ts` — the guards
  each screen applies, including `parseNumericInput`.
- `frontend/src/theme/__tests__/contrast.test.ts` — WCAG ratios computed from the
  tokens, so a colour change cannot silently drop below AA again.

**Not runnable here:** the Maestro flows require the physical OPPO CPH2467 on
ADB with a signed-in session and the live backend. Flow inversions land as
reviewed diffs; the on-device suite is run by the operator. No PR in this plan
may claim Maestro verification performed from the development machine.

**Deploy coupling:** PRs 1 and 5 need a backend deploy (Render, Singapore); the
rest are OTA. `expo-updates` runs `CHECK_ON_LAUNCH=ALWAYS` and applies on the
second launch, so the device suite must be re-run only after the new bundle is
confirmed live.

## 7. Risks carried, not resolved

- **The API was never tested on the wire.** Report §6.2: `run-as` fails on a
  release build, so BUG-004, BUG-007 and BUG-008 rest on source analysis plus
  local re-execution of the service functions, not observed requests. Closing
  this needs a debug build, an intercepting proxy with a trusted CA, or a
  service-account token. PR 5's specs mitigate but do not close it.
- **Prefill was exercised on one shape of pond only** — day 1, stocked, no
  sampling. A pond *with* a sampling, a mid-cycle pond, and a pond with logged
  mortality each take a different branch of `applyContext`. PR 3 must add unit
  coverage for those branches, since the device suite cannot reach them without
  more production writes.
- **Single device.** Touch-target and contrast measurements are specific to one
  handset at 408 dpi effective. PR 6's changes are token-level and therefore
  density-independent, but the 48 dp claim in BUG-015 is not re-measurable here.
- **`QA-AUDIT-POND` is live production data** on the owner's account, retained by
  decision. Flows 40, 41, 43, 44 depend on it. Deleting it requires re-running
  two seed flows that write to production.
- **~72 of 105 routes remain unexercised**, including all auth and onboarding.
  This plan addresses the calculators and the prefill path; it is not a
  whole-app remediation and must not be reported as one.

## 8. Out of scope

Money surfaces, log-entry forms, history totals, and every engine screen. The
report's own verdict covers the five calculators and the prefill path only.

---

# Workstream B — Smart logging reminders and progress visibility

Added 2026-09-02 by request. Everything in this workstream is **OTA-shippable;
nothing requires a native build.** That is a verified claim, not an assumption —
see §B2.

## B1. What already exists

This is not a greenfield feature. The audit of the tree found:

| Capability | Where | State |
|---|---|---|
| Daily reminders 06:30 / 13:00 / 18:00 | `frontend/src/utils/notifications.ts:76-109` | Ships today. Fires **unconditionally**. |
| Weekly chemistry reminder, Sunday 07:30 | `notifications.ts:135-155` | Ships today. Fires **unconditionally**. |
| Push token registration | `utils/notifications.ts:18`, `SettingsScreen.tsx:84`, `api/push.ts` | Working |
| Server push delivery | `backend/src/push/push.service.ts` — `users.push_token` + Expo Push API | Working |
| "Was it already logged?" data | `PondContext.waterQuality.recordedAt`, `.chemistryAsOf`, `.lastFeedAt`, `.lastTrayAt` | Already on the wire |
| Every pond's context in one request | `/alert-center/today` → `fetchTodaySnapshot` | Already fetched by Today |
| Support reply storage | `feedback_reports.admin_response`, admin `@Patch(':id')` | Stored, **no push sent** |
| Reply detail screen | `frontend/src/screens/settings/FeedbackDetailScreen.tsx` | Exists — deep-link target |

**So the request is narrower than it sounds:** make existing reminders
conditional, derive progress from data already fetched, and wire a push onto an
admin action that already happens.

## B2. Why this is OTA, with evidence

| Dependency | Version | Added | In the shipped binary? |
|---|---|---|---|
| `expo-notifications` | `~0.32.16` | before the 2026-08-24 build | yes — plugin configured in `app.config.ts:56-65` |
| `expo-device` | `~8.0.10` | same | yes |
| `@react-native-picker/picker` | `2.11.1` | commit `00df9c5`, 2026-02-17 | yes — already used by `MeasurementsScreen.tsx` |

Editable reminder times (decision D7) use `@react-native-picker/picker`, which
predates the build and is already exercised in JS. **No new native module, no
rebuild.**

Anything that later needs a *new* native dependency must be marked **NATIVE** and
scheduled against a binary release. Nothing in this workstream is.

## B3. Decisions taken

| # | Question | Decision |
|---|---|---|
| D5 | Reminder accuracy model | **On-device now, QStash later.** Ship on-device conditional scheduling here; a separate follow-up spec covers moving to server-decided push. |
| D6 | What counts as "done" for a slot | **Every active pond must be logged.** A slot stays pending until all active ponds have a reading in that window. |
| D7 | Reminder times | **Keep 06:30 / 13:00 / 18:00 and Sunday 07:30 as defaults, but let the farmer edit them** in Settings, persisted locally. |

## B4. The one real constraint

A local notification can be made conditional only when it is **scheduled**,
never when it **fires** — nothing of ours runs at fire time. The design
therefore recomputes and re-arms whenever the app can: on foreground, and at the
`saveRecord()` choke point after any log lands.

**Scheduling model.** Replace the three repeating `DAILY` triggers and the one
`WEEKLY` trigger with a **rolling 7-day window of one-shot `DATE` triggers**,
re-armed on every sync. A slot already satisfied is simply not scheduled.
21 daily + 1 weekly pending notifications sits far inside platform limits.

Two consequences, both accepted and documented rather than designed around:

1. **If the app is not opened for 7 days the reminders lapse.** The repeating
   triggers they replace never lapse. Judged acceptable: the window is re-armed
   on every open, and a farmer who has not opened the app in a week has been
   reminded every day of that week.
2. **Multi-device / multi-user false positives.** If a worker logs the morning
   check on their phone, the owner's phone still reminds until it next syncs.
   This is exactly what D5's QStash upgrade removes, because a server decides at
   send time. Until then it is a known limitation, and the notification copy
   should be a nudge rather than an accusation.

## B5. Design

### B5.1 Derivation — one pure module, no new requests

`frontend/src/features/logProgress.ts` (new). Pure functions over
`PondContext[]`, so every rule is unit-testable without a device or a network:

- `slotAt(date)` — which window (`morning` / `afternoon` / `evening`) a time falls in
- `pondSlotDone(ctx, slot, now)` — `waterQuality.recordedAt` inside today's slot window
- `pondFedThisSession(ctx, slot, now)` — `lastFeedAt` inside today's slot window
- `chemistryDone(ctx, now)` — `chemistryAsOf` within the last 7 days
- `progressFor(contexts)` — `{ overall, byFarm, byPond }` counts for the UI

This module is the single definition of "done". The reminders, the Today card
and the farm/pond hints all read it, so they cannot disagree with each other —
which is the failure mode BUG-019 is an instance of elsewhere in this codebase.

### B5.2 Reminder engine

`notifications.ts` gains `syncReminders(contexts, times)`:

1. Cancel all tagged pending notifications.
2. For each slot occurrence in the next 7 days, schedule a one-shot **unless**
   that slot is already satisfied for every active pond.
3. Same for the weekly chemistry slot.

Called from the app-foreground handler and from `saveRecord()`'s success path —
the same choke point that already drives `invalidateForEntity()`.

### B5.3 Today progress card

`frontend/src/components/today/LogProgressCard.tsx` (new). Overall progress bar,
expandable to per-farm and then per-pond rows. Reads the `home` query's existing
contexts — **no new endpoint and no additional request.**

**Backend change required:** `PondContext` carries no `farmId`, and
`fetchTodaySnapshot` flattens per-farm results, losing the association. Add
`farmId` to the payload — additive and backwards-compatible. Folds into the
backend PR already in this plan rather than adding a deploy.

### B5.4 Farm and pond session hints

A small shared badge driven by the same `logProgress` module: on the farm page's
pond rows, and on the pond dashboard header — whether this pond has been logged
and fed for the current session.

### B5.5 Support-reply notification

- **Backend:** where `admin_response` is written, call
  `pushService.sendToUser(report.userId, ...)` with
  `data: { type: 'feedback_reply', reportId }`. Best-effort, consistent with
  `sendToUser`'s never-throws contract.
- **Frontend:** a notification-response handler routes that payload to
  `FeedbackDetailScreen`, plus an in-app unread marker via the existing
  `notificationStore`.

### B5.6 Editable times

Settings gains hour/minute selection per slot using `@react-native-picker/picker`,
persisted to AsyncStorage and fed into `syncReminders`. Defaults unchanged.

## B6. Sequence (continues §5)

| PR | Deploy | Content |
|---|---|---|
| **5** *(extended)* | backend | BUG-004/007/008 **+ `farmId` on `PondContext` + feedback-reply push send** |
| **9** | OTA | `logProgress.ts` + tests; reminder engine rewritten to the rolling window |
| **10** | OTA | Today `LogProgressCard` (overall / per-farm / per-pond) |
| **11** | OTA | Farm-page and pond-page session hints |
| **12** | OTA | Editable reminder times; support-reply deep link and unread marker |

PR 9 must precede 10 and 11 — both consume `logProgress`. PR 5 must precede 10,
which needs `farmId`.

## B7. Verification

`logProgress.ts` is pure, so slot-boundary behaviour is unit-tested directly:
midnight rollover, a reading exactly on a slot boundary, a pond with no reading
at all, and the all-ponds-done rule with one pond outstanding. The reminder
engine is tested against a faked `expo-notifications` module asserting which
slots were scheduled and which suppressed — no device needed.

Not verifiable here: actual delivery, notification tap-through, and the picker
UI. Those need the handset.

## B8. Explicitly out of scope

Server-decided push (the QStash upgrade, D5), quiet hours, per-member reminder
routing, and reminders for any log type beyond water quality, feed and weekly
chemistry.
