# Decision Engines & Lunar — Design

**Date:** 2026-09-06 · **Status:** design approved, NOT YET IMPLEMENTED
**Baseline:** master `2df023e` plus the in-flight onboarding and daily-logging work.
**Companions:** `2026-09-06-onboarding-activation-design.md`,
`2026-09-06-daily-logging-loop-design.md`. That second document deliberately left one question
open for this one — whether a quick-mode-only log should count as fully "done" — and §E2 below
answers it.

## Purpose

The engines are the reason a farmer pays for this instead of keeping a notebook. A notebook
cannot tell you that your ammonia trend plus this lunar phase means elevated molt risk. That
makes them the most valuable surface in the product and the most dangerous: **a wrong-but-
confident recommendation is worse than no recommendation, because the farmer acts on it.**

This document is mostly not about making the engines smarter. It is about making them honest.

---

## What is already right — do not undo it

1. **Engines are pure functions over plain numbers.** `computeRation` never branches on data
   source. Testable without a device, and the seam that makes everything below possible.
2. **`reasons[]` and `factors{}` ship with every ration** — "+7% trays empty", "−25% molt
   window". The farmer can see *why*. Most competitors show a bare number.
3. **`pond-context` is a genuine shared input layer**, with per-parameter `asOf` timestamps and
   a weighted `computeConfidence` that decays stale inputs toward a 0.3 floor.
4. **`useFocusEffect`, not `useEffect`**, on every engine screen, with a comment recording why:
   a mount-only fetch kept advising on pre-log numbers because React Navigation keeps screens
   mounted. Someone found that and fixed it properly.
5. **The lunar backend is substantial** — 461 lines computing molt vulnerability from DO,
   temperature, free NH₃, pH swing, mineral deficit, disease, density ratio, tray residue and
   salinity, with a prioritised playbook and honest "prediction, not certainty" framing.
6. **Aeration's coefficients are already parameterised** (`kBiomass`, `kPlankton`, `kAeration`).
   The calibration knobs exist; §E4 is about using them, not adding them.

---

## Decisions taken

| # | Decision | Chosen |
|---|---|---|
| E-D1 | Missing inputs | **Refuse to compute and name what is missing.** No seeded fabrications, no swallowed errors. |
| E-D2 | Confidence | **Low confidence returns a range, not a point value.** |
| E-D3 | Precision | **Round to whole kg, or 5 kg above ~100 kg** — hero and per-meal alike. |
| E-D4 | Scheduled runs | **Out of scope here.** Deferred whole to area 8 (Alerts & notifications). See §Deferred. |

---

# The workstreams

## E1 — Stop fabricating  🔴 the headline

### The defect, and it is systemic

Every one of the five computational engine screens swallows its pond-context failure:

```
AerationScreen.tsx:55       .catch(() => {});
DiseaseRiskScreen.tsx:69    .catch(() => {});
FeedAdvisorScreen.tsx:66    .catch(() => {});
HarvestTimingScreen.tsx:65  .catch(() => {});
LunarScreen.tsx:70, 79      .catch(() => {});
```

And every one is pre-seeded with invented numbers that **survive that failure**, because
`fill()` only overwrites when the real value is non-null:

| Screen | Fabricated defaults |
|---|---|
| Feed Advisor | **120,000 shrimp @ 25 g**, 4 meals |
| Aeration | 2,000 kg biomass, 4 HP, DO 6, 4,000 m², 6 h run, ₹8/kWh |
| Harvest Timing | ABW 22 g, ADG 0.4 g/d, **N 80,000**, 4,000 m², carrying 2, **feed ₹60/kg**, disease risk 5 |
| Lunar | ABW 20 g |

So offline, or on a Render free-plan cold start, or on any error at all, the farmer taps
Calculate and receives a confident, precisely-formatted recommendation **computed entirely from
numbers nobody entered.** There is no error, no warning, and no way to tell.

The sharpest part: `{ctx && <ConfidenceChip … />}`. The one element that signals doubt is
conditional on the very object that failed to load, so **it disappears exactly when the data is
least trustworthy.**

Harvest Timing is the worst instance — it advises *when to harvest*, the season's biggest
financial decision, from a feed price and a population that were never supplied.

