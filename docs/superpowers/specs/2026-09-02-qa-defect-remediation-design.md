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