This is the same class of problem the team already solved for ponds with `assumedFields`
("rendering a default with the same confidence as a measurement is a lie the farmer plans a
season on"). That principle was never carried into the engines.

### The fix  (E-D1)

1. **Delete the seeded defaults.** Numeric inputs start empty.
2. **Replace every `.catch(() => {})`** with a real error/offline state. The read-cache
   machinery from the daily-logging work applies here too — a cached context is a fine answer;
   a silent one is not.
3. **Disable Calculate until the required inputs exist**, and say *which* are missing in the
   farmer's terms — "needs a recent sampling", not "abwG is null".
4. **The ConfidenceChip always renders.** With no context it reads "no data", never absent.

An engine that refuses is a product that can be trusted. An engine that guesses is not.

---

## E2 — Confidence must change the answer, not sit beside it  (E-D2)

### The defect

`computeConfidence` lives in `pond-context`. But `POST /feed-advisor/compute` has **no guard, no
`pondId`, and takes raw numbers** — the engine never sees the score. Only the client can join
them, and it joins them *visually*: a chip next to the hero figure.

Nothing anywhere hedges, widens, or refuses on low confidence. A `low` band still produces a
precise number in a large font.

**This is the seam left open by the daily-logging document.** A farmer logging quick-mode-only
or empty records sees a green streak *and* a confident ration while the inputs quietly rot. Two
subsystems computing different truths, and only the optimistic one is ever shown.

### The fix

Low and medium confidence return a **range**; high confidence returns the point value.

- The range comes from the confidence score, not from invented error bars — a documented,
  testable mapping from band to spread. It is a presentation of known input uncertainty, not a
  statistical claim, and the code comment must say so.
- The band's `missing[]` and `stale[]` arrays are already computed. Surface them: "widened
  because your last sampling is 16 days old" — with a link to the log that would narrow it.
- This answers the daily-logging question directly: a quick-mode-only log is legitimately
  "done" for the streak, and legitimately *not enough* for a point estimate. Both statements are
  true, and the farmer should see both.

Confidence must be passed to the engines to do this properly. Prefer adding an optional
`confidence` to the compute DTOs over recomputing it client-side — one definition, server-side,
matching how `logProgress.ts` is the single definition of "done".

---

## E3 — Honest rounding  (E-D3)

`biomass = N × ABW / 1000`, and every other term is a multiplier between 0.75 and 1.07. So the
output is dominated by two *estimates*:

- **`livePopulation`** = stocking − Σ observed mortality. Mortality is chronically
  under-reported in shrimp farming — dead animals sink or are eaten — so this is
  **systematically over-estimated**.
- **`abwG`** = the latest sampling. Two weeks stale means the shrimp have grown, so it is
  **under-estimated**.

Two errors of easily ±30–50%, pushing in opposite directions and cancelling unpredictably. The
engine then reports `recommendedKg` to **two decimal places**.

Round to whole kg, and to the nearest 5 kg above ~100 kg. Apply it to `perMeal[]` too — that is
what the farmer actually acts on at the pond side. Nobody weighs feed to 10 grams, and a
two-decimal figure reads as *measured* however it is captioned.

Feed is 50–60% of production cost. This costs nothing and removes a lie.

---

## E4 — Give the constants provenance and a knob

The engines are built on undocumented magic numbers:

```
HP_PER_KG   = 1/500    // "≈2 HP per tonne standing biomass"
kBiomass    = 0.25     // per kg/m²
kPlankton   = 0.5      // per plankton-load unit
kAeration   = 0.04     // per (HP/ha·hour)
molt factor = 0.75     // −25%
tray empty  = 1.07     // +7%
ADG decay   = 0.97/day
```

`FEATURES.md` admits these are "uncalibrated heuristics" — **but that caveat lives only in a
developer document.** Nothing in the code or the UI tells a farmer that a predicted pre-dawn DO
is a rule of thumb rather than a measurement.

Two changes, both cheap:

1. **Cite each constant at its definition** — the source, or "industry rule of thumb,
   uncalibrated" where there is none. A constant nobody can trace is a constant nobody can ever
   safely change.
2. **Say so in the UI once**, on the engines that are pure heuristics (aeration night-DO, lunar
   molt likelihood). The existing `FirstUseHint` component is exactly the right vehicle; it is
   already used to explain the ConfidenceChip.

`kBiomass`/`kPlankton`/`kAeration` are already tunable per request. Nothing exposes or ever
tunes them, and this document does not propose a UI for them — but the first real farm data that
contradicts a prediction should be able to move a number, and today there is no path from
observation to coefficient. Leave the knob; note the gap.

---

## E5 — Lunar: correct it, then connect it

The user reports this screen as basic and broken. Three separate problems, and the interesting
one is not the obvious one.

### E5.1 — Wrong dates (correctness)

**Ruled out first:** there are two independent moon-phase implementations — `features/moonPhase.ts`
(local, used by `LunarRow` and `MoonPhaseCard` on Home) and `lunar.service.ts` (backend, used by
`LunarScreen`). They are a genuine maintenance smell, and `lunarPhaseI18n.ts` already exists to
reconcile their naming. But measured, their epochs differ by **24 seconds** and their outputs
today by **0.49 minutes**. They are not the cause of wrong dates.

The two real causes:

1. **Mean synodic phase, not true phase.** Both use a fixed 29.53-day mean month from a 2000
   epoch. The true moon deviates from mean by up to **±14 hours** because its orbit is
   elliptical. That is enough to put a predicted new/full moon on the wrong calendar date a
   meaningful fraction of the time.
2. **UTC vs IST.** The next mean new moon computes to `2026-09-11 20:29 UTC` — which is
   **`2026-09-12 01:59 IST`**. It lands squarely in the window where the two disagree on the
   date. Anything formatting that instant without converting to IST shows the 11th when the
   farmer's calendar says the 12th.

For this audience the two compound: Amavasya and Purnima come from the **Panchang**, which uses
*true* phase at *local* time. Both error sources push away from it, and a farmer who sees the app
disagree with the Panchang stops trusting the whole feature — reasonably.

**Fix:** apply Meeus, *Astronomical Algorithms* ch. 49 (phases of the Moon) — the periodic
correction terms to mean new/full moon. **This resolves a dependency risk flagged earlier: it is
pure arithmetic, roughly twenty lines, no library and no native module, so it ships OTA.** Then
bucket every displayed date in IST using the existing date helpers, the same treatment `DATE-1`
gave the rest of the app and never gave this module.

Collapse the two implementations to one while in there. The local one must stay client-side
(Home computes the phase offline, deliberately, with no request), so the shared implementation
belongs in a pure module the backend imports too — or, failing that, one file with the corrected
algorithm and a test asserting both surfaces agree to the minute.

### E5.2 — Thin (presentation)

The backend computes a full playbook: `phaseRel`, `phaseLabel`, `headline`, an honesty `note`,
and prioritised `PlaybookStep[]` tagged by category (mineral, aeration, feed, handling,
biosecurity, water, monitoring) and priority (critical, important, routine) — each carrying the
`trigger` datum that produced it. The screen surfaces a fraction of this.

The engine is not basic. The screen is. Render the playbook, grouped by priority, with each
step's trigger visible — the same "show your reasoning" standard `reasons[]` already sets for
the feed advisor.

### E5.3 — Islanded (connection)

`MoltVulnerabilityInput` accepts DO, temperature, free NH₃, pH swing, mineral deficit, disease
flag, density ratio, tray residue and salinity. **`pond-context` already carries almost all of
these.** Yet the screen has an ABW field defaulting to 20 and expects hand-entry.

Wire it to pond context like every other engine (subject to E1 — refuse rather than seed), and
give it an entry point from the pond dashboard. A molt-risk screen that never surfaces when a
spring tide is approaching is a screen nobody opens.

---

# Deferred to area 8, with one live bug flagged  (E-D4)

Scheduled engine runs are **out of scope for this document** and belong whole to Alerts &
notifications. Two facts to carry forward, both correcting the current docs:

1. **`FEATURES.md` is wrong that "there is no cron / scheduler anywhere".** `ScheduleModule.forRoot()`
   is wired in `news.module.ts` and `@Cron(CronExpression.EVERY_HOUR)` runs news ingestion. The
   infrastructure exists and is proven; proactive alerting is not a greenfield build.
2. **The existing news cron is silently unreliable today, and that is a live bug independent of
   this work.** `render.yaml` runs the backend on Render's **free plan**, which spins down after
   ~15 minutes idle. An in-process cron on a sleeping instance does not fire. The file's own
   comment acknowledges the spin-down and suggests an external ping, which was never configured.

The product consequence, for area 8 to resolve: a predicted pre-dawn DO crash is computed **only
when the farmer opens the app** — at 6am, after the kill. An alert you have to ask for is not an
alert. Fixing it is a hosting decision (paid plan or Render Cron Job) before it is a code one.

---

# Ordering

| Order | Workstream | Why here |
|---|---|---|
| 1 | **E1** stop fabricating | Highest harm, no dependencies, and much of it is deletion. |
| 2 | **E3** honest rounding | Trivial, independent, removes a falsehood on the highest-cost number. |
| 3 | **E5.1** lunar correctness | Self-contained; the one item that is verifiably wrong rather than merely overconfident. |
| 4 | **E2** confidence → ranges | Wants E1 landed first, since it depends on context reliably being present or honestly absent. |
| 5 | **E5.2 / E5.3** lunar playbook + wiring | After E1, so the wiring inherits the refuse-don't-seed rule. |
| 6 | **E4** constant provenance | Documentation-shaped; do it alongside whichever engine is open. |

---

# Cross-cutting

- **i18n × 6.** E1's "what's missing" copy, E2's range and widening explanations, E5.2's playbook
  strings. Register in all six locales or the namespace silently resolves to nothing.
- **Two doc corrections**, both in `FEATURES.md`: the no-cron claim (§Deferred), and the
  "uncalibrated heuristics" caveat which should also live in the code (§E4). While there:
  `ARCHITECTURE.md` §3.3's stale "4xx → drop" is already logged in the daily-logging document.
- **Do not make the engines cleverer in this pass.** Every workstream above is about honesty:
  refusing, widening, rounding, citing, correcting. Better agronomy is a separate and much larger
  question that should follow real calibration data, not precede it.
- **Verification gate.** Both suites green and `tsc --noEmit` clean; branch from `development`,
  PR into `development`, no self-merge (`AGENTS.md`).

# Explicitly out of scope

- **Scheduled/proactive engine runs and push alerting** — area 8, per E-D4.
- **Recalibrating any coefficient.** E4 documents provenance and preserves the knob; it does not
  change a single number. Changing them without farm data would replace one uncalibrated guess
  with another.
- **A confidence UI for tuning coefficients.** Noted as a real gap (no path from observation to
  coefficient) and deliberately not designed here.
- **Replacing the disease-risk signature weights.** They are heuristic and declared as such;
  revisiting them belongs with the disease brainstorm (area 5), alongside the compliance and
  diagnosis questions, not here.
