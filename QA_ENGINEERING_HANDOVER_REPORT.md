# QA ENGINEERING HANDOVER REPORT
## Upcheck — Shrimp Aquaculture Management (Android)

> **Audience:** Development Team · **Purpose:** zero-ambiguity bug fixing and release triage
> **Prepared by:** Lead QA Engineering · **Date:** 2026-08-30
> **Scope, coverage limits and reproduction notes:** §6 of this document
> **Test suite:** `maestro_tests/` — 45 numbered flows + 2 seed flows (`maestro_tests/README.md`)
> **This is the single source of truth.** The earlier `E2E_OUTPUT_CORRECTNESS_REPORT.md` has been folded into this report and removed; its `D1`–`D11` IDs map onto `BUG-001`–`BUG-019` here.

================================================================================

# 1. EXECUTIVE SUMMARY & RELEASE GATEWAY VERDICT

## 1.1 Build Under Test

| Attribute | Value |
|---|---|
| **Target Package ID (appId)** | `com.upcheck.app` |
| **Repository commit (HEAD)** | `fbd05baf40555d1512b73b79c36193ff92fcdfcd` (`fbd05ba`) |
| | *"Merge pull request #112 from Upcheck-India/perf/local-jwt-verification"* — 2026-08-29 |
| **Installed APK** | `versionName 1.0.0`, `versionCode 3`, installed 2026-08-24 20:44 |
| **JS bundle actually executed** | **OTA-updated at test time** — see §1.4 |
| **Backend under test** | `https://api.upcheck.in/api` (live production API) |
| **Backend health at start** | `{"status":"ok"}` — database `up`, redis `up` |
| **Auth** | Live signed-in session (account owner) |
| **Account data at audit start** | 1 farm, **0 ponds, 0 stocked ponds** |
| **Account data after seeding** | 1 farm, 1 pond (`QA-AUDIT-POND`), 1 active cycle — **written to production and retained** by owner decision, see §6.3 |

## 1.2 Test Environment

| Attribute | Value |
|---|---|
| **Device** | OPPO CPH2467 (`OP5958L1`) — physical handset |
| **ADB serial** | `21e2533f` |
| **Android OS** | Android 15 (API level 35) |
| **Screen resolution** | 1080 × 2400 px |
| **Density** | 480 dpi physical / **408 dpi effective override** (1 dp = 2.55 px; 48 dp = 122.4 px) |
| **Orientation** | Portrait (locked — `android:screenOrientation="portrait"`) |
| **Automation harness** | Maestro 2.9.0 |
| **Invocation** | `maestro --device 21e2533f test ./maestro_tests/<flow_name>.yaml` |
| **Network** | 5G mobile data, live backend (no mocks, no stubs) |

## 1.3 Release Gateway Verdict

> # ⚠️ CONDITIONAL GO
>
> **Ship permitted only after BUG-001, BUG-002 and BUG-019 are resolved and
> re-verified.**

**Rationale.** There are **zero P0 blockers**. No crash, ANR, hang, data loss or
data corruption was observed across 45 executed flows; `logcat -b crash` contains
**no entry attributable to `com.upcheck.app`** for the entire session. **The calculators' arithmetic is correct** — across 22
distinct valid-input cases spanning the five calculators, every rendered figure
matched an independently derived expectation to the last displayed digit.

> **This verdict covers the five calculators and the prefill path. It does not
> cover the rest of the app.** ~33 of 105 routes were opened; of those, only the
> calculators had their output verified. The money surface, the log-entry forms
> and every history total compute figures that were never checked — see §6.1 and
> §6.2. A GO decision on this report is a decision about the calculators.

The gate is held by **three P1 defects, each of which presents a fabricated or
self-contradictory figure as measured data**:

- **BUG-001** — Free Ammonia can print the *identical* value `0.1000` under
  **SAFE** in one case and **WARNING** in another, and the SAFE variant displays
  the text *"within safe limits (< 0.1 ppm)"* directly beneath the number `0.1000`.
- **BUG-002** — The salinity input is labelled *"For reference only"* while it
  materially changes the computed result (0.1453 → 0.1593 ppm, **+9.6 %**), and
  its non-zero default biases a freshwater pond's reading in the **unsafe**
  direction.
- **BUG-019** — A pond with no sampling and no mortality logged reports
  **survival 100 %**, both as a Daily Feed prefill labelled *"Filled from the
  pond you picked"* and on the pond dashboard directly beneath copy stating that
  survival *cannot* be computed without a sampling. Every biomass and feed figure
  derived from it is over-estimated.

All three are small, well-isolated fixes (one service method; one i18n string ×
6 locales; one guard in `applyContext`) with proposed patches supplied in §3.
None requires an architectural change or a native rebuild. Everything else is
P2/P3 and can ship on the normal cycle.

## 1.4 Mandatory Release Note — OTA / binary divergence

The installed APK predated `HEAD` by two days and initially rendered a **different
UI** (tabs `Dashboard / Farms / Reports / More`; a "Pond & Stock Data" Daily Feed
form). `expo-updates` is configured `EXPO_UPDATES_CHECK_ON_LAUNCH=ALWAYS`
(`AndroidManifest.xml`), so the **first Maestro `launchApp` swapped the JS bundle**
mid-session; the app then rendered the current design (`Today / Farm / Team /
Money / News / Settings`).

**All 45 flows in this report ran against the post-OTA bundle.** This was verified
rather than assumed: four of the five calculator screens are byte-identical between
the build baseline `704d816` and `HEAD` (line-ending-insensitive diff = 0 differing
lines), and the two that changed now render their `HEAD` copy on device.

> **Developer impact:** every `file:line` reference in §2 and §3 points at `HEAD`
> and matches the code the device actually executed. QA sign-off applies to the
> **JS bundle**, not to APK `versionCode 3` in isolation. A native-layer change
> would require a fresh binary and a re-run.

## 1.5 Executive Defect Distribution Matrix

### Execution

| Metric | Count |
|---|---|
| **Total test cases executed** | **45** |
| **Passed** | **45** |
| **Failed** | **0** |
| **Blocked / Not Run** | **0** |
| Pass rate | **100 %** |

> **Read this carefully before concluding "no bugs".** 100 % pass does **not** mean
> zero defects. **Eleven of the 45 flows are evidence flows**: they assert the
> *defective behaviour that exists today* so that the defect is pinned, reproducible
> and regression-guarded. Those flows are designed to **start failing when the bug
> is fixed**, at which point the assertion must be inverted. Defect count is
> therefore tracked independently of pass rate — see the severity table below and
> the `Ticket Ref` column in §2.

### Defects by severity

| Severity | Definition applied | Count | Ticket IDs |
|---|---|---|---|
| **P0 — Blocker** | Crash, ANR, data loss/corruption, unusable core flow | **0** | — |
| **P1 — Critical** | Wrong or contradictory information presented as authoritative on a safety-relevant surface | **3** | BUG-001, BUG-002, BUG-019 |
| **P2 — Major** | Materially misleading output, dead input, or unvalidated API surface | **5** | BUG-003, BUG-004, BUG-005, BUG-006, BUG-018 |
| **P3 — Minor** | Edge-case correctness, accessibility, i18n, dead code, test debt | **11** | BUG-007 … BUG-017 |
| | **TOTAL** | **19** | |

### Defects by discovery method

| Method | Count | Tickets |
|---|---|---|
| On-device execution (evidence flow) | 11 | BUG-001, 002, 003, 005, 009, 010, 011, 013, 017, 018, 019 |
| Static analysis + local re-execution of the exact service function | 5 | BUG-004, 007, 008, 012, 016 |
| Instrumented measurement (uiautomator bounds / WCAG computation) | 3 | BUG-006, 014, 015 |

### Defects by module

| Module | P1 | P2 | P3 | Total |
|---|---|---|---|---|
| Free Ammonia (NH₃) | 2 | 0 | 1 | 3 |
| Pond prefill (`applyContext` / PondDashboard) | 1 | 1 | 0 | 2 |
| Product Dosage | 0 | 1 | 0 | 1 |
| Daily Feed Amount | 0 | 1 | 2 | 3 |
| Cultivation Performance | 0 | 0 | 2 | 2 |
| Growth & Harvest / shared API | 0 | 1 | 1 | 2 |
| Design system (theme, StatRow, ScreenHeader) | 0 | 1 | 2 | 3 |
| Input parsing (all five calculators) | 0 | 0 | 1 | 1 |
| i18n | 0 | 0 | 1 | 1 |
| Test infrastructure | 0 | 0 | 1 | 1 |
| | **3** | **5** | **11** | **19** |

### Cross-cutting pillar verdicts (detail in §4)

| Pillar | Verdict | Tickets |
|---|---|---|
| Arithmetic & Calculation Correctness | **PASS** — no arithmetic defect | — (2 latent risks documented) |
| Input Sanitization & Boundary Resilience | **FAIL** | BUG-009, BUG-010, BUG-011, BUG-017 |
| UI/UX & Accessibility | **FAIL** | BUG-006, BUG-014, BUG-015 (keyboard & layout: PASS) |
| Idempotency & Race Conditions | **PASS** | — (1 residual risk documented) |
| Localization (i18n) | **FAIL** | BUG-013 (key parity, rendering and cross-locale arithmetic: PASS) |
| Data Prefill & Derived-State Integrity | **FAIL** | BUG-018, BUG-019 |

================================================================================
# 2. MASTER TEST EXECUTION MATRIX

**Traceability key.** `Test ID` maps 1:1 to a runnable artifact:
`TC-nn` ⇄ `maestro_tests/nn_*.yaml`. Every row is reproducible with
`maestro --device 21e2533f test ./maestro_tests/<flow_name>.yaml`.

`Severity` is the severity of the **defect the row exposes**, or `—` when the row
is a clean pass with no defect attached. Rows whose `Result` is `PASS (evidence)`
assert defective behaviour on purpose: they pass today and must be inverted when
the linked ticket is fixed.

## 2.1 Navigation & Smoke

| Test ID | Feature / Submodule | Test Scenario & Intent | Input Payload / Values | Expected UI / Data State | Actual Rendered Output | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|---|
| TC-00 | Navigation → Calculator Hub | Hub reachable from Settings; all five tools enumerated | — (navigation only) | Hub titled "Tools & Calculators" listing 5 calculators | Hub rendered; all 5 present | **PASS** | — | — |

## 2.2 Daily Feed Amount
`biomass = (count × SR/100) × MBW / 1000` (client, `DailyFeedCalculatorScreen.tsx:116`) → `dailyFeed = round₂(biomass × FR/100)` (server, `shrimp-calculations.service.ts:68`)

| Test ID | Feature / Submodule | Test Scenario & Intent | Input Payload / Values | Expected UI / Data State | Actual Rendered Output | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|---|
| TC-01 | Daily Feed → calculation | Standard valid path, exact arithmetic | MBW `20`, SR `80`, Count `100000`, FR `3` | Feed `48.0` kg · Biomass `1,600` · Per-meal `12.0` · Meals `4` | Feed `48.0` kg · Biomass `1,600` · Per-meal `12.0` | **PASS** | — | — |
| TC-02 | Daily Feed → rounding | Decimal inputs; server 2-dp rounding then 1-dp display | MBW `12.5`, SR `85`, Count `500000`, FR `2.5` | 5312.5 kg biomass → `5,313`; 132.8125 → round₂ `132.81` → display `132.8`; per-meal `33.2` | `5,313` · `132.8` · `33.2` | **PASS** | — | — |
| TC-03 | Daily Feed → validation | All-empty submit | *(no input)* | Alert "Validation Error" / "MBW must be a positive number"; no result block | Exactly as expected | **PASS** | — | — |
| TC-04 | Daily Feed → boundary | Survival rate above 100 % | MBW `20`, SR `150`, Count `100000`, FR `3` | Alert "Survival rate must be between 0 and 100"; no result | Exactly as expected | **PASS** | — | — |
| TC-05 | Daily Feed → validation | Negative magnitude rejected | MBW `-5`, others valid | Alert "MBW must be a positive number"; no result | Exactly as expected | **PASS** | — | — |
| TC-06 | Daily Feed → extreme values | Upper realistic bound, en-IN grouping | MBW `50`, SR `100`, Count `2000000`, FR `10` | Feed `10000.0` kg · per-meal `2500.0` | `10000.0` · `2500.0` | **PASS** | — | — |
| TC-07 | Daily Feed → sanitization | Special characters in a numeric field | MBW `abc!@#`, others valid | `parseFloat`→NaN → "MBW must be a positive number" | Exactly as expected | **PASS** | — | — |
| TC-25 | Daily Feed → dead input | Prove Pond Area cannot affect any output | TC-01 payload **+ Pond Area `999999`** | Output should either change or the field should not exist | Output **byte-identical** to TC-01 (`48.0`/`1,600`/`12.0`) | **PASS (evidence)** | **P2** | **BUG-005** |
| TC-29 | Daily Feed → bound parity | Client lacks the server's `@Max(100)` on feeding rate | MBW `20`, SR `80`, Count `100000`, FR `150` | Field-named client "Validation Error" (as every other out-of-range input gives) | **No** client validation; request dispatched; no result rendered | **PASS (evidence)** | **P3** | **BUG-010** |
| TC-30 | Daily Feed → sanitization | Whitespace-padded numeric input | MBW `" 20 "`, others valid | `parseFloat` tolerates padding → identical to TC-01 | Feed `48.0` · Biomass `1,600` | **PASS** | — | — |
| TC-31 | Daily Feed → buffer bound | 10²⁰ stocking count; overflow / sanity ceiling | MBW `20`, SR `80`, Count `99999999999999999999`, FR `3` | An upper-bound guard, or at minimum a legible figure | **No guard.** Renders `48000000000000000.0 kg` (4.8×10¹⁶ kg/day); per-meal `12000000000000000.0`; Biomass stat clipped to `16,00,00,00…` | **PASS (evidence)** | **P3** | **BUG-011** |
| TC-32 | Daily Feed → injection | SQL-shaped payload in a numeric field | MBW `'; DROP TABLE ponds;--` | Rejected client-side; never dispatched | Alert "MBW must be a positive number"; no network call | **PASS** | — | — |
| TC-33 | Daily Feed → idempotency | Rapid double submit (2 taps, 50 ms apart) | TC-01 payload, `repeat: 2, delay: 50` | Second tap swallowed by `disabled={isLoading}`; one correct result; no error | One result `48.0`; no "Validation Error"; no error dialog | **PASS** | — | — |
| TC-36 | Daily Feed → sanitization | Trailing-garbage numeric input; a field declared numeric must reject a non-number | MBW `20abc`, others valid | Same "MBW must be a positive number" alert that `abc!@#` produces in TC-07 | **No alert.** `parseFloat` truncates to `20`; renders `48.0` kg / `1,600` — identical to a clean `20`. Hierarchy dump confirms the `EditText` holds `text="20abc"`, so the keyboard is not filtering it | **PASS (evidence)** | **P3** | **BUG-017** |

## 2.3 Product Dosage
`amountKg = round₂(area × depth × ppm / 1000)` (`shrimp-calculations.service.ts:255`)

| Test ID | Feature / Submodule | Test Scenario & Intent | Input Payload / Values | Expected UI / Data State | Actual Rendered Output | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|---|
| TC-08 | Product Dosage → calculation | Standard valid path incl. live volume preview | Area `5000` m², Depth `1.2` m, Target `2` ppm | Volume `6000 m³`; Required Amount `12.00` kg | `6000 m³` · `12.00` | **PASS** | — | — |
| TC-09 | Product Dosage → concentration | Headline vs concentration-corrected dose | TC-08 **+ Concentration `50` %** | The dose the farmer must apply (`24.000` kg) should be the prominent figure | Headline = `12.00` kg (100 % basis); `24.000 kg` demoted to small secondary line under "With 50% concentration:" | **PASS (evidence)** | **P2** | **BUG-003** |
| TC-10 | Product Dosage → boundary | Concentration above 100 % | Area `5000`, Depth `1.2`, ppm `2`, Conc `150` | Alert "Concentration must be between 0 and 100"; no result | Exactly as expected | **PASS** | — | — |
| TC-11 | Product Dosage → validation | All-empty submit | *(no input)* | Alert "Pond area must be a positive number"; no result | Exactly as expected | **PASS** | — | — |

## 2.4 Free Ammonia (NH₃)
`NH₃ = TAN / (1 + 10^(pKa − pH))`; pKa per Bower & Bidwell 1978 with salinity ionic-strength term (`shrimp-calculations.service.ts:222-249`)

| Test ID | Feature / Submodule | Test Scenario & Intent | Input Payload / Values | Expected UI / Data State | Actual Rendered Output | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|---|
| TC-12 | Free Ammonia → WARNING band | Mid-band classification, 4-dp precision | TAN `1.5`, pH `8.2`, `29 °C`, `15` ppt | `0.1453` ppm; badge `WARNING (Server)` | `0.1453` · `WARNING (Server)` | **PASS** | — | — |
| TC-13 | Free Ammonia → CRITICAL band | Upper band | TAN `5`, pH `9`, `32 °C`, `15` ppt | `2.2693` ppm; badge `CRITICAL (Server)` | `2.2693` · `CRITICAL (Server)` | **PASS** | — | — |
| TC-14 | Free Ammonia → SAFE band | Lower band | TAN `0.5`, pH `7`, `25 °C`, `15` ppt | `0.0025` ppm; badge `SAFE (Server)` | `0.0025` · `SAFE (Server)` | **PASS** | — | — |
| TC-15 | Free Ammonia → boundary | pH above chemical maximum | TAN `1.5`, pH `15`, `29 °C` | Alert "pH must be between 0 and 14" | Exactly as expected | **PASS** | — | — |
| TC-16 | Free Ammonia → validation | All-empty submit | *(no input)* | Alert "TAN must be a positive number" | Exactly as expected | **PASS** | — | — |
| TC-24 | Free Ammonia → salinity sensitivity | Prove salinity is **not** "for reference only" | TAN `1.5`, pH `8.2`, `29 °C`, salinity cleared to **`0`** | If the hint were true, result would be unchanged at `0.1453` | `0.1593` (**+9.6 %**); `0.1453` absent | **PASS (evidence)** | **P1** | **BUG-002** |
| TC-26 | Free Ammonia → band boundary (safe side) | Same printed value, band A | TAN **`1.032`**, pH `8.2`, `29 °C`, `15` ppt | raw 0.09998399 → prints `0.1000` | `0.1000` + `SAFE (Server)` + *"within safe limits (< 0.1 ppm)"* | **PASS (evidence)** | **P1** | **BUG-001** |
| TC-27 | Free Ammonia → band boundary (warning side) | Same printed value, band B | TAN **`1.0323`**, pH `8.2`, `29 °C`, `15` ppt | raw 0.10001306 → prints `0.1000` | `0.1000` + `WARNING (Server)` | **PASS (evidence)** | **P1** | **BUG-001** |

## 2.5 Cultivation Performance

| Test ID | Feature / Submodule | Test Scenario & Intent | Input Payload / Values | Expected UI / Data State | Actual Rendered Output | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|---|
| TC-17 | Cultivation Perf → calculation | Four metrics in one submit | Seed `100000`, Harvest `1500` kg, Feed `2250` kg, `120` d, MBW `20` g, SR `80` %, Area `5000` m² | FCR `1.50` · ADG `0.167` · SR `80.0%` · Productivity `0.30` | All four exact | **PASS** | — | — |
| TC-18 | Cultivation Perf → boundary | Final SR above 100 % | as TC-17 but SR `150` | Alert "Final SR must be between 0 and 100" | Exactly as expected | **PASS** | — | — |
| TC-28 | Cultivation Perf → NaN guard | Non-numeric optional Pond Area | as TC-17 but Area `abc` | Either a validation alert **or** a Productivity metric | **Neither.** No alert; FCR/ADG/SR render; Productivity card silently absent | **PASS (evidence)** | **P3** | **BUG-009** |

## 2.6 Growth & Harvest

| Test ID | Feature / Submodule | Test Scenario & Intent | Input Payload / Values | Expected UI / Data State | Actual Rendered Output | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|---|
| TC-19 | Growth → Expected Harvest | Count and weight projection | Stock `100000`, SR `80` %, Target `20` g | `80,000` shrimp · `1600.00` kg | `80,000` · `1600.00` | **PASS** | — | — |
| TC-20 | Growth → Growth Projection | Headline plus weekly series | Current `10` g, ADG `0.25` g/d, `30` d | Projected `17.50` g; week 1 `11.75` | `17.50` · `11.75` | **PASS** | — | — |
| TC-21 | Growth → Biomass | Standing biomass | Stock `100000`, Avg `20` g | `2000.00` kg | `2000.00` | **PASS** | — | — |
| TC-22 | Growth → Recommended Rate | Species step-table lookup | Avg weight `20` g | `2.5` % (the 20–25 g bucket, `service.ts:162`) | `2.5` | **PASS** | — | — |
| TC-23 | Growth → boundary | Survival rate above 100 % | Stock `100000`, SR `150`, Target `20` | Alert "Survival rate must be between 0 and 100"; no Expected Count | Exactly as expected | **PASS** | — | — |

## 2.7 Localization (i18n)

| Test ID | Feature / Submodule | Test Scenario & Intent | Input Payload / Values | Expected UI / Data State | Actual Rendered Output | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|---|
| TC-34 | i18n → Hindi calculator surface | (a) translated keys render; (b) hardcoded placeholders do not translate | Switch language to `हिन्दी`, open Cultivation Performance | (a) Hindi titles/labels; (b) placeholders should also localise | (a) `टूल्स और कैलकुलेटर`, `उत्पादन प्रदर्शन`, `कुल बीज (संख्या)` — correct. (b) `e.g. 500000` and `e.g. 120` **remain English** | **PASS (evidence)** | **P3** | **BUG-013** |
| TC-35 | i18n → housekeeping | Restore English (leave device as found) | Switch language back to `English` | Settings renders in English | Restored | **PASS** | — | — |

## 2.8 Cross-locale arithmetic (Hindi UI)

Closes the "single locale" limitation on the arithmetic assertions: the three
anchor payloads re-run with the UI switched to Hindi. `_nav_to_hub_hi.yaml` is the
Hindi navigation subflow; `35_i18n_restore_english.yaml` runs after each to leave
the device as found.

| Test ID | Feature / Submodule | Test Scenario & Intent | Input Payload / Values | Expected UI / Data State | Actual Rendered Output | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|---|
| TC-37 | Daily Feed → i18n × arithmetic | TC-01's payload under a Hindi UI | MBW `20`, SR `80`, Count `100000`, FR `3` | Figures identical to TC-01; grouping stays `1,600` because `toLocaleString('en-IN')` is hardcoded, not locale-following | `आवश्यक दैनिक आहार` · `48.0` · `1,600` · `12.0` — identical to TC-01 | **PASS** | — | — |
| TC-38 | Daily Feed → i18n × rounding | TC-02's rounding boundary under Hindi | MBW `12.5`, SR `85`, Count `500000`, FR `2.5` | `5,313` · `132.8` · `33.2`, identical to TC-02 | Exactly as expected | **PASS** | — | — |
| TC-39 | Cultivation Perf → i18n × arithmetic | TC-17's four metrics under Hindi | TC-17 payload | FCR `1.50` · ADG `0.167` · SR `80.0`; decimal separator stays `.` | Exactly as expected *(passed on retry; first attempt died on a nav flake, see §6.4)* | **PASS** | — | — |

**Conclusion:** the arithmetic is **not** locale-dependent. All three anchors
reproduce to the last digit under Hindi, and the en-IN digit grouping is stable
because it is hardcoded rather than derived from the UI language.

## 2.9 Pond prefill path (previously untestable)

Unreachable for the whole first phase of this audit — the account owned 0 stocked
ponds. `_seed_01_create_pond.yaml` and `_seed_02_start_cycle.yaml` create the
object graph (**production writes**, §6.3); these two flows then exercise it.

| Test ID | Feature / Submodule | Test Scenario & Intent | Input Payload / Values | Expected UI / Data State | Actual Rendered Output | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|---|
| TC-40 | Calculator Hub → `PondPicker` | A stocked pond must be offered by the `stockedOnly` filter | select nothing; just open the hub | "Pick a pond first" listing `QA-AUDIT-POND`; the "No stocked ponds to pull numbers from." empty state gone | Exactly as expected; all five calculators still listed | **PASS** | — | — |
| TC-41 | Daily Feed → `applyContext` | What the pond actually prefills, and what the banner claims | pick `QA-AUDIT-POND` (500 000 PL, 5000 m², day 1, **no sampling**), type nothing | Fields the pond can supply are filled; the banner reflects what was really filled | Count `500000` ✓ · Area `5000` ✓ · **SR `100` (fabricated)** · **MBW empty** (renders its `18.4` placeholder) — yet the banner still reads *"Filled from the pond you picked · day 1"* | **PASS (evidence)** | **P1 / P2** | **BUG-019, BUG-018** |

## 2.10 Route smoke sweep

Closes part of the "~85 routes were read, not run" limitation. Smoke contract:
open the screen, assert a string **only that screen** renders, assert no crash or
error state, return. Business output is not asserted — the five calculators are
the only screens with falsifiable arithmetic and TC-01…TC-41 cover those.

| Test ID | Feature / Submodule | Test Scenario & Intent | Input Payload / Values | Expected UI / Data State | Actual Rendered Output | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|---|
| TC-42 | Settings → TOOLS / FARM / ABOUT | 9 routes open and render | navigation only | each screen renders its own content; no error state | Simulations `PLANNING` · Disease Encyclopedia `Search diseases…` · Reference Data `Hatcheries` · All Workers `Team: 1` · Inventory `No Inventory Items` · Feed Products `No Feed Products` · Shop `No Products` · Sync `Everything is synced` · Help `How can we help?` | **PASS** | — | — |
| TC-43 | Bottom tabs | all six tabs mount with a stocked pond present | navigation only | each tab renders its own sections | Today `MY TASKS`/`YOUR FARMS` · Farm `Your farms` · Team `TEAM TASKS TODAY` · Money `RECENT ENTRIES` · News `Market & prices` · Settings `LANGUAGE` | **PASS** | — | — |
| TC-44 | Pond dashboard → log & history surface | 7 pond-scoped routes, dark before seeding | open `QA-AUDIT-POND` | each log screen pushes off the dashboard; `View History` toggles mode rather than navigating | Water Quality, Feed, Daily Routine, Sampling, Measurements, Advisor all push; `View History` correctly stays (mode toggle, `PondDashboardScreen.tsx:456`) and re-points the tiles at the history routes | **PASS** | — | — |

## 2.11 Instrumented measurements (not Maestro flows)

Measured directly from `uiautomator` bounds and theme tokens; recorded here for traceability.

| Ref | Check | Method | Expected | Actual | Result | Severity | Ticket Ref |
|---|---|---|---|---|---|---|---|
| M-01 | Touch target — header Back | uiautomator bounds + `hitSlop` | ≥ 48 × 48 dp | 24.3 × 29.0 dp visual; **44.3 × 49.0 dp effective** (HIT_SLOP 10 dp) | **FAIL (width)** | **P3** | **BUG-015** |
| M-02 | Touch target — inputs / Calculate | uiautomator bounds | ≥ 48 × 48 dp | inputs 46.3 dp h; Calculate 47.8 dp h | **MARGINAL** | **P3** | **BUG-015** |
| M-03 | Contrast — input placeholder | WCAG 2.1 relative luminance | ≥ 4.5:1 | `#A3B5BF` on `#EEF2F5` = **1.88:1** | **FAIL** | **P2** | **BUG-006** |
| M-04 | Contrast — tertiary text / hints | WCAG 2.1 relative luminance | ≥ 4.5:1 | `#7A909F` on `#FFFFFF` = **3.32:1** | **FAIL** | **P3** | **BUG-014** |
| M-05 | Contrast — body / headings | WCAG 2.1 relative luminance | ≥ 4.5:1 | secondary 8.20:1, primary 16.06:1 | **PASS** | — | — |
| M-06 | Keyboard obstruction | uiautomator + screenshot, IME shown on the topmost field | Primary CTA reachable without dismissing the IME | Calculate at y 1188–1310 px; IME top edge ≈ y 1560 px — a 250 px (≈ 98 dp) clear gap | **PASS** | — | — |
| M-07 | i18n translation-key parity | Key-set diff, 27 files × 6 locales | 0 missing keys | **0 missing, 0 extra** | **PASS** | — | — |
| M-08 | Hardcoded string scan | AST-ish scan of 5 calculator screens | 0 untranslated user-visible strings | **39** hardcoded | **FAIL** | **P3** | **BUG-013** |
| M-09 | Crash / ANR surveillance | `logcat -b crash` across whole session | empty | empty (only a benign OEM `OplusScrollToTopManager` warning) | **PASS** | — | — |

================================================================================
# 3. DETAILED DEFECT SPECIFICATIONS (DEVELOPER HANDOVER TICKETS)

**How to read this section.** One ticket per non-compliant behaviour, ordered by
severity then by module. Every `Source Code Location` is a path relative to
`Upcheckapp/` at commit `fbd05ba`, and every path/line was confirmed to be the
code the device actually executed (§1.4). Patches are given as applicable diffs;
where a fix spans six locale files the diff shows `en` and the sibling files are
enumerated.

**Severity rubric used throughout**

| | Definition |
|---|---|
| **P0** | Crash, ANR, data loss or corruption, core flow unusable. **Blocks release unconditionally.** |
| **P1** | Wrong or self-contradictory information presented as authoritative on a safety-relevant surface. **Blocks release.** |
| **P2** | Materially misleading output, dead input, or an unvalidated public API surface. Fix in the current sprint. |
| **P3** | Edge-case correctness, accessibility, i18n, dead code, test debt. Scheduled work. |

---

## P1 — CRITICAL (Release Blocking)

> BUG-001 and BUG-002 follow immediately; **BUG-019 is also P1** and is filed
> with BUG-018 under "Pond prefill" below, because the two share a code path and
> must be fixed together.

### [BUG-001] [Severity: P1] Free Ammonia prints an identical value under two opposite toxicity verdicts, and the SAFE copy contradicts the number shown above it

- **Affected Screen / Module:** `FreeAmmoniaScreen` (React Navigation route `FreeAmmonia`; Calculator Hub → "Free Ammonia (NH₃)"). Classification owned by `ShrimpCalculationsService.calculateFreeAmmonia`.
- **Source Code Location:**
  - `backend/src/shrimp-calculations/shrimp-calculations.service.ts:239-241` — `calculateFreeAmmonia()`, banding on the **raw** `nh3`
  - `backend/src/shrimp-calculations/shrimp-calculations.service.ts:244` — `Number(nh3.toFixed(4))`, rounding applied **after** banding
  - `frontend/src/screens/calculators/FreeAmmoniaScreen.tsx:189` — renders `result.unionizedAmmonia.toFixed(4)`
  - `frontend/src/screens/calculators/FreeAmmoniaScreen.tsx:14-18` — `getToxicityLevel()`, client fallback using `>= 0.1`
  - `frontend/src/screens/calculators/FreeAmmoniaScreen.tsx:203,207` — on-screen legend `< 0.1 ppm` / `0.1 – 0.5 ppm`
  - `frontend/src/i18n/locales/en/calculators.ts:136` — `safeMessage`
- **Preconditions / App State:** Signed-in session; backend reachable; Calculator Hub → Free Ammonia (NH₃); language English; Salinity left at its `15` default.
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Free Ammonia (NH₃)**.
  2. Input `1.032` into **Total Ammonia Nitrogen (TAN)**.
  3. Input `8.2` into **pH** and `29` into **Temperature (°C)**; leave **Salinity** at `15`.
  4. Tap **Calculate**. Record the printed value and the badge.
  5. Change **TAN** to `1.0323`, leaving every other field untouched.
  6. Tap **Calculate** again. Record the printed value and the badge.
- **Observed Behavior:**

  | Step | TAN | Raw NH₃ (server, pre-round) | Printed | Badge | Message shown |
  |---|---|---|---|---|---|
  | 4 | `1.032` | `0.09998399` | **`0.1000`** | **`SAFE (Server)`** | *"NH₃ levels are within safe limits (**< 0.1 ppm**). No action required."* |
  | 6 | `1.0323` | `0.10001306` | **`0.1000`** | **`WARNING (Server)`** | *"Elevated NH₃ — take corrective action."* |

  The two runs render **the same four-decimal figure `0.1000`** under opposite verdicts. The SAFE run additionally prints the literal claim `< 0.1 ppm` directly beneath the number `0.1000`, which the number contradicts on its face. Nothing on screen distinguishes the two states other than the badge.
- **Expected Behavior:** The verdict must be a function of the value the user is shown. Two runs that print `0.1000` must classify identically, and the SAFE message must not assert a bound the displayed figure violates. Concretely: at 4-decimal display precision, `0.1000` must map to exactly one band across server, client fallback and legend.
- **Root-Cause Code Analysis:** The service classifies before it rounds. `service.ts:239-241` evaluates `nh3 > 0.5` / `nh3 > 0.1` against the full-precision double, then `:244` returns `Number(nh3.toFixed(4))` — so all classification information below the 4th decimal is discarded *after* it has already decided the band. Any pair of inputs straddling `0.1` within `5e-5` reproduces this. Three separate definitions of the same boundary then disagree with each other: the server uses `> 0.1` (0.1 is SAFE), the client fallback at `FreeAmmoniaScreen.tsx:16` uses `>= 0.1` (0.1 is WARNING), and the legend at `:203/:207` prints `< 0.1` / `0.1 – 0.5` (0.1 is WARNING). Whichever path renders, at least one of the three is wrong.
- **Developer Remediation / Fix Recommendation:** Round once, then classify the rounded value, and align all three definitions on "0.1 is the start of WARNING" — the rule the legend already shows the farmer.

```diff
--- a/backend/src/shrimp-calculations/shrimp-calculations.service.ts
+++ b/backend/src/shrimp-calculations/shrimp-calculations.service.ts
@@ calculateFreeAmmonia
     const nh3 = tan * (1 / (1 + Math.pow(10, pKa - ph)));

-    let toxicityLevel = 'safe';
-    if (nh3 > 0.5)
-      toxicityLevel = 'critical'; // Changed from 'high' to be more standard, but PRD says high. Let's follow PRD logic roughly or better standards. PRD: >0.5 high, >0.1 medium.
-    else if (nh3 > 0.1) toxicityLevel = 'warning';
-
-    return {
-      unionizedAmmonia: Number(nh3.toFixed(4)),
-      toxicityLevel,
-    };
+    // Classify the value we are going to SHOW, not the one we computed.
+    // Banding the raw double and rounding afterwards lets two inputs print the
+    // identical figure under opposite verdicts (QA BUG-001).
+    const reported = Number(nh3.toFixed(4));
+
+    // Inclusive-low boundaries, matching the on-screen legend
+    // ("< 0.1" safe / "0.1 - 0.5" warning / "> 0.5" critical).
+    let toxicityLevel = 'safe';
+    if (reported > 0.5) toxicityLevel = 'critical';
+    else if (reported >= 0.1) toxicityLevel = 'warning';
+
+    return {
+      unionizedAmmonia: reported,
+      toxicityLevel,
+    };
   }
```

```diff
--- a/frontend/src/i18n/locales/en/calculators.ts
+++ b/frontend/src/i18n/locales/en/calculators.ts
@@
-    safeMessage: 'NH₃ levels are within safe limits (< 0.1 ppm). No action required.',
+    safeMessage: 'NH₃ levels are within safe limits (below 0.1 ppm). No action required.',
```

`FreeAmmoniaScreen.tsx:14-18` already uses `>= 0.1` and needs **no change** once the server adopts the same rule — the two paths then agree by construction. Apply the `safeMessage` rewording to all six locales (`en`, `hi`, `bn`, `ta`, `te`, `or` — each at `calculators.ts:136`).

- **Regression guard:** `maestro_tests/26_ammonia_boundary_safe_side.yaml` and `27_ammonia_boundary_warning_side.yaml` currently assert the defect and pass. After the fix TC-26 will fail (`1.032` bands WARNING, not SAFE) — invert its assertion to `WARNING (Server)` and keep it. Add the unit test from BUG-016.

---

### [BUG-002] [Severity: P1] Salinity input is labelled "For reference only" but changes the computed ammonia result by ~10 %

- **Affected Screen / Module:** `FreeAmmoniaScreen` — Salinity (ppt) field
- **Source Code Location:**
  - `frontend/src/i18n/locales/en/calculators.ts:130` — `hintSalinity: 'For reference only'`
  - `frontend/src/screens/calculators/FreeAmmoniaScreen.tsx:159-166` — the `Input`, rendering that hint at `:165`
  - `frontend/src/screens/calculators/FreeAmmoniaScreen.tsx:60` — `useState('15')`, a non-zero default
  - `frontend/src/screens/calculators/FreeAmmoniaScreen.tsx:89` — the value is sent to the API
  - `backend/src/shrimp-calculations/shrimp-calculations.service.ts:232-236` — salinity drives the Bower & Bidwell ionic-strength term of `pKa`
- **Preconditions / App State:** Signed-in session; Free Ammonia screen freshly opened, so Salinity holds its `15` default.
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Free Ammonia (NH₃)**.
  2. Input `1.5` into **TAN**, `8.2` into **pH**, `29` into **Temperature (°C)**.
  3. Leave **Salinity** at its `15` default. Tap **Calculate**. Record the result.
  4. Clear **Salinity** and input `0` — the correct value for a freshwater pond.
  5. Tap **Calculate**. Record the result.
- **Observed Behavior:** Step 3 renders `0.1453` ppm (`WARNING`). Step 5 renders **`0.1593` ppm** — a **+9.6 %** change — produced by editing a field the UI describes as *"For reference only"*. That hint is the field's only guidance.
- **Expected Behavior:** Either the hint tells the truth — salinity is an input to the model and must reflect the pond — or the field is genuinely inert. Since the model needs it, the hint must say it affects the result, and the app must not silently default a freshwater pond to 15 ppt.
- **Root-Cause Code Analysis:** Documentation/behaviour divergence, not a math error. `service.ts:233` computes `I = 19.924·S / (1000 − 1.005·S)` and `:234-236` folds `(0.1552 − 0.0003142·T)·I` into `pKa`; higher salinity raises `pKa`, lowering the un-ionised fraction. The frontend faithfully transmits the field (`:89`) while describing it as decorative. Compounding this, the default is `'15'` (`:60`) rather than empty or `0`, so a freshwater farmer who believes the hint and leaves the field alone submits a value that is both wrong and consequential — and it biases the toxicity reading **low**, i.e. in the unsafe direction. The same misleading string is duplicated across all six locales.
- **Developer Remediation / Fix Recommendation:** Tell the truth in the hint and stop defaulting to brackish. `0` is the honest default, and is exactly the freshwater Emerson form the service documents at `service.ts:218-219`.

```diff
--- a/frontend/src/i18n/locales/en/calculators.ts
+++ b/frontend/src/i18n/locales/en/calculators.ts
@@
-    hintSalinity: 'For reference only',
+    hintSalinity: 'Affects the result — enter 0 for freshwater ponds',
```

```diff
--- a/frontend/src/screens/calculators/FreeAmmoniaScreen.tsx
+++ b/frontend/src/screens/calculators/FreeAmmoniaScreen.tsx
@@
-    const [salinity, setSalinity] = useState('15');
+    // Not pre-filled: salinity is a real term in the pKa model (BUG-002), and a
+    // brackish default silently biases a freshwater pond's reading LOW.
+    const [salinity, setSalinity] = useState('');
```

Translate the corrected hint into the five sibling locales (`hi`, `bn`, `ta`, `te`, `or` — each `calculators.ts:130`). If prefill is wanted, source it from the pond's stored salinity rather than a constant.

- **Regression guard:** `maestro_tests/24_ammonia_salinity_sensitivity.yaml` pins the sensitivity itself and stays valid; it clears the field explicitly, so it survives the default change.

---

## P2 — MAJOR

### [BUG-003] [Severity: P2] Product Dosage shows the 100 %-basis quantity as its headline; a farmer using a 50 % product applies half the intended dose

- **Affected Screen / Module:** `ProductAmountScreen` (route `ProductAmount`, "Product Dosage")
- **Source Code Location:**
  - `frontend/src/screens/calculators/ProductAmountScreen.tsx:143-145` — headline renders `result.amountKg.toFixed(2)` (server value, concentration-blind)
  - `frontend/src/screens/calculators/ProductAmountScreen.tsx:147-155` — concentration-corrected figure, demoted below a divider
  - `frontend/src/screens/calculators/ProductAmountScreen.tsx:58-65` — `clientCalc = (pondVolume * ppm) / (conc * 10)`
  - `backend/src/shrimp-calculations/dto/advanced-calculations.dto.ts:45-57` — `ProductDosageDto` has **no** concentration field
- **Preconditions / App State:** Signed-in session; Product Dosage screen; a real product that is less than 100 % active ingredient.
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Product Dosage**.
  2. Input `5000` into **Pond Area (m²)**.
  3. Input `1.2` into **Water Level (m)**.
  4. Input `2` into **Target Concentration (ppm)**.
  5. Input `50` into **Product Concentration (%)**.
  6. Tap **Calculate**.
- **Observed Behavior:** Under the heading **"Required Product Amount"** the large primary figure reads **`12.00 kg`**. The quantity the farmer must actually weigh out — **`24.000 kg`** — appears in small type below a divider, captioned *"With 50% concentration:"*. Both numbers are individually correct; the visual hierarchy promotes the wrong one for the product entered.
- **Expected Behavior:** When a concentration below 100 % is supplied, the headline under "Required Product Amount" must be the **product** mass to apply (`24.000 kg`), with the pure-active-ingredient basis (`12.00 kg`) demoted to the supporting line.
- **Root-Cause Code Analysis:** Concentration was added client-side only. The API contract (`advanced-calculations.dto.ts:45-57`) accepts `pondArea`, `waterLevel` and `dosage` and nothing else, so `amountKg` is by construction the 100 %-active quantity. The screen renders that server value in `styles.resultValue` (`:144` — the large treatment) and the corrected value in `styles.clientValue` (`:151` — the small one). The renderer never asks which of the two answers the user's question; it unconditionally promotes the server's. Under-dosing a pond treatment fails silently — there is no immediate visible symptom — which is why this rates P2 rather than cosmetic.
- **Developer Remediation / Fix Recommendation:** Swap the hierarchy when a concentration is in play; leave the layout untouched when the product is 100 % active or the field is blank.

```diff
--- a/frontend/src/screens/calculators/ProductAmountScreen.tsx
+++ b/frontend/src/screens/calculators/ProductAmountScreen.tsx
@@
                 {result && (
                     <View style={styles.resultBox}>
-                        <Text style={styles.resultLabel}>{t('calculators.productDosage.requiredAmount')}</Text>
-                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.resultValue}>{result.amountKg.toFixed(2)}</Text>
-                        <Text style={styles.resultUnit}>kg</Text>
-
-                        {clientResult !== null && (
-                            <View style={styles.clientResultSection}>
-                                <View style={styles.divider} />
-                                <Text style={styles.clientLabel}>{t('calculators.productDosage.withConcentration', { conc: concentration || '100' })}</Text>
-                                <Text style={styles.clientValue}>{clientResult.toFixed(3)} kg</Text>
+                        {/* The headline must be the mass the farmer weighs out. For a
+                            sub-100% product that is the concentration-corrected figure,
+                            not the pure-active-ingredient basis (QA BUG-003). */}
+                        <Text style={styles.resultLabel}>{t('calculators.productDosage.requiredAmount')}</Text>
+                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.resultValue}>
+                            {(clientResult ?? result.amountKg).toFixed(clientResult !== null ? 3 : 2)}
+                        </Text>
+                        <Text style={styles.resultUnit}>kg</Text>
+
+                        {clientResult !== null && (
+                            <View style={styles.clientResultSection}>
+                                <View style={styles.divider} />
+                                <Text style={styles.clientLabel}>{t('calculators.productDosage.activeIngredientBasis')}</Text>
+                                <Text style={styles.clientValue}>{result.amountKg.toFixed(2)} kg</Text>
                                 <Text style={styles.clientFormula}>
                                     ({pondVolume?.toFixed(0)} m³ × {targetPpm} ppm) / (10 × {concentration || 100}%)
                                 </Text>
                             </View>
                         )}
```

New key required in all six locales (`calculators.ts`): `activeIngredientBasis: '100% active-ingredient basis:'`. Retain `withConcentration` or remove it once unreferenced.

- **Regression guard:** `maestro_tests/09_dosage_with_concentration.yaml` asserts the present (defective) hierarchy and must be inverted with the fix.

---

### [BUG-004] [Severity: P2] `GET /shrimp-calculations/recommended-feeding-rate` returns a plausible number for junk, empty and negative input instead of rejecting it

- **Affected Screen / Module:** `ShrimpCalculationsController` — `GET recommended-feeding-rate`. Authenticated public API surface; not reachable from the current UI.
- **Source Code Location:**
  - `backend/src/shrimp-calculations/shrimp-calculations.controller.ts:136-147` — `getRecommendedFeedingRate()`, no validation
  - `backend/src/shrimp-calculations/shrimp-calculations.service.ts:136-166` — the step table
  - Contrast: `backend/src/shrimp-calculations/shrimp-calculations.controller.ts:119-134` — `calculateBiomass()`, which validates correctly ten lines above
- **Preconditions / App State:** Any authenticated API client (valid JWT). No app state required.
- **Deterministic Steps to Reproduce (STR):**
  1. `GET /api/shrimp-calculations/recommended-feeding-rate?averageWeightG=abc`
  2. `GET /api/shrimp-calculations/recommended-feeding-rate?averageWeightG=`
  3. `GET /api/shrimp-calculations/recommended-feeding-rate?averageWeightG=-5`
- **Observed Behavior:**

  | `averageWeightG` | HTTP | `recommendedFeedingRatePercent` | Why |
  |---|---|---|---|
  | `abc` / omitted | `200` | **`1.8`** | `Number('abc')` → `NaN`; every `<` comparison is false; falls through to the `> 30 g` tail return |
  | `""` | `200` | **`10`** | `Number('')` → `0`; matches the `< 3 g` post-larvae bucket |
  | `-5` | `200` | **`10`** | same `< 3 g` bucket |

  All three are returned as confident, in-range advice. No consumer can distinguish them from a real answer.
- **Expected Behavior:** `400 Bad Request` naming the offending parameter — exactly what the sibling `biomass` handler produces for the same class of input.
- **Root-Cause Code Analysis:** `controller.ts:138` types the query parameter as `number`, but Nest passes query strings through as `string` unless a pipe converts them, so the declared type is decorative. `Number(averageWeightG)` at `:143` therefore yields `NaN` for junk and `0` for empty, and neither is checked. The service's table is a chain of `<` comparisons (`service.ts:146-165`); `NaN < 3` is `false` at every rung, so control reaches the unconditional tail `return 1.8`. `0` legitimately satisfies the first rung and returns `10`. Neither is an error path — both are ordinary lookups on a value that should never have been accepted. The correct pattern already exists in the same file at `:124-130`.
- **Developer Remediation / Fix Recommendation:** Mirror the `biomass` handler.

```diff
--- a/backend/src/shrimp-calculations/shrimp-calculations.controller.ts
+++ b/backend/src/shrimp-calculations/shrimp-calculations.controller.ts
@@
   @Get('recommended-feeding-rate')
   getRecommendedFeedingRate(
-    @Query('averageWeightG') averageWeightG: number,
+    @Query('averageWeightG') averageWeightG: string,
     @Query('species') species?: string,
   ) {
+    const weight = Number(averageWeightG);
+    if (!Number.isFinite(weight) || weight <= 0) {
+      throw new BadRequestException('averageWeightG must be a positive number');
+    }
     return {
       recommendedFeedingRatePercent:
-        this.calculationsService.getRecommendedFeedingRate(
-          Number(averageWeightG),
-          species,
-        ),
+        this.calculationsService.getRecommendedFeedingRate(weight, species),
     };
   }
```

`BadRequestException` is already imported in this file (used at `:125`).

---

### [BUG-005] [Severity: P2] "Pond Area (m²)" on Daily Feed is editable, discards the result when typed into, and influences no output

- **Affected Screen / Module:** `DailyFeedCalculatorScreen` (route `DailyFeedCalculator`, "Daily Feed Amount") — Pond Area field
- **Source Code Location:**
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:59` — `const [pondAreaM2, setPondAreaM2] = useState('')`
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:82` — prefilled from pond context in `applyContext()`
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:91` — listed as a result-invalidation dependency
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:220-228` — bound to a live, editable `Input`
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:93-135` — `handleCalculate()`, which never reads it
- **Preconditions / App State:** Signed-in session; Daily Feed Amount screen; no pond selected (fields typed by hand).
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Daily Feed Amount**.
  2. Input `20` into **MBW (g)**, `80` into **Survival %**, `100000` into **Stocking count**, `3` into **Feeding rate %**.
  3. Tap **Calculate**. Record every rendered figure.
  4. Input `999999` into **Pond Area (m²)** — observe the result block disappear.
  5. Tap **Calculate** again.
- **Observed Behavior:** Steps 3 and 5 render byte-identical output: `Required Daily Feed 48.0 kg`, `Biomass 1,600`, `Per meal 12.0`, `Meals 4`. A 999 999 m² pond area produces the same answer as a blank one. Step 4 nevertheless **clears the previous result**, so the field visibly behaves as though it feeds the calculation.
- **Expected Behavior:** An editable, result-invalidating field must affect the result. Either the screen reports something derived from area — stocking density in PL/m², or feed in kg/ha — or the field is not offered.
- **Root-Cause Code Analysis:** `handleCalculate()` reads exactly four fields (`:94-97`) and computes `biomass = ((count × sr)/100) × mbw / 1000` (`:116`), which the server multiplies by the feeding rate. `pondAreaM2` is never dereferenced inside the function. It is, however, in the `useEffect` dependency array at `:91` that resets `result`/`biomassKg` — which is what produces the misleading "something changed, recalculate" behaviour. The field is a leftover of the pre-redesign "Pond & Stock Data" form; the redesign (`f41e521`) kept the input and dropped its consumer.
- **Developer Remediation / Fix Recommendation:** Preferred — make it earn its place by reporting stocking density, which is what a farmer actually wants area for:

```diff
--- a/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
+++ b/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
@@ handleCalculate
         const computedBiomass = ((count * sr) / 100) * mbw / 1000;
+        const area = parseFloat(pondAreaM2);
+        // Optional: reported only when the farmer supplied a usable area.
+        setDensityPerM2(
+            Number.isFinite(area) && area > 0 ? (count * sr) / 100 / area : null,
+        );
```

and render it as a fourth `StatRow` stat:

```diff
                         <StatRow
                             divider
                             stats={[
                                 { value: ..., label: t('calculators.dailyFeed.biomassKg') },
                                 { value: ..., label: t('calculators.dailyFeed.perMealKg') },
                                 { value: String(MEALS_PER_DAY), label: t('calculators.dailyFeed.meals') },
+                                ...(densityPerM2 != null
+                                    ? [{ value: densityPerM2.toFixed(1), label: t('calculators.dailyFeed.densityPerM2') }]
+                                    : []),
                             ]}
                         />
```

Minimum acceptable alternative — delete the `Input` at `:220-228`, the state at `:59`, the prefill at `:82` and the dependency at `:91`. Do **not** leave the field present-but-inert.

- **Regression guard:** `maestro_tests/25_dailyfeed_pond_area_inert.yaml` asserts the inertness and must be inverted (or deleted, if the field goes) with the fix.

---

### [BUG-006] [Severity: P2] Input placeholder text fails WCAG AA contrast at 1.88:1 — form guidance is effectively unreadable in sunlight

- **Affected Screen / Module:** Design system — `Input` (`components/ui/Input.tsx`); affects every form in the app. Measured on the five calculator screens.
- **Source Code Location:**
  - `frontend/src/theme/tokens.ts:37` — `placeholderColor: '#A3B5BF'`
  - `frontend/src/theme/tokens.ts:30` — `bgDefault: '#F5F8FA'` (unfocused input surface)
  - `frontend/src/theme/colorRoles.ts:6` — `surfaceVariant: '#EEF2F5'`
  - `frontend/src/components/ui/Input.tsx:73` — `placeholderTextColor={theme.tokens.input.placeholderColor}`
- **Preconditions / App State:** Any screen containing an unfilled `Input`; light theme (the only theme shipped).
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Daily Feed Amount**.
  2. Observe the unfilled fields showing placeholders `18.4`, `78`, `28700`, `3.2`, `4000`.
  3. Compute the WCAG 2.1 contrast ratio of `#A3B5BF` against the field background.
- **Observed Behavior:** `#A3B5BF` on `#EEF2F5` = **1.88:1**; against the lighter `#F5F8FA` field background it is no better. WCAG 2.1 AA requires **4.5:1** for text below 18.66 px bold / 24 px regular, and placeholders render at 15 px (`tokens.ts:32`). These placeholders are not decorative — they are the only worked examples of the expected magnitude and unit (`28700` for a stocking count, `3.2` for a feeding rate), so losing them costs real guidance to the target user, who is often outdoors in bright light.
- **Expected Behavior:** ≥ 4.5:1 against the actual field background in both default and focused states.
- **Root-Cause Code Analysis:** `#A3B5BF` was chosen as a "disabled/ghost" grey — it is also `colorRoles.ts:18 textDisabled` and `:27 primaryDisabled` — and then reused as the placeholder colour. Placeholder text is *informational*, not disabled-state chrome, so it inherited a contrast budget it should not have. Both foreground and background sit in the top third of the luminance range, which is why the ratio collapses. No automated contrast check exists in the build to catch it.
- **Developer Remediation / Fix Recommendation:** Give placeholders their own token, dark enough to clear AA against both input backgrounds. `#5B7286` yields **4.63:1** on `#EEF2F5` and **4.79:1** on `#F5F8FA`.

```diff
--- a/frontend/src/theme/tokens.ts
+++ b/frontend/src/theme/tokens.ts
@@ input
-        placeholderColor: '#A3B5BF',
+        // Placeholders carry the worked example of magnitude and unit, so they are
+        // informational text and owe WCAG AA 4.5:1 - not the disabled-grey budget
+        // they used to borrow. 4.63:1 on #EEF2F5 (QA BUG-006).
+        placeholderColor: '#5B7286',
```

Keep `#A3B5BF` where it genuinely means *disabled* (`colorRoles.ts:18`, `:27`, `tokens.ts:78`). Add the contrast assertion from BUG-016 so the pair cannot regress.

---

### [BUG-019] [Severity: P1] A pond with no sampling and no mortality data reports 100 % survival, and every biomass and feed figure derived from it is over-estimated

- **Affected Screen / Module:** `DailyFeedCalculatorScreen` (`applyContext` prefill) **and** `PondDashboardScreen` (the SURVIVAL % stat). Both read the same `/pond-context` payload.
- **Source Code Location:**
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:77-81` — `const sr = Math.round((ctx.livePopulation / ctx.crop.stockingCount) * 100)`
  - `frontend/src/api/pondContext.ts:29-31` — `livePopulation`, `abwG`, `biomassKg` on `PondContext`
  - `frontend/src/i18n/locales/en/ponds.ts` — `needSamplingTitle` / `needSamplingBody`, the copy that contradicts the figure
- **Preconditions / App State:** Signed-in session; a pond with an **active cycle**, **no sampling logged** and **no mortality logged** — i.e. every pond on its first day. Reproduced on `QA-AUDIT-POND` (500 000 PL, 5000 m², DOC 1), created by `maestro_tests/_seed_02_start_cycle.yaml`.
- **Deterministic Steps to Reproduce (STR):**
  1. Create a pond and start a cycle on it (stocking count `500000`). Log **no** sampling and **no** mortality.
  2. Open **Farm → the farm → the pond**. Read the `SURVIVAL %` stat.
  3. Go to Settings → TOOLS → Calculators, select that pond under **"Pick a pond first"**, and open **Daily Feed Amount**.
  4. Read the **SR (%)** field without typing anything.
- **Observed Behavior:**
  - Step 2 — the pond dashboard renders `MBW G —`, **`SURVIVAL % 100`**, `BIOMASS KG —`, `FCR —`, and immediately beneath them the card *"**No sampling yet** — Biomass, FCR and survival are worked out from the average weight in a sampling. Record one to fill them in."* Survival is the **only** one of the four stats populated, with a value the very next sentence says cannot be known yet.
  - Step 4 — **SR (%) is pre-filled with `100`**, under a banner reading *"Filled from the pond you picked · day 1"*.
- **Expected Behavior:** With no sampling and no mortality data, survival is **unknown**. It must render as `—` exactly like MBW, biomass and FCR do on the same card, and it must not be pre-filled into a calculator input as though it were measured.
- **Root-Cause Code Analysis:** `livePopulation` is derived as stocked-minus-logged-mortality. With no mortality logged it equals `crop.stockingCount`, so `Math.round((live / stocked) * 100)` is exactly `100` — arithmetically correct and semantically meaningless. The guard at `:78` tests `ctx.livePopulation != null`, which asks *"is the field present?"* rather than *"has anyone actually measured this?"*. The other three stats on the dashboard are gated on `abwG`, which really is null without a sampling, which is why they correctly show `—` and survival does not. **Consequence:** biomass = `count × SR/100 × MBW/1000`, so a real 80 % survival carried as 100 % over-estimates biomass by **25 %**, and the daily feed figure — the whole point of the screen — is over by the same 25 %. Over-feeding is not a neutral error: uneaten feed decays to ammonia, which is the exact quantity the Free Ammonia calculator exists to warn about.
- **Developer Remediation / Fix Recommendation:** Treat survival as unknown until something has actually been measured. `PondContext` already carries the signal — `confidence.missing` — and `abwG` is a serviceable proxy for "a sampling exists".

```diff
--- a/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
+++ b/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
@@ applyContext
         if (ctx.crop?.stockingCount != null) {
             setInitialCount((v) => v || String(ctx.crop!.stockingCount));
-            if (ctx.livePopulation != null && ctx.crop.stockingCount > 0) {
-                const sr = Math.round((ctx.livePopulation / ctx.crop.stockingCount) * 100);
-                setSrPct((v) => v || String(sr));
-            }
+            // livePopulation == stockingCount whenever no mortality has been
+            // logged, which makes SR exactly 100% on every un-sampled pond -
+            // arithmetically true, factually unknown, and it over-estimates
+            // biomass (and therefore feed) by the real mortality (QA BUG-019).
+            // Only offer a survival figure once a sampling exists to back it.
+            const sampled = ctx.abwG != null;
+            if (sampled && ctx.livePopulation != null && ctx.crop.stockingCount > 0) {
+                const sr = Math.round((ctx.livePopulation / ctx.crop.stockingCount) * 100);
+                setSrPct((v) => v || String(sr));
+            }
         }
```

Apply the same gate to the dashboard's `SURVIVAL %` stat so it renders `—` beside MBW, biomass and FCR instead of contradicting the "No sampling yet" card directly below it.

- **Regression guard:** `maestro_tests/41_prefill_dailyfeed.yaml` asserts the `100` prefill and must be inverted once the gate lands.

---

### [BUG-018] [Severity: P2] The "Filled from the pond" banner is shown even when the pond filled nothing — including the one required field

- **Affected Screen / Module:** `DailyFeedCalculatorScreen` — the prefill banner
- **Source Code Location:**
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:74` — `setPrefilled(true)`, unconditional
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:75` — `if (ctx.abwG != null) setMbwG(...)` — MBW is filled only *conditionally*
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:160-165` — the banner, gated only on `prefilled`
  - `frontend/src/i18n/locales/en/calculators.ts` — `filledFromPond`, `filledFromPondDay`
- **Preconditions / App State:** Signed-in session; a stocked pond with **no sampling logged**, so `pondContext.abwG` is `null`. Reproduced on `QA-AUDIT-POND`.
- **Deterministic Steps to Reproduce (STR):**
  1. Settings → TOOLS → Calculators.
  2. Select `QA-AUDIT-POND` under **"Pick a pond first"**.
  3. Tap **Daily Feed Amount**.
  4. Read the banner, then read the **MBW (g)** field.
- **Observed Behavior:** The banner reads **"Filled from the pond you picked · day 1"**. The `MBW (g)` field is **empty** — a uiautomator dump shows its `EditText` rendering the placeholder `18.4`, which only happens when the field holds no value. MBW is marked required (`*`) and is the single largest term in the biomass calculation. Of the five inputs, the pond genuinely filled two (Count `500000`, Pond Area `5000` — and Pond Area is itself inert, BUG-005), invented one (SR `100`, BUG-019), and left two empty.
- **Expected Behavior:** The banner should describe what was actually filled, or not appear at all when the required field was not. A farmer told the form is "filled from the pond" reasonably reads the remaining blank as optional.
- **Root-Cause Code Analysis:** `setPrefilled(true)` at `:74` fires as soon as a non-null context arrives, *before* any of the four conditional `set*` calls at `:75-83` have decided whether they have anything to write. `prefilled` therefore means "a pond context loaded", while the banner it drives claims "your fields were filled from the pond". The two are only the same when the pond has a sampling. Every pond before its first sampling shows the mismatch.
- **Developer Remediation / Fix Recommendation:** Set the flag from what was written, not from the fact that a payload arrived.

```diff
--- a/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
+++ b/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
@@ applyContext
     const applyContext = useCallback((id: string, ctx: PondContext | null) => {
         setPondId(id);
         if (!ctx) return;
         setDoc(ctx.doc ?? null);
-        setPrefilled(true);
+        // The banner says "filled from the pond", so only raise it when the pond
+        // actually filled the field the farmer needs. A context that arrives
+        // without a sampling fills neither MBW nor a real SR (QA BUG-018).
+        setPrefilled(ctx.abwG != null);
         if (ctx.abwG != null) setMbwG((v) => v || String(ctx.abwG));
```

Better still, tell the farmer what is missing: when `ctx.abwG == null`, render the pond's own `needSamplingBody` copy — *"Biomass, FCR and survival are worked out from the average weight in a sampling"* — instead of a banner claiming the form is ready.

- **Regression guard:** `maestro_tests/41_prefill_dailyfeed.yaml` asserts the banner alongside the empty-MBW placeholder and must be inverted with the fix.

---

## P3 — MINOR

### [BUG-007] [Severity: P3] `FreeAmmoniaDto.ph` accepts chemically impossible values — no upper bound

- **Affected Screen / Module:** `ShrimpCalculationsController` — `POST free-ammonia` DTO validation
- **Source Code Location:** `backend/src/shrimp-calculations/dto/advanced-calculations.dto.ts:29-31` — `FreeAmmoniaDto.ph`, `@IsNumber() @Min(0)` with no `@Max`
- **Preconditions / App State:** Authenticated API client. Not reachable through the UI — `FreeAmmoniaScreen.tsx:74` bounds pH client-side (verified by TC-15).
- **Deterministic Steps to Reproduce (STR):**
  1. `POST /api/shrimp-calculations/free-ammonia` with body `{"tan":1.5,"ph":20,"temperature":29,"salinity":15}`.
- **Observed Behavior:** `201` with a confidently computed `unionizedAmmonia`. pH 20 does not exist; the value is meaningless but indistinguishable from a real one.
- **Expected Behavior:** `400 Bad Request` — pH is defined on `[0, 14]`.
- **Root-Cause Code Analysis:** The decorator set was copied from the neighbouring numeric fields (`tan`, `temperature`), where only a lower bound applies. pH is the one field in the DTO with a hard physical ceiling and it was not given one. The codebase demonstrably knows the idiom: `calculation.dto.ts:45` and `:56` both carry `@Max(100)` on percentages.
- **Developer Remediation / Fix Recommendation:**

```diff
--- a/backend/src/shrimp-calculations/dto/advanced-calculations.dto.ts
+++ b/backend/src/shrimp-calculations/dto/advanced-calculations.dto.ts
@@ class FreeAmmoniaDto
   @IsNumber()
   @Min(0)
+  @Max(14)
   ph: number;
```

Confirm `Max` is present in this file's `class-validator` import; add it if not.

---

### [BUG-008] [Severity: P3] `CalculateSurvivalRateDto` documents a 100 % clamp that `calculateSurvivalRate()` does not implement

- **Affected Screen / Module:** `ShrimpCalculationsService.calculateSurvivalRate` / `CalculateSurvivalRateDto`
- **Source Code Location:**
  - `backend/src/shrimp-calculations/dto/calculation.dto.ts:32` — the comment *"Service clamps SR to 100% when harvestedCount > initialStock."*
  - `backend/src/shrimp-calculations/shrimp-calculations.service.ts:59-62` — `calculateSurvivalRate()`, which contains no clamp
- **Preconditions / App State:** Authenticated API client. Not reachable through the UI — `CultivationPerformanceScreen.tsx:83` derives `harvestedCount` from an SR already validated ≤ 100.
- **Deterministic Steps to Reproduce (STR):**
  1. `POST /api/shrimp-calculations/survival-rate` with `{"initialStock":100000,"harvestedCount":150000}`.
  2. Repeat with `{"initialStock":1000,"harvestedCount":999999}`.
- **Observed Behavior:** Step 1 returns `survivalRatePercent: 150`. Step 2 returns `99999.9`. A survival rate above 100 % is not a quantity that exists.
- **Expected Behavior:** Either `100` (the documented clamp) or a `400`. The comment at `calculation.dto.ts:32` is the stated reason `harvestedCount` carries no `@Max`, so the guard must live *somewhere*; today it lives nowhere.
- **Root-Cause Code Analysis:** A documented-but-unwritten guard. `service.ts:59-62` guards only `initialStock === 0`, then returns `Math.round((harvestedCount / initialStock) * 10000) / 100` unbounded. Because the DTO comment justified omitting `@Max`, the two omissions reinforce each other and neither layer bounds the value.
- **Developer Remediation / Fix Recommendation:** Implement the clamp the comment already promises. This is the lower-risk option — field counts routinely overshoot stock slightly through estimation error, and rejecting those outright would break a legitimate caller.

```diff
--- a/backend/src/shrimp-calculations/shrimp-calculations.service.ts
+++ b/backend/src/shrimp-calculations/shrimp-calculations.service.ts
@@ calculateSurvivalRate
   calculateSurvivalRate(initialStock: number, harvestedCount: number): number {
     if (initialStock === 0) return 0;
-    return Math.round((harvestedCount / initialStock) * 10000) / 100;
+    // Clamped, as CalculateSurvivalRateDto:32 has always claimed. Field counts
+    // routinely overshoot stock slightly; >100% survival is not a quantity that
+    // exists, so report the ceiling rather than an impossible figure.
+    const pct = Math.round((harvestedCount / initialStock) * 10000) / 100;
+    return Math.min(pct, 100);
   }
```

If the alternative (reject rather than clamp) is preferred, add the bound in the DTO and **delete the comment at `calculation.dto.ts:32`** so the contract stops asserting a behaviour that no longer exists.

---

### [BUG-009] [Severity: P3] Non-numeric optional Pond Area silently removes the Productivity metric with no error

- **Affected Screen / Module:** `CultivationPerformanceScreen` (route `CultivationPerformance`) — Pond Area (m²), optional
- **Source Code Location:**
  - `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:48` — `const area = areaM2 ? parseFloat(areaM2) : 0`
  - `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:74` — `if (areaM2 && (area <= 0))` — the guard that fails to fire
  - `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:106` — `const productivity = area > 0 ? harvestKg / area : null`
  - `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:257-263` — Productivity stat rendered only when non-null
- **Preconditions / App State:** Signed-in session; Cultivation Performance screen; all required fields valid.
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Cultivation Performance**.
  2. Input `100000` Total Seed, `1500` Total Harvested (kg), `2250` Total Feed (kg), `120` Days of Culture, `20` Final MBW (g), `80` Final SR (%).
  3. Input `abc` into **Pond Area (m²)**.
  4. Tap **Calculate**.
- **Observed Behavior:** No validation alert. `FCR 1.50`, `ADG 0.167` and `SR 80.0%` render correctly. The **Productivity** card is simply absent, with nothing explaining why the metric the user supplied an input for did not appear. (Confirmed the string genuinely reaches the field: the uiautomator dump shows an `EditText` holding `text: "abc"`.)
- **Expected Behavior:** Either a `Validation Error` alert naming Pond Area, or a rendered Productivity value. Silently dropping a requested metric is the one outcome that teaches the user nothing.
- **Root-Cause Code Analysis:** A `NaN`-permeable comparison. `parseFloat('abc')` → `NaN`; the guard at `:74` asks `NaN <= 0`, which is `false`, so it does not fire. The renderer's gate at `:106` asks `NaN > 0`, also `false`, so `productivity` becomes `null` and `:257` skips the card. Both checks are individually reasonable, and both are silently satisfied by `NaN` in the direction that suppresses feedback. Every `NaN` comparison is `false`, so reordering or negating the operands cannot fix it — the type must be tested, not the magnitude.
- **Developer Remediation / Fix Recommendation:**

```diff
--- a/frontend/src/screens/calculators/CultivationPerformanceScreen.tsx
+++ b/frontend/src/screens/calculators/CultivationPerformanceScreen.tsx
@@
-        if (areaM2 && (area <= 0)) {
+        // NaN fails every comparison, so `area <= 0` lets "abc" through and the
+        // metric then vanishes with no error (QA BUG-009). Test the type.
+        if (areaM2 && (!Number.isFinite(area) || area <= 0)) {
             Alert.alert(t('calculators.performance.validationTitle'), t('calculators.performance.errorArea'));
             return;
         }
```

`errorArea` already exists in all six locales; no new key is needed. Superseded automatically if BUG-017's `parseNumericInput` lands first.

- **Regression guard:** `maestro_tests/28_performance_nonnumeric_area.yaml` asserts the silent drop and must be inverted to expect the alert.

---

### [BUG-010] [Severity: P3] Feeding rate has no client-side upper bound, so an out-of-range value fails via a generic network error instead of the standard field message

- **Affected Screen / Module:** `DailyFeedCalculatorScreen` — Feeding rate (%)
- **Source Code Location:**
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:111` — `if (!fr || fr <= 0)`, no upper bound
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:131` — generic `errorCalc` fallback path
  - `backend/src/shrimp-calculations/dto/calculation.dto.ts:43-45` — server enforces `@Max(100)`
- **Preconditions / App State:** Signed-in session; Daily Feed Amount screen; network reachable.
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Daily Feed Amount**.
  2. Input `20` MBW, `80` Survival %, `100000` Stocking count.
  3. Input `150` into **Feeding rate %**.
  4. Tap **Calculate**.
- **Observed Behavior:** No client-side `Validation Error`. The request is dispatched, costs a network round-trip, and the server's `400` surfaces through the generic error path; no result renders. Every other out-of-range input in the app (TC-04 SR, TC-10 concentration, TC-15 pH, TC-18 SR, TC-23 SR) produces an immediate, field-named `Validation Error` instead.
- **Expected Behavior:** Immediate client-side `Validation Error` naming the feeding rate, matching the established pattern and the server's own `@Max(100)`.
- **Root-Cause Code Analysis:** Bound parity was applied to survival rate (`:104`, `sr > 100`) but not to feeding rate. The client and server disagree on the contract, so the client forwards a request it can prove will fail. This is UX inconsistency rather than a wrong answer — hence P3 — but it is the only input in the suite that behaves this way.
- **Developer Remediation / Fix Recommendation:**

```diff
--- a/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
+++ b/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
@@ handleCalculate
-        if (!fr || fr <= 0) {
+        // Mirror the server's @Max(100) (calculation.dto.ts:45) so an out-of-range
+        // rate fails with the same field-named message every other input gives,
+        // instead of a wasted round-trip and a generic error (BUG-010).
+        if (!fr || fr <= 0 || fr > 100) {
             Alert.alert(t('calculators.dailyFeed.validationTitle'), t('calculators.dailyFeed.errorFeedingRate'));
             return;
         }
```

Confirm `errorFeedingRate` reads as a range message in all six locales; reword if it currently says only "must be positive".

- **Regression guard:** `maestro_tests/29_dailyfeed_feedrate_over_100.yaml` asserts the absent validation and must be inverted.

---

### [BUG-011] [Severity: P3] No sanity ceiling on stocking count — the app renders 4.8 × 10¹⁶ kg of feed per day as a result, and clips the biomass figure

- **Affected Screen / Module:** `DailyFeedCalculatorScreen`; figure rendering shared with `components/ui/StatRow`
- **Source Code Location:**
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:96` — `const count = parseFloat(initialCount)`, no upper bound
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:106-114` — validation chain, lower bounds only
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:256` — `Math.round(biomassKg).toLocaleString('en-IN')`
  - `frontend/src/components/ui/StatRow.tsx:57` — `numberOfLines={1}` with **no** `adjustsFontSizeToFit`
- **Preconditions / App State:** Signed-in session; Daily Feed Amount screen.
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Daily Feed Amount**.
  2. Input `20` MBW, `80` Survival %, `3` Feeding rate %.
  3. Input `99999999999999999999` (10²⁰) into **Stocking count**.
  4. Tap **Calculate**.
- **Observed Behavior:** No guard fires. The screen renders **`REQUIRED DAILY FEED  48000000000000000.0 kg`** — 4.8 × 10¹⁶ kg, roughly 48 trillion tonnes of feed per day — presented with exactly the confidence of a real answer, plus `12000000000000000.0` per meal. The `BIOMASS KG` stat, whose full value is `16,00,00,00,00,00,00,00,000`, is **truncated to `16,00,00,00…`** because `StatRow` clips instead of shrinking. Past `Number.MAX_SAFE_INTEGER` (9 007 199 254 740 991) the displayed digits are no longer exact in any case.
- **Expected Behavior:** An upper-bound guard on stocking count — a pond of ~10⁸ post-larvae is already extreme — rejecting the input with a `Validation Error`; and, independently, a figure that exceeds its column should shrink or abbreviate rather than silently lose its most significant portion.
- **Root-Cause Code Analysis:** Two independent gaps compounding. (1) The validation chain at `:106-114` tests only for falsy / `<= 0`; there is no ceiling anywhere on the client, and the server DTO bounds only the feeding percentage, so a physically impossible magnitude flows straight through arithmetic that remains `Number.isFinite` and renders. (2) `StatRow.tsx:57` sets `numberOfLines={1}` without `adjustsFontSizeToFit` — unlike the headline at `DailyFeedCalculatorScreen.tsx:247`, which does carry `adjustsFontSizeToFit minimumFontScale={0.5}`. An over-long value is therefore ellipsised at the tail, which for a number removes the least significant digits and leaves a plausible-looking but wrong figure with no visual cue that truncation happened.
- **Developer Remediation / Fix Recommendation:** Fix the guard and the renderer separately — the clipping affects every `StatRow` in the app, not only this screen.

```diff
--- a/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
+++ b/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
@@ handleCalculate
+        // A pond holding more than 100 million PL does not exist; without a ceiling
+        // the screen confidently renders 4.8e16 kg of feed and the biomass stat
+        // clips silently past MAX_SAFE_INTEGER (BUG-011).
+        const MAX_STOCKING_COUNT = 100_000_000;
-        if (!count || count <= 0) {
+        if (!count || count <= 0 || count > MAX_STOCKING_COUNT) {
             Alert.alert(t('calculators.dailyFeed.validationTitle'), t('calculators.dailyFeed.errorCount'));
             return;
         }
```

```diff
--- a/frontend/src/components/ui/StatRow.tsx
+++ b/frontend/src/components/ui/StatRow.tsx
@@
                     <Text
                         style={[...]}
                         numberOfLines={1}
+                        // Shrink rather than ellipsise: truncating a figure drops its
+                        // least significant digits and leaves a wrong number that
+                        // still looks right (BUG-011).
+                        adjustsFontSizeToFit
+                        minimumFontScale={0.6}
                     >
```

Reword `errorCount` to state the accepted range. Apply the same ceiling reasoning to `CultivationPerformanceScreen` (Total Seed) and `GrowthAndHarvestScreen` (Stock Count) — both share the pattern.

- **Regression guard:** `maestro_tests/31_sanitize_max_buffer.yaml` asserts today's unbounded behaviour and must be inverted to expect the `Validation Error`.

---

### [BUG-012] [Severity: P3] Cultivation Performance issues a fourth API request per calculation whose response is never rendered

- **Affected Screen / Module:** `CultivationPerformanceScreen`
- **Source Code Location:**
  - `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:24` — `perf: CultivationPerformanceResponse | null` in the results type
  - `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:97-103` — the `calculateCultivationPerformance` call
  - `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:113` — `perf: perfRes.data`
  - `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:239-263` — the results block, which reads `fcr`, `adg`, `sr`, `productivity` and never `perf`
- **Preconditions / App State:** Signed-in session; Cultivation Performance screen; any valid payload.
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Cultivation Performance**.
  2. Enter the TC-17 payload and tap **Calculate**.
  3. Observe the network layer, or run `grep -n 'results\.perf' CultivationPerformanceScreen.tsx`.
- **Observed Behavior:** Four requests are dispatched in a single `Promise.all` (`:83`). Three results are rendered. `results.perf` has **no read anywhere in the file**. Every Calculate press costs a wasted round-trip, and — because it is inside `Promise.all` — a failure or slow response on the unused call delays or fails the entire calculation.
- **Expected Behavior:** Either the performance payload is rendered, or the call is removed. As written it can only make the screen slower and more failure-prone.
- **Root-Cause Code Analysis:** Dead code retained across a redesign. The awkward inline expression at `:100` — `fr: (feedKg / days) / ((seed * sr / 100) * mbw / 1000) * 100 || 0` — exists only to satisfy the DTO of a call nobody consumes, and its `|| 0` tail silently converts a `NaN`/`Infinity` division into `0`. Because all four promises share one `Promise.all`, the unused call sits on the critical path for both latency and error handling.
- **Developer Remediation / Fix Recommendation:** Remove the call unless a consumer is landing in the same sprint.

```diff
--- a/frontend/src/screens/calculators/CultivationPerformanceScreen.tsx
+++ b/frontend/src/screens/calculators/CultivationPerformanceScreen.tsx
@@
-            const [fcrRes, adgRes, srRes, perfRes] = await Promise.all([
+            const [fcrRes, adgRes, srRes] = await Promise.all([
                 calculatorsApi.calculateFcr({ ... }),
                 calculatorsApi.calculateAdg({ ... }),
                 calculatorsApi.calculateSurvivalRate({ ... }),
-                calculatorsApi.calculateCultivationPerformance({
-                    dailyFeed: feedKg / days,
-                    fr: (feedKg / days) / ((seed * sr / 100) * mbw / 1000) * 100 || 0,
-                    abw: mbw,
-                    cumulativeFeed: feedKg,
-                    initialStocking: seed,
-                }),
             ]);
@@
             setResults({
                 fcr: fcrRes.data.fcr,
                 adg: adgRes.data.adgG,
                 sr: srRes.data.survivalRatePercent,
                 productivity,
-                perf: perfRes.data,
             });
```

Also drop `perf` from the results interface at `:24`.

---

### [BUG-013] [Severity: P3] 39 hardcoded English strings on the calculator screens survive a language switch, including every input placeholder

- **Affected Screen / Module:** All five calculator screens; i18n layer
- **Source Code Location:**
  - `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:165,175,185,197,207,219` — 6 placeholders
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:179,189,199,215,226` — 5
  - `frontend/src/screens/calculators/FreeAmmoniaScreen.tsx:132,142,154,164` — 4
  - `frontend/src/screens/calculators/GrowthAndHarvestScreen.tsx:181,191,201,238,248,258,296,306,333` — 9
  - `frontend/src/screens/calculators/ProductAmountScreen.tsx:99,109,119,127` — 4
  - Plus 11 literal unit/range strings, including `FreeAmmoniaScreen.tsx:190` (`ppm / mg/L`), `:207` (`0.1 – 0.5 ppm`), `ProductAmountScreen.tsx:137,145,153` and `GrowthAndHarvestScreen.tsx:218,267,317`
- **Preconditions / App State:** Signed-in session; device language switched to a non-English locale.
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to **Settings** and tap **हिन्दी**.
  2. Wait for the UI to re-render (`सेटिंग्स` visible).
  3. Tap **कैलकुलेटर**, then **उत्पादन प्रदर्शन** (Cultivation Performance).
  4. Inspect the empty input fields.
- **Observed Behavior:** Translated content renders correctly — `टूल्स और कैलकुलेटर`, `उत्पादन प्रदर्शन`, `कुल बीज (संख्या)` are all Hindi. But the placeholders inside those same fields still read **`e.g. 500000`** and **`e.g. 120`** in English, complete with the English abbreviation "e.g.". A translation-key parity check across 27 files × 6 locales found **0 missing and 0 extra keys** — the locale files are complete; these strings were simply never routed through `t()`.
- **Expected Behavior:** No user-visible English on a Hindi (or Bengali, Tamil, Telugu, Odia) screen. Placeholders are user-visible guidance and must be localised.
- **Root-Cause Code Analysis:** Not a missing-translation problem — an un-externalised-string problem. Every *label* on these screens goes through `t()`, but `placeholder=` was written as a literal JSX attribute at all 28 sites. `"e.g."` in particular is an English-language convention with no meaning in Devanagari, Bengali or Tamil script. The 11 unit literals (`ppm / mg/L`, `kg`, `m³`, `g`) are lower-risk since the symbols are near-universal, but `0.1 – 0.5 ppm` at `FreeAmmoniaScreen.tsx:207` is a *range label* that also encodes BUG-001's boundary, and should become a key for that reason alone.
- **Developer Remediation / Fix Recommendation:** Externalise the placeholders first — 28 mechanical sites.

```diff
--- a/frontend/src/screens/calculators/CultivationPerformanceScreen.tsx
+++ b/frontend/src/screens/calculators/CultivationPerformanceScreen.tsx
@@
-                        placeholder="e.g. 500000"
+                        placeholder={t('calculators.performance.phTotalSeed')}
```

```diff
--- a/frontend/src/i18n/locales/en/calculators.ts
+++ b/frontend/src/i18n/locales/en/calculators.ts
@@ performance
+    phTotalSeed: 'e.g. 500000',
+    phDaysOfCulture: 'e.g. 120',
```

Repeat for all 28 placeholders across the six locale files, then add a CI guard so new literals cannot land:

```bash
# fails the build if a user-visible literal placeholder reappears
! grep -rn 'placeholder="' frontend/src/screens/
```

- **Regression guard:** `maestro_tests/34_i18n_hindi_calculators.yaml` asserts `e.g. 500000` and `e.g. 120` are still English and must be inverted with the fix. `35_i18n_restore_english.yaml` restores the device language and should be left as-is.

---

### [BUG-014] [Severity: P3] Tertiary text — field hints and helper copy — fails WCAG AA at 3.32:1

- **Affected Screen / Module:** Design system — `Input` helper/hint text and every `theme.roles.light.textTertiary` consumer, app-wide
- **Source Code Location:**
  - `frontend/src/theme/colorRoles.ts:17` — `textTertiary: '#7A909F'`
  - `frontend/src/theme/tokens.ts:40` — `helperColor: '#7A909F'`; `:38` — `helperFontSize: 11`
  - `frontend/src/components/ui/Input.tsx:109-112` — renders `error || hint` in `styles.helperText`
- **Preconditions / App State:** Any screen with a hinted `Input` — e.g. Free Ammonia (Salinity hint) or Product Dosage (Product Concentration hint).
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Free Ammonia (NH₃)**.
  2. Observe the hint beneath the **Salinity (ppt)** field.
  3. Compute the WCAG 2.1 contrast ratio of `#7A909F` on the `#FFFFFF` card surface.
- **Observed Behavior:** **3.32:1** at an 11 px font size. WCAG AA requires 4.5:1 for text this small. Hint text is where the app puts its clarifying guidance — including, after BUG-002 is fixed, the salinity hint that becomes a safety-relevant instruction.
- **Expected Behavior:** ≥ 4.5:1. At 11 px there is no large-text exemption available.
- **Root-Cause Code Analysis:** `#7A909F` is a mid-grey selected for visual de-emphasis and then applied to genuinely informational text at the smallest size in the type scale, where the contrast requirement is strictest. The same token is reused at `tokens.ts:42` (icon colour), `:102` and `typography.ts:116`, so raising it lifts several surfaces at once. No contrast linting exists to catch it.
- **Developer Remediation / Fix Recommendation:** `#5B7286` gives **5.13:1** on `#FFFFFF` and preserves the hierarchy against `textSecondary`.

```diff
--- a/frontend/src/theme/colorRoles.ts
+++ b/frontend/src/theme/colorRoles.ts
@@
-    textTertiary: '#7A909F',
+    // 5.13:1 on #FFFFFF. Hints are informational text at 11px, the strictest size
+    // band in WCAG AA - the old #7A909F gave 3.32:1 (QA BUG-014).
+    textTertiary: '#5B7286',
```

```diff
--- a/frontend/src/theme/tokens.ts
+++ b/frontend/src/theme/tokens.ts
@@ input
-        helperColor: '#7A909F',
+        helperColor: '#5B7286',
```

Ship alongside BUG-006 as one accessibility pass. Re-check `theme/typography.ts:116` in the same change.

---

### [BUG-015] [Severity: P3] Header back button's effective touch target is 44.3 dp wide — below the 48 dp minimum

- **Affected Screen / Module:** Design system — `ScreenHeader` back affordance; present on every calculator screen and every stacked screen in the app
- **Source Code Location:**
  - `frontend/src/components/ui/ScreenHeader.tsx:50-55` — the back `TouchableOpacity`, `Icon size={24}`
  - `frontend/src/components/ui/ScreenHeader.tsx:97` — `const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 }`
  - `frontend/src/components/ui/ScreenHeader.tsx:111` — `back: { paddingBottom: 5 }`
- **Preconditions / App State:** Any screen rendering `ScreenHeader` with `onBack`; device 1080 × 2400 at 408 dpi effective (1 dp = 2.55 px).
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Daily Feed Amount**.
  2. Run `adb -s 21e2533f shell uiautomator dump` and read the back node's `bounds`.
  3. Convert to dp and add the 10 dp `hitSlop` on each edge.
- **Observed Behavior:** Visual target **24.3 × 29.0 dp**; effective target with `hitSlop` **44.3 × 49.0 dp**. The height clears 48 dp; the **width does not** (44.3 dp). Android Material accessibility guidance and WCAG 2.1 SC 2.5.5 both specify 48 × 48 dp. Measured alongside: input fields 46.3 dp tall and the Daily Feed `Calculate` button 47.8 dp tall — marginal, and worth folding into the same pass.
- **Expected Behavior:** ≥ 48 × 48 dp effective for every interactive element, back arrow included. Back is the primary escape affordance on a stacked screen and sits in the top-left corner — the hardest region to reach one-handed on a 6.7-inch device.
- **Root-Cause Code Analysis:** A 24 dp icon with a symmetric 10 dp `hitSlop` yields 44 dp, not 48 — the slop was sized by eye rather than derived from the target. `paddingBottom: 5` at `:111` is what pushes the *height* over the line while leaving the width short, so the shortfall is asymmetric and easy to miss in review.
- **Developer Remediation / Fix Recommendation:** Derive the slop from the target: a 24 dp icon needs 12 dp on each edge.

```diff
--- a/frontend/src/components/ui/ScreenHeader.tsx
+++ b/frontend/src/components/ui/ScreenHeader.tsx
@@
-const HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };
+// 24dp icon + 12dp each edge = 48dp, the Material / WCAG 2.5.5 minimum.
+// 10dp left it 44.3dp wide (QA BUG-015).
+const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
```

Raise the input and button minimums in the same pass: `tokens.ts` input height → `48`, and the Daily Feed `calcBtn` (`DailyFeedCalculatorScreen.tsx:334`) → `minHeight: 48`.

---

### [BUG-016] [Severity: P3] No test pins any calculator boundary — every defect above is unguarded in CI

- **Affected Screen / Module:** Test infrastructure — `frontend/src/screens/calculators/**`, `backend/src/shrimp-calculations/**`
- **Source Code Location:**
  - `frontend/src/screens/calculators/` — **no `__tests__` directory exists**, and no test file anywhere in `frontend/src` references any of the five calculator screens, though the project carries 20+ suites elsewhere (`src/features/__tests__/`, `src/components/ui/__tests__/`)
  - `backend/src/shrimp-calculations/shrimp-calculations.validation.spec.ts:41` — the repo's **only** `toxicityLevel` assertion, and it checks a mid-band value
- **Preconditions / App State:** Repository at `fbd05ba`; CI green.
- **Deterministic Steps to Reproduce (STR):**
  1. `ls frontend/src/screens/calculators/__tests__` → *No such file or directory*.
  2. `grep -rl "FreeAmmoniaScreen\|DailyFeedCalculatorScreen\|ProductAmountScreen\|CultivationPerformanceScreen" --include="*.test.*" frontend/src/` → no matches.
  3. `grep -rn "toxicityLevel" backend/src --include="*.spec.ts"` → one hit, `validation.spec.ts:41`, asserting `'warning'` for a mid-band input.
- **Observed Behavior:** Zero automated coverage of the ammonia band boundaries (0.1, 0.5), the SR clamp asserted by `calculation.dto.ts:32`, the client-side biomass step, and every validation guard on all five screens. CI is green with BUG-001 and BUG-008 both live in the tree.
- **Expected Behavior:** Each fixed defect leaves behind a test that fails if it returns. Boundaries in particular must be pinned on *both* sides.
- **Root-Cause Code Analysis:** Coverage was written where logic was expected to be interesting (`features/`, `components/ui/`) and skipped where it lives behind a network call. Because nothing pins the boundaries, BUG-001 survived a full screen redesign and BUG-008 survived the very comment that documents it.
- **Developer Remediation / Fix Recommendation:** Land these three suites with the fixes above; each is the direct regression guard for a ticket in this report.

```ts
// backend/src/shrimp-calculations/shrimp-calculations.boundary.spec.ts   [BUG-001, BUG-008]
describe('calculateFreeAmmonia - band boundaries', () => {
  const at = (tan: number) => service.calculateFreeAmmonia(tan, 8.2, 29, 15);

  it('bands on the DISPLAYED value, not the raw one', () => {
    // Both round to 0.1000 at 4dp; they must not disagree.
    expect(at(1.032).unionizedAmmonia).toBe(at(1.0323).unionizedAmmonia);
    expect(at(1.032).toxicityLevel).toBe(at(1.0323).toxicityLevel);
  });

  it('treats exactly 0.1000 as warning, matching the on-screen legend', () => {
    expect(at(1.0323).toxicityLevel).toBe('warning');
  });

  it('pins the far sides of both bands', () => {
    expect(service.calculateFreeAmmonia(5.2, 9, 32, 15).toxicityLevel).toBe('critical');
    expect(at(1.03).toxicityLevel).toBe('safe');   // 0.0998 -> safe
  });
});

describe('calculateSurvivalRate', () => {
  it('clamps to 100% as CalculateSurvivalRateDto:32 documents', () => {
    expect(service.calculateSurvivalRate(100_000, 150_000)).toBe(100);
    expect(service.calculateSurvivalRate(1_000, 999_999)).toBe(100);
  });
});
```

```ts
// frontend/src/screens/calculators/__tests__/validation.test.ts   [BUG-009, BUG-010, BUG-011, BUG-017]
it.each([
  ['abc',    'rejects a non-numeric optional area'],
  ['20abc',  'rejects a partially numeric value'],
  ['1e3',    'rejects scientific notation typed by hand'],
  ['Infinity', 'rejects a non-finite literal'],
])('%s -> validation error', (input) => { /* ... */ });
```

```ts
// frontend/src/theme/__tests__/contrast.test.ts   [BUG-006, BUG-014]
it('every text token clears WCAG AA 4.5:1 on its own background', () => {
  expect(ratio(tokens.input.placeholderColor, '#EEF2F5')).toBeGreaterThanOrEqual(4.5);
  expect(ratio(roles.light.textTertiary,      '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
});
```

Keep `maestro_tests/` as the end-to-end tier on top of these — the two layers guard different things, and the evidence flows named under each ticket are the handover point between them.

---

### [BUG-017] [Severity: P3] Numeric fields silently accept and truncate partially numeric input — `20abc` is computed as `20`

- **Affected Screen / Module:** All five calculator screens; demonstrated on `DailyFeedCalculatorScreen` — MBW (g)
- **Source Code Location:**
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:94-97` — `parseFloat` on all four inputs
  - `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:99-114` — guards test truthiness and sign, never numeric validity
  - Same pattern: `FreeAmmoniaScreen.tsx:66-68`, `ProductAmountScreen.tsx:28`, `CultivationPerformanceScreen.tsx:42-48`, `GrowthAndHarvestScreen.tsx`
- **Preconditions / App State:** Signed-in session; Daily Feed Amount screen. Reachable in the field by paste, voice input, or an external/physical keyboard — `keyboardType="decimal-pad"` is a soft-keyboard hint, not an input filter.
- **Deterministic Steps to Reproduce (STR):**
  1. Navigate to Settings → TOOLS → Calculators → **Daily Feed Amount**.
  2. Input `20abc` into **MBW (g)**.
  3. Input `80` Survival %, `100000` Stocking count, `3` Feeding rate %.
  4. Tap **Calculate**.
- **Observed Behavior:** No `Validation Error`. The app renders `Required Daily Feed 48.0 kg` and `Biomass 1,600` — identical to entering a clean `20`. The trailing `abc` is discarded silently; nothing indicates the input was truncated. Contrast TC-07: `abc!@#`, which has no numeric prefix, *is* correctly rejected — so the guard appears to work while only catching values that begin with garbage.
- **Expected Behavior:** A field declared numeric rejects a value that is not wholly numeric, with the same `MBW must be a positive number` alert `abc!@#` produces.
- **Root-Cause Code Analysis:** `parseFloat` is a *prefix* parser: it consumes the longest leading numeric substring and discards the rest, so `parseFloat('20abc') === 20`. The guards then test only `!mbw || mbw <= 0` (`:99`), which a valid prefix passes. Two further consequences of the same root cause: `parseFloat('1e3')` → `1000`, so a farmer typing scientific notation gets a silent 1000× reading; and `parseFloat('Infinity')` → `Infinity`, which passes `!mbw || mbw <= 0` and reaches the arithmetic. The correct test is `Number.isFinite` over a strict parse — which the backend already uses at `shrimp-calculations.controller.ts:124-130`.
- **Developer Remediation / Fix Recommendation:** Introduce one shared strict parser and route every calculator field through it.

```ts
// frontend/src/features/parseNumericInput.ts   (new)
/**
 * Strict numeric field parse. parseFloat is a PREFIX parser - "20abc" yields 20
 * and "Infinity" yields Infinity - so a field declared numeric silently accepts
 * values that are not numbers (QA BUG-017). Number() rejects trailing garbage
 * outright; Number.isFinite closes Infinity/NaN.
 */
export const parseNumericInput = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
};
```

```diff
--- a/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
+++ b/frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx
@@ handleCalculate
-        const mbw = parseFloat(mbwG);
-        const sr = parseFloat(srPct);
-        const count = parseFloat(initialCount);
-        const fr = parseFloat(feedingRatePct);
+        const mbw = parseNumericInput(mbwG);
+        const sr = parseNumericInput(srPct);
+        const count = parseNumericInput(initialCount);
+        const fr = parseNumericInput(feedingRatePct);

-        if (!mbw || mbw <= 0) {
+        if (mbw === null || mbw <= 0) {
```

`Number(' 20 ')` is `20`, so the whitespace tolerance TC-30 pins is preserved. Apply the same substitution at the four sibling screens listed above; ordering matters only in that BUG-009's `Number.isFinite` guard becomes redundant once `parseNumericInput` lands.

- **Regression guard:** `maestro_tests/36_sanitize_partial_parse.yaml` asserts today's silent truncation and must be inverted to expect the `Validation Error`.

================================================================================
# 4. CROSS-CUTTING AUDIT PILLARS

Each pillar states what was probed, how, what held, what broke, and which ticket
owns the break. A pillar with no ticket attached is a **verified clean pillar**,
not an unexamined one.

---

## 4.1 Arithmetic & Calculation Correctness

**Verdict: PASS — no arithmetic defect found. 2 latent risks documented.**

**Method.** Every expected value in §2 was derived from the server's own formulas
(`backend/src/shrimp-calculations/shrimp-calculations.service.ts`) and computed
independently **before** any flow ran, so the assertions test the app rather than
restate its output. 22 distinct valid-input cases across five calculators were
compared to the last displayed digit, including three re-run under a Hindi UI.

### Rounding strategy

| Quantity | Strategy in code | Source | Verified by |
|---|---|---|---|
| Daily feed | `Math.round(x*100)/100` → 2 dp, then `.toFixed(1)` for display | `service.ts:68`; `DailyFeedCalculatorScreen.tsx:248` | TC-02 (132.8125 → `132.81` → `132.8`) |
| Product dosage | `Math.round(x*100)/100` → 2 dp | `service.ts:264` | TC-08 |
| Free ammonia | `Number(nh3.toFixed(4))` → 4 dp | `service.ts:244` | TC-12/13/14 |
| FCR | `Math.round(x*100)/100` → 2 dp | `service.ts:35` | TC-17 (`1.50`) |
| ADG | `Math.round(x*1000)/1000` → 3 dp | `service.ts:50` | TC-17 (`0.167`) |
| Survival rate | `Math.round(x*10000)/100` → 2 dp | `service.ts:61` | TC-17 (`80.0`) |
| Expected harvest | `Math.round()` count, 2 dp kg | `service.ts:84-88` | TC-19 |
| Growth projection | `Math.round(x*100)/100` → 2 dp | `service.ts:104-113` | TC-20 |
| Biomass | `Math.round(x*100)/100` → 2 dp | `service.ts:121` | TC-21 |

Every rounded figure matched. **Display rounds a second time** (`toFixed(1)` over
an already-2-dp server value), which is correct here because it only ever
narrows, but it is worth knowing when reading a ticket: `132.81` is what the API
returns and `132.8` is what the farmer sees.

### Floating-point bounds

- `Math.round(x * 100) / 100` is binary-half-up, not decimal-half-up. `Math.round(1.005 * 100) / 100` returns **`1`**, not `1.01`, because `1.005` is stored as `1.00499999…`. **No test case in this audit landed on such a value, and none is reachable through the current calculator inputs** — but every rounding site in the service shares the idiom, so a future feature that rounds a currency or a dose at exactly the half is at risk. Recorded as a latent risk, not raised as a ticket, because it is not currently reachable.
- Past `Number.MAX_SAFE_INTEGER` (9 007 199 254 740 991) the displayed digits stop being exact. TC-31 drives biomass to 1.6 × 10¹⁸, well past that line — see **BUG-011**.

### Zero and negative divisors

| Divisor site | Guard | Behaviour at zero | Reachable from UI? |
|---|---|---|---|
| FCR — `feed / harvest` | `if (harvestWeightKg === 0) return 0` (`service.ts:35`) | returns `0` | No — client requires harvest > 0 |
| ADG — `Δw / days` | `if (daysOfCulture === 0) return 0` (`service.ts:49`) | returns `0` | No — client requires days > 0 |
| SR — `harvested / stock` | `if (initialStock === 0) return 0` (`service.ts:60`) | returns `0` | No — client requires seed > 0 |
| Productivity — `harvest / area` | `area > 0 ? … : null` (`CultivationPerformanceScreen.tsx:106`) | omits the metric | Yes — see **BUG-009** |
| Concentration — `(vol × ppm) / (conc × 10)` | `if (concentration && conc > 0)` (`ProductAmountScreen.tsx:58`) | skips the corrected line | No |

All divisors are guarded; none can produce `Infinity` or `NaN` through the UI.
Note that three of them **return `0` for an undefined quotient** — an FCR of `0`
is not "no data", it is a specific and very good FCR. Not reachable today because
the client validates first, so it is recorded rather than ticketed; if any of
these endpoints is ever consumed directly, `null` would be the honest return.

### Unit conversions

| Conversion | Site | Verified |
|---|---|---|
| g → kg (biomass) | `÷ 1000` — `DailyFeedCalculatorScreen.tsx:116`, `service.ts:121` | TC-01, TC-21 |
| m² × m → m³ (pond volume) | `ProductAmountScreen.tsx` volume preview | TC-08 (`5000 × 1.2 = 6000 m³`) |
| ppm → kg (g/m³ basis) | `(area × depth × ppm)/1000` — `service.ts:264` | TC-08 (`12.00 kg`) |
| % → fraction (SR, FR) | `÷ 100` throughout | TC-01, TC-17 |
| °C → K | `+ 273.15` — `service.ts:230` | TC-12/13/14 |
| ppt → molal ionic strength | `19.924·S/(1000 − 1.005·S)` — `service.ts:233` | TC-24 |
| Daily feed → per-meal | `÷ MEALS_PER_DAY (4)` — `DailyFeedCalculatorScreen.tsx:262` | TC-01 (`48.0 → 12.0`) |

No conversion error found. The en-IN digit grouping (`1,600`, `1,00,000`) renders
correctly via `toLocaleString('en-IN')` (`DailyFeedCalculatorScreen.tsx:256`) —
note this is **locale-hardcoded**, so it stays Indian-grouped under every UI
language, which is correct for the target market but is a fixed choice.

### Worked example — the BUG-001 boundary (pH 8.2 / 29 °C / 15 ppt)

```
I    = 19.924·15 / (1000 − 1.005·15)             = 0.303434
pKa  = 0.0901821 + 2729.92/302.15
       + (0.1552 − 0.0003142·29)·0.303434         = 9.169498
frac = 1 / (1 + 10^(9.169498 − 8.2))              = 0.09688371

TAN 1.032   -> 0.09998399  -> prints 0.1000, banded SAFE
TAN 1.0323  -> 0.10001306  -> prints 0.1000, banded WARNING
```

The model is correct to 4 dp across the full range tested, salinity term
included. **The arithmetic is not the defect — the band applied to it is.**

**Tickets from this pillar:** none for arithmetic. BUG-001 is a *classification*
defect on correct arithmetic; BUG-011 is a *bounds* defect on correct arithmetic.

---

## 4.2 Input Sanitization & Boundary Resilience

**Verdict: FAIL — 3 tickets. Rejection of wholly non-numeric input is solid; everything between "clean number" and "obvious garbage" leaks.**

| Probe | Input | Expected | Actual | Result | Ticket |
|---|---|---|---|---|---|
| Empty string, every required field | *(none)* | field-named alert, no result | correct alert, result suppressed | **PASS** (TC-03, TC-11, TC-16) | — |
| Leading/trailing whitespace | `" 20 "` | tolerated, identical to `20` | `48.0` kg — identical to TC-01 | **PASS** (TC-30) | — |
| Wholly non-numeric | `abc!@#` | rejected | `MBW must be a positive number` | **PASS** (TC-07) | — |
| SQL-shaped payload | `'; DROP TABLE ponds;--` | rejected client-side, never dispatched | rejected; no network call | **PASS** (TC-32) | — |
| **Partially numeric** | `20abc` | rejected | **silently truncated to `20`; renders `48.0` kg** | **FAIL** (TC-36) | **BUG-017** |
| **Max buffer / magnitude** | count `10²⁰` | bounded, or at least legible | **`48000000000000000.0 kg`; biomass clipped to `16,00,00,00…`** | **FAIL** (TC-31) | **BUG-011** |
| Negative magnitude | `-5` | rejected | `MBW must be a positive number` | **PASS** (TC-05) | — |
| Above-range percentage | SR `150`, conc `150`, pH `15` | field-named alert | correct alert in all three | **PASS** (TC-04, TC-10, TC-15, TC-18, TC-23) | — |
| **Above-range, client/server mismatch** | FR `150` | field-named alert | **no client guard; round-trip then generic error** | **FAIL** (TC-29) | **BUG-010** |
| **`NaN`-permeable optional field** | area `abc` | alert, or the metric | **neither — metric silently vanishes** | **FAIL** (TC-28) | **BUG-009** |

### Injection surface

The calculators are pure request/response over JSON — no SQL is constructed
client-side, and no calculator writes to the database. TC-32 confirms the SQL
payload is stopped at the client numeric guard and never dispatched, so it never
reaches the ORM. **No injection vector was found in the calculator surface.** This
is a statement about the five calculator screens only; the wider CRUD surface was
smoke-tested but not probed for injection (§6.1, §6.2).

### Root cause shared by BUG-017, BUG-009 and BUG-011

All three are the same shape: **the guards test the value, not the type or the
range.** `parseFloat` is a prefix parser, so `20abc → 20` and `Infinity → Infinity`
both survive `!x || x <= 0`; `NaN` fails every comparison, so `NaN <= 0` is false
and `NaN > 0` is false, meaning it slips through both a rejection guard and a
render gate; and no field anywhere carries an upper bound except the three
percentages. Fixing BUG-017's `parseNumericInput` closes BUG-009 as a side effect
and is the recommended sequencing.

---

## 4.3 UI/UX & Accessibility

**Verdict: FAIL — 3 tickets (2 contrast, 1 touch target). Keyboard handling and layout are clean.**

Measured with `adb -s 21e2533f shell uiautomator dump` plus screenshots, on the
device under test: 1080 × 2400 px at **408 dpi effective**, so **1 dp = 2.55 px**
and the 48 dp accessibility minimum is **122.4 px**.

### Touch target size (WCAG 2.1 SC 2.5.5 / Material: 48 × 48 dp)

| Element | Raw bounds (px) | Visual (dp) | + `hitSlop` | Verdict | Ticket |
|---|---|---|---|---|---|
| `ScreenHeader` Back | `[51,155][113,229]` | 24.3 × 29.0 | **44.3 × 49.0** | **FAIL (width)** | **BUG-015** |
| `Input` field | — | 46.3 tall | n/a | MARGINAL | BUG-015 |
| Daily Feed `Calculate` | — | 47.8 tall | n/a | MARGINAL | BUG-015 |
| Hub calculator rows | — | > 48 | n/a | PASS | — |

The back arrow is the primary escape affordance on every stacked screen and sits
in the top-left corner — the least reachable region one-handed on a 6.7-inch
handset — so a 3.7 dp width shortfall matters more there than the number suggests.

### Contrast (WCAG 2.1 AA — 4.5:1 for text below 18.66 px bold / 24 px regular)

| Foreground | Background | Ratio | Size | Verdict | Ticket |
|---|---|---|---|---|---|
| `#A3B5BF` placeholder | `#EEF2F5` input | **1.88:1** | 15 px | **FAIL** | **BUG-006** |
| `#7A909F` hint / helper | `#FFFFFF` card | **3.32:1** | 11 px | **FAIL** | **BUG-014** |
| `textSecondary` | `#FFFFFF` | 8.20:1 | — | PASS | — |
| `textPrimary` | `#FFFFFF` | 16.06:1 | — | PASS | — |

Both failures are informational text wearing a de-emphasis colour that was
designed for *disabled* chrome. The placeholder failure is the more consequential
of the two: on the calculator screens the placeholders (`28700`, `3.2`, `18.4`)
are the only worked examples of the expected magnitude and unit, and the target
user is frequently reading the screen outdoors.

### Keyboard obstruction over input fields

**PASS.** With the IME open on the MBW field (the topmost input, worst case for
push-down), the screenshot and hierarchy dump agree:

| Element | y-range (px) |
|---|---|
| `Calculate` CTA | 1188 – 1310 |
| IME top edge | ≈ 1560 |

A **250 px (≈ 98 dp) clear gap** — the primary CTA is reachable without dismissing
the keyboard. The `ScrollView` also scrolls the focused field into view. No
obstruction found on any of the five calculators.

### Label clipping and overflow

| Site | Behaviour | Verdict |
|---|---|---|
| Result headline (`DailyFeedCalculatorScreen.tsx:247`, `FreeAmmoniaScreen.tsx:189`, `ProductAmountScreen.tsx:144`) | `numberOfLines={1}` **+ `adjustsFontSizeToFit minimumFontScale={0.5}` | **PASS** — shrinks |
| `StatRow` value (`StatRow.tsx:57`) | `numberOfLines={1}`, **no** `adjustsFontSizeToFit` | **FAIL** — ellipsises, dropping a number's least significant digits with no visual cue (**BUG-011**) |
| `StatRow` caption (`StatRow.tsx:64`) | `numberOfLines={1}` on an uppercase label | acceptable — captions are fixed strings |

The inconsistency is the finding: the same screen shrinks its headline and clips
its stats, so a figure too large for the column silently becomes a different,
plausible-looking figure.

### Stability

`logcat -b crash` is **empty for the entire session** — 37 flows, 5 screens,
including the 10²⁰ magnitude case and a rapid double-submit. No crash, no ANR, no
hang. The only device log noise is a benign OEM `OplusScrollToTopManager` warning.

---

## 4.4 Idempotency & Race Conditions

**Verdict: PASS — no state corruption or duplicate submission observed.**

| Probe | Method | Expected | Actual | Result |
|---|---|---|---|---|
| Rapid double-tap on `Calculate` | `tapOn: {text: Calculate, repeat: 2, delay: 50}` (TC-33) | second tap swallowed; exactly one result; no error dialog | one result `48.0`; no `Validation Error`; no error dialog | **PASS** |
| Stale-result invalidation | edit any input after a result renders | prior result cleared | cleared — `useEffect` at `DailyFeedCalculatorScreen.tsx:88-91` | **PASS** |
| Re-submit with the same payload | TC-01 run twice in one session | identical output | identical | **PASS** |
| Concurrent multi-endpoint fan-out | Cultivation Performance fires 4 calls in one `Promise.all` (`:83`) | all-or-nothing | all-or-nothing; no partial render | **PASS** (but see **BUG-012**) |

**Debounce mechanism, as implemented.** Two independent guards exist and neither
is a timer:

1. `DailyFeedCalculatorScreen.tsx:232-234` — the `TouchableOpacity` takes `disabled={isLoading}` and a `calcBusy` style.
2. The other four screens use the shared `Button`, which computes `isDisabled = disabled || loading` and applies it to both the press handler and the visual state.

**Residual risk, not currently reproducible.** `setIsLoading(true)` runs at
`DailyFeedCalculatorScreen.tsx:122`, *after* the five synchronous validation
guards at `:99-119`. React batches the state update, so there is a theoretical
window in which a second tap dispatched before the re-render is not yet blocked.
A 50 ms double-tap did not hit it, and the calculators are idempotent —
they mutate no server state, so a duplicate submission costs a wasted request and
nothing more. **No ticket raised**; recorded so that the analysis is not
re-done if a *mutating* screen (Feed Log, Stocking) is ever given the same
pattern, where the same window would cost a duplicate record.

---

## 4.5 Localization (i18n)

**Verdict: FAIL — 1 ticket. Translation infrastructure is complete and the arithmetic is locale-independent; string externalisation is not.**

Six locales ship: English, हिन्दी (Hindi), বাংলা (Bengali), தமிழ் (Tamil),
తెలుగు (Telugu), ଓଡ଼ିଆ (Odia).

| Check | Method | Result |
|---|---|---|
| **Translation-key parity** | key-set diff, 27 namespace files × 6 locales | **0 missing, 0 extra** — PASS |
| **Runtime rendering** | switch to Hindi, walk the calculator surface (TC-34) | `टूल्स और कैलकुलेटर`, `उत्पादन प्रदर्शन`, `दैनिक आहार मात्रा`, `उत्पाद खुराक`, `वृद्धि और कटाई`, `कुल बीज (संख्या)` all correct — PASS |
| **Hardcoded strings** | literal scan of the five calculator screens | **39 found** — 28 `placeholder="…"` attributes + 11 unit/range literals — **FAIL, BUG-013** |
| **Layout overflow under longer scripts** | visual inspection under Hindi | no clipping, no wrapping breakage, no overlapping labels — PASS |
| **Language switch persistence** | switch to Hindi, cold restart, switch back (TC-35) | persists across `stopApp`/`launchApp`; restores cleanly — PASS |
| **Number formatting under locale** | `toLocaleString('en-IN')` (`DailyFeedCalculatorScreen.tsx:256`) | hardcoded en-IN grouping regardless of UI language — correct for the market, but a fixed choice, not a localised one |
| **Cross-locale arithmetic** | re-run TC-01, TC-02 and TC-17's payloads under Hindi (TC-37/38/39) | **every figure reproduces to the last digit** — `48.0`/`1,600`/`12.0`, `132.8`/`5,313`/`33.2`, FCR `1.50`/ADG `0.167`/SR `80.0`. Decimal separator stays `.`; grouping stays `1,600` — PASS |

**The finding is narrow and precise.** The locale files are complete and the
runtime works — this is not a missing-translation problem. Every *label* on these
screens routes through `t()`; every *placeholder* was written as a literal JSX
attribute at all 28 sites, so a Hindi-speaking farmer sees Hindi labels wrapping
English hints that still carry the English abbreviation "e.g.". Fixing it is
mechanical and is specified in **BUG-013**, along with a `grep`-based CI guard so
new literals cannot land.

**The "single locale" limitation on the arithmetic assertions is therefore
closed.** The figures are not locale-dependent; only the *strings* are, and that
is BUG-013.

One overlap worth flagging to whoever takes BUG-001: the literal
`0.1 – 0.5 ppm` at `FreeAmmoniaScreen.tsx:207` is both an un-externalised string
*and* the third of the three disagreeing definitions of the ammonia band
boundary. Externalising it and fixing the boundary should be the same change.

---

## 4.6 Data Prefill & Derived-State Integrity

**Verdict: FAIL — 2 tickets (BUG-018, BUG-019). This surface was dark for the whole first phase of the audit.**

The account owned 0 stocked ponds, so `PondPicker` and `applyContext` could not be
reached at all. Seeding one pond with an active cycle (§6.3) opened the surface
and it failed immediately.

| Field | Source | Prefilled? | Verdict |
|---|---|---|---|
| Count | `ctx.crop.stockingCount` | `500000` | **Correct** |
| Pond Area | `round(ctx.areaM2)` | `5000` | Correct value, but the field is inert (**BUG-005**) |
| **SR (%)** | `round(livePopulation / stockingCount × 100)` | **`100`** | **FABRICATED — BUG-019** |
| **MBW (g)** | `ctx.abwG` | **empty** (renders its `18.4` placeholder) | Correctly not filled — but the banner says otherwise (**BUG-018**) |
| Feeding rate | *(not prefilled by design — "typed by you")* | empty | Correct |

**The pattern is one bug wearing two faces: the app cannot distinguish "no data"
from "a value that happens to compute".** `livePopulation` is present and equal to
`stockingCount` on any pond with no mortality logged, so survival computes to a
clean `100 %`. The guard asks *is the field non-null?* rather than *has anyone
measured this?*. MBW, biomass and FCR are gated on `abwG` — genuinely null without
a sampling — which is why those three correctly render `—` and survival does not.

The clearest evidence is the pond dashboard itself, which renders

```
—        100        —        —
MBW G   SURVIVAL %  BIOMASS KG   FCR
```

directly above the card *"**No sampling yet** — Biomass, FCR and survival are
worked out from the average weight in a sampling."* Survival is the only
populated stat, carrying a value the very next sentence says cannot be known. That
is the same shape of self-contradiction as BUG-001, on a different screen.

**Downstream cost.** Biomass = `count × SR/100 × MBW/1000`. Carrying a real 80 %
survival as 100 % over-estimates biomass — and therefore the daily feed figure the
screen exists to produce — by **25 %**. Over-feeding is not neutral: uneaten feed
decays to ammonia, the exact quantity the Free Ammonia calculator warns about.

**Untested branches.** Only one pond shape was exercised: day 1, stocked, no
sampling. A pond *with* a sampling, a mid-cycle pond, and one with logged
mortality each take a different path through `applyContext` and remain untested
(§6.2 note 5).

================================================================================
# 5. PRIORITIZED DEVELOPER ACTION PLAN

Three phases. Phase 1 is the release gate; Phases 2 and 3 ship on the normal
cycle. Every row names the file the developer opens first, so no triage step is
needed between reading this and starting work.

---

## Phase 1 — Release Blockers (Immediate Fix Required)

**Gate condition: the build is CONDITIONAL GO. It becomes GO when all three
tickets below are fixed, their evidence flows are inverted, and TC-12 / TC-14 /
TC-24 still pass.**

There are **no P0 tickets** — nothing crashes, hangs, or loses data. All three
blockers are P1: each presents a fabricated or self-contradictory figure as
measured data, on a surface a farmer acts on.

| # | Ticket | Target files | Change | Est. |
|---|---|---|---|---|
| 1 | **BUG-001** — same printed value under opposite toxicity bands; SAFE copy contradicts the figure above it | `backend/src/shrimp-calculations/shrimp-calculations.service.ts:239-244`<br>`frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/calculators.ts:136` | Round once, then band the rounded value; align server / client-fallback / legend on "0.1 starts WARNING"; reword `safeMessage` | ~1 h + review |
| 2 | **BUG-002** — salinity labelled "For reference only" while moving the result +9.6 % | `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/calculators.ts:130`<br>`frontend/src/screens/calculators/FreeAmmoniaScreen.tsx:60` | Rewrite the hint to state that it affects the result; drop the `'15'` default | ~1 h + translation |
| 3 | **BUG-019** — un-sampled pond reports 100 % survival; every derived biomass and feed figure over-estimated | `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:77-81`<br>`frontend/src/screens/ponds/PondDashboardScreen.tsx` (SURVIVAL % stat) | Gate the survival figure on a sampling existing (`ctx.abwG != null`); render `—` otherwise, as MBW/biomass/FCR already do | ~2 h + review |

**All three are small and well-isolated** — one service method, one i18n string
across six locales, and one guard in `applyContext`. None requires an
architectural change, a migration, or a native rebuild (the fix ships as an OTA
JS bundle plus a backend deploy).

### Phase 1 exit checklist

- [ ] `service.ts` bands `Number(nh3.toFixed(4))`, not the raw double.
- [ ] Server (`>= 0.1`), client fallback (`FreeAmmoniaScreen.tsx:16`) and the on-screen legend (`:203`, `:207`) all place `0.1` in the **same** band.
- [ ] `safeMessage` no longer asserts a bound that `0.1000` violates — all six locales.
- [ ] `hintSalinity` states that salinity affects the result — all six locales.
- [ ] Salinity no longer defaults to `15`.
- [ ] `maestro_tests/26_*.yaml` **inverted** to expect `WARNING (Server)` at TAN `1.032`, and passing.
- [ ] `maestro_tests/27_*.yaml` still passing.
- [ ] `maestro_tests/24_*.yaml` still passing (it clears salinity explicitly, so it survives the default change).
- [ ] `maestro_tests/12_*.yaml` (`0.1453` WARNING) and `14_*.yaml` (`0.0025` SAFE) still passing — proof the band change did not move a mid-band verdict.
- [ ] The boundary unit test from **BUG-016** landed and green.
- [ ] Survival is **not** prefilled, and the dashboard shows `—`, on a stocked pond with no sampling.
- [ ] `maestro_tests/41_prefill_dailyfeed.yaml` **inverted** (no `100` prefill) and passing.

---

## Phase 2 — UX & Edge Stability

All P2 tickets. Every one is either a materially misleading output or an
unvalidated public API surface. None blocks the gate; all should land in the
current sprint.

| # | Ticket | Target files | Change |
|---|---|---|---|
| 4 | **BUG-003** — dosage headline ignores product concentration; a 50 % product is under-dosed 2× | `frontend/src/screens/calculators/ProductAmountScreen.tsx:143-155`<br>`frontend/src/i18n/locales/*/calculators.ts` (new `activeIngredientBasis` key) | Promote the concentration-corrected figure to the headline; demote the 100 %-basis value |
| 5 | **BUG-004** — `recommended-feeding-rate` returns 1.8 % / 10 % for junk, empty and negative input | `backend/src/shrimp-calculations/shrimp-calculations.controller.ts:136-147` | Mirror the `biomass` handler's `Number.isFinite` guard ten lines above |
| 6 | **BUG-005** — Daily Feed "Pond Area" is editable, clears the result, affects nothing | `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:59,82,91,220-228` | Report stocking density from it, **or** remove the field entirely |
| 7 | **BUG-006** — placeholder contrast 1.88:1, far below WCAG AA | `frontend/src/theme/tokens.ts:37` | Dedicated placeholder token at `#5B7286` (4.63:1) |
| 8 | **BUG-018** — "Filled from the pond" banner shown even when the required MBW field was not filled | `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:74` | Set `prefilled` from what was actually written (`ctx.abwG != null`), not from a payload arriving |

**Sequencing note.** Ship **BUG-006 together with BUG-014** as a single
accessibility pass — they touch adjacent tokens in `tokens.ts` / `colorRoles.ts`
and want one visual QA sweep, not two.

**Regression flows to invert in this phase:** `09_dosage_with_concentration.yaml`
(BUG-003), `25_dailyfeed_pond_area_inert.yaml` (BUG-005),
`41_prefill_dailyfeed.yaml` (BUG-018 — shared with BUG-019 in Phase 1, so invert
it once, when both land).

**Sequencing note.** BUG-018 and BUG-019 touch the same 12 lines of
`applyContext`. Ship them together even though they sit in different phases.

---

## Phase 3 — Polishing & Technical Debt

All P3 tickets, grouped by the work they naturally batch into.

### 3a — Input validation hardening (one PR)

| # | Ticket | Target files |
|---|---|---|
| 9 | **BUG-017** — `20abc` silently computed as `20`; `Infinity` passes every guard | `frontend/src/features/parseNumericInput.ts` *(new)*; all five calculator screens |
| 10 | **BUG-009** — non-numeric optional Pond Area silently deletes the Productivity metric | `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:74` |
| 11 | **BUG-010** — feeding rate lacks the server's `@Max(100)` client-side | `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:111` |
| 12 | **BUG-011** — no ceiling on stocking count; renders 4.8 × 10¹⁶ kg and clips the biomass stat | `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:106-114`<br>`frontend/src/components/ui/StatRow.tsx:57` |

> **Do BUG-017 first.** Its shared `parseNumericInput` closes BUG-009 as a side
> effect, and BUG-010 and BUG-011 are then one-line range additions on top of a
> parser that already returns a real number or `null`.

**Regression flows to invert:** `36_sanitize_partial_parse.yaml` (BUG-017),
`28_performance_nonnumeric_area.yaml` (BUG-009),
`29_dailyfeed_feedrate_over_100.yaml` (BUG-010),
`31_sanitize_max_buffer.yaml` (BUG-011).

### 3b — Accessibility (one PR — batch with BUG-006 from Phase 2)

| # | Ticket | Target files |
|---|---|---|
| 13 | **BUG-014** — hint/helper text at 3.32:1 | `frontend/src/theme/colorRoles.ts:17`; `frontend/src/theme/tokens.ts:40` |
| 14 | **BUG-015** — back button's effective target 44.3 dp wide | `frontend/src/components/ui/ScreenHeader.tsx:97`; input & button min-heights |

### 3c — API contract cleanup (one PR, backend-only)

| # | Ticket | Target files |
|---|---|---|
| 15 | **BUG-007** — `FreeAmmoniaDto.ph` unbounded above | `backend/src/shrimp-calculations/dto/advanced-calculations.dto.ts:29-31` |
| 16 | **BUG-008** — DTO documents an SR clamp the service never implements | `backend/src/shrimp-calculations/shrimp-calculations.service.ts:59-62`; `dto/calculation.dto.ts:32` |

### 3d — Dead code and i18n

| # | Ticket | Target files |
|---|---|---|
| 17 | **BUG-012** — 4th API call per calculation, never rendered | `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:24,97-103,113` |
| 18 | **BUG-013** — 39 hardcoded English strings survive a language switch | all five calculator screens; six `calculators.ts` locale files; CI `grep` guard |

**Regression flow to invert:** `34_i18n_hindi_calculators.yaml` (BUG-013).

### 3e — Test debt (do this last; it absorbs the guards from every phase above)

| # | Ticket | Target files |
|---|---|---|
| 19 | **BUG-016** — no test pins any calculator boundary | `backend/src/shrimp-calculations/shrimp-calculations.boundary.spec.ts` *(new)*<br>`frontend/src/screens/calculators/__tests__/validation.test.ts` *(new)*<br>`frontend/src/theme/__tests__/contrast.test.ts` *(new)* |

---

## Consolidated ticket index

| Ticket | Sev | Module | Phase | Primary file |
|---|---|---|---|---|
| BUG-001 | **P1** | Free Ammonia | **1** | `backend/src/shrimp-calculations/shrimp-calculations.service.ts:239` |
| BUG-002 | **P1** | Free Ammonia | **1** | `frontend/src/i18n/locales/en/calculators.ts:130` |
| BUG-003 | P2 | Product Dosage | 2 | `frontend/src/screens/calculators/ProductAmountScreen.tsx:143` |
| BUG-004 | P2 | Shared API | 2 | `backend/src/shrimp-calculations/shrimp-calculations.controller.ts:136` |
| BUG-005 | P2 | Daily Feed | 2 | `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:220` |
| BUG-006 | P2 | Design system | 2 | `frontend/src/theme/tokens.ts:37` |
| BUG-007 | P3 | Free Ammonia (API) | 3c | `backend/src/shrimp-calculations/dto/advanced-calculations.dto.ts:29` |
| BUG-008 | P3 | Shared API | 3c | `backend/src/shrimp-calculations/shrimp-calculations.service.ts:59` |
| BUG-009 | P3 | Cultivation Perf | 3a | `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:74` |
| BUG-010 | P3 | Daily Feed | 3a | `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:111` |
| BUG-011 | P3 | Daily Feed / StatRow | 3a | `frontend/src/components/ui/StatRow.tsx:57` |
| BUG-012 | P3 | Cultivation Perf | 3d | `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:97` |
| BUG-013 | P3 | i18n | 3d | 5 calculator screens + 6 locale files |
| BUG-014 | P3 | Design system | 3b | `frontend/src/theme/colorRoles.ts:17` |
| BUG-015 | P3 | Design system | 3b | `frontend/src/components/ui/ScreenHeader.tsx:97` |
| BUG-016 | P3 | Test infrastructure | 3e | 3 new spec files |
| BUG-017 | P3 | All calculators | 3a | `frontend/src/features/parseNumericInput.ts` *(new)* |
| BUG-018 | P2 | Pond prefill | 2 | `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:74` |
| BUG-019 | **P1** | Pond prefill / PondDashboard | **1** | `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:77` |

---

## How to re-run the suite after a fix

```bash
# single flow
maestro --device 21e2533f test ./maestro_tests/26_ammonia_boundary_safe_side.yaml

# whole suite, sequentially. The [0-9]* glob deliberately excludes
# _nav_to_hub*.yaml (subflows) and _seed_*.yaml (one-time production writes).
for f in ./maestro_tests/[0-9]*.yaml; do
  maestro --device 21e2533f test "$f"
done
```

Flows **40, 41, 43 and 44 require a stocked pond** (`QA-AUDIT-POND`, §6.3). It is
being **kept** on the account by the owner's decision, so these flows run as-is.
Only if it is ever deleted must `_seed_01_create_pond.yaml` and
`_seed_02_start_cycle.yaml` be re-run first — **those two write to production.**

**Preconditions** (from `maestro_tests/README.md`): the device must be signed in
(every calculator is behind `JwtAuthGuard`), the backend must be reachable
(`curl https://api.upcheck.in/api/health`), and `expo-updates` runs
`CHECK_ON_LAUNCH=ALWAYS`, so the first `launchApp` after an OTA publish may swap
the JS bundle underneath the run — re-run the suite once the new bundle is live.

**Eleven of the 45 flows are evidence flows.** They assert defective behaviour on
purpose and pass today. Each ticket above names the flow that must be **inverted**
when its fix lands; a flow that starts failing after a fix is the fix working, not
a regression. Update `maestro_tests/README.md`'s flow index in the same PR.

================================================================================
# 6. SCOPE, COVERAGE AND HARNESS NOTES

This section states the **boundary of the sign-off**. Read it before treating
§1's CONDITIONAL GO as covering the whole application — it does not, and this
section says exactly where it stops.

---

## 6.1 What was exercised, and how

| Surface | Depth | Evidence |
|---|---|---|
| **The five calculators + hub** | **Exhaustive.** Every valid path, every validation guard, both sides of every band boundary, and the cross-cutting pillars | TC-00 … TC-41 |
| **Pond prefill path** (`PondPicker`, `applyContext`) | **Exercised**, after seeding a stocked pond | TC-40, TC-41 |
| **Settings TOOLS / FARM / ABOUT** | **Smoke** — opens, renders its own content, no error | TC-42 (9 routes) |
| **All six bottom tabs** | **Smoke** | TC-43 |
| **Pond log & history surface** | **Smoke** (7 routes) | TC-44 |
| **Farm → pond navigation, pond & cycle creation** | **Exercised** as a by-product of seeding | `_seed_01`, `_seed_02` |
| **Backend calculation service** | Source review + local re-execution of the exact functions | BUG-004, 007, 008 |

**Route coverage: ~33 of the 105 registered routes** in
`frontend/src/navigation/RootNavigator.tsx` were opened on the device.

**The smoke contract is deliberately narrow.** TC-42/43/44 assert only that a
screen opens, renders a string unique to itself, and shows no crash or error
state. They do **not** assert business output, do **not** submit any form, and do
**not** verify that anything persists. "Smoke-tested" in this report means *the
screen loads* — nothing more.

> **Correction to this audit's scoping rationale.** An earlier draft claimed the
> five calculators are *"the only screens that take free numeric input and render
> a computed number"*. **That is wrong**, and it under-states the gap. A source
> sweep for computed output found falsifiable arithmetic on at least these
> screens, none of which had its output checked:
>
> | Screen | Computed output | Source |
> |---|---|---|
> | `MoneyScreen` | ₹ abbreviation with a different rounding rule per magnitude band (`Cr` 2 dp / `L` 1 dp / thousands `Math.round`), category totals via `reduce`, **profit margin `round(profit/revenue × 100)`** | `screens/finance/MoneyScreen.tsx:76-79,184,198,215,435` |
> | `ExpensesScreen` | `₹${value.toFixed(2)}` on every row and total | `screens/finance/ExpensesScreen.tsx:33` |
> | `FeedHistoryScreen` | `totalFeed` summed via `reduce`, rendered to 1 dp | `screens/logs/History/FeedHistoryScreen.tsx:56,101` |
> | `MortalityHistoryScreen` | `totalMortality` summed via `reduce` — the figure that drives `livePopulation`, and therefore **BUG-019** | `screens/logs/History/MortalityHistoryScreen.tsx:119` |
> | `CycleDetailScreen` | DOC as `round((end − start) / 86_400_000)` — a day count over a DST-naive millisecond division | `screens/cycles/CycleDetailScreen.tsx:89` |
> | `PondDashboardScreen` | the four headline stats, incl. the survival figure of **BUG-019** | `screens/ponds/PondDashboardScreen.tsx` |
>
> The money surface in particular computes money — magnitude-banded rounding and
> a division by `revenue` are exactly the shapes that produced BUG-001 and
> BUG-011 in the calculators. **None of it has been tested.** Treat "the
> arithmetic is correct" in §1.3 as scoped strictly to the five calculators.

---

## 6.2 What was NOT covered — the honest gaps

**1. ~72 routes remain unexercised.** They fall into three groups:

| Group | Count (approx.) | Why not run |
|---|---|---|
| Auth & onboarding — `Login`, `Register`, `ForgotPassword`, `ResetPassword`, `OtpLogin`, `OtpCallback`, `Truecaller*`, `TwoFactor*`, `Welcome`, `Intent`, `JoinFarm` | ~15 | Reaching them requires signing out. The session is the audit's only credential and there is no way to restore it unattended, so exercising them would have ended the audit. **These are entirely untested.** |
| Screens needing data this account still lacks — `HarvestLog`/`HarvestHistory`, `DiseaseLog`, `TreatmentLog`, `MortalityLog`, `PlanktonLog`, `MicrobiologyLog`, `ChemicalLog`, `CropPnl`, `CycleAnalysis`, `Transactions`, `MemberDetail`, `InventoryDetail`, `FeedStats`, … | ~45 | Each needs its own seeded records (a harvest, a disease event, a transaction). Seeding them means more production writes; only the minimum needed for prefill was authorised. |
| Deeper engine screens — `MorningBriefing`, `WeeklyChemistry`, `DiseaseRisk`, `HarvestTiming`, `HarvestPlans`, `SimulationResults`, `Aeration` | ~12 | Reachable, but they consume pond history (sampling series, feed logs) that a day-1 pond does not have; they would render empty states, not their real behaviour. |

**2. The API was never tested directly — this gap could not be closed.**
`adb shell run-as com.upcheck.app` returns **"package not debuggable"**: the
installed APK is a release build, so the JWT cannot be extracted from app-private
storage on this non-rooted device. Consequently:

> Every "the server computed X" statement in this report is **inferred from what
> the screen rendered**, not observed on the wire.

For BUG-004, BUG-007 and BUG-008 — which are API-surface defects not reachable
through the UI — the evidence is source analysis **plus local re-execution of the
exact service function**, not a live request. Closing this properly needs one of:
a debug build, an intercepting proxy with a trusted CA installed, or a
service-account token issued by the backend team. **This is the single largest
remaining gap and it is a request back to the dev team.**

**3. Single device.** All 45 flows ran on one OPPO CPH2467 (Android 15, 1080×2400,
408 dpi effective). No tablet, no small-screen phone, no older Android, no
low-memory device. The touch-target and contrast measurements in §4.3 are
density-specific to this handset.

**4. Locale — now closed for arithmetic, open elsewhere.** TC-37/38/39 re-ran the
three arithmetic anchors under Hindi and every figure reproduced to the last
digit, so **the arithmetic is not locale-dependent**. The en-IN grouping is stable
because `toLocaleString('en-IN')` is hardcoded rather than following the UI
language. Bengali, Tamil, Telugu and Odia were **not** exercised at runtime; only
the key-parity check (§4.5, 0 missing / 0 extra) covers them.

**5. Prefill is tested for one shape of pond only** — day 1, stocked, no sampling.
That shape is what exposed BUG-018 and BUG-019. A pond *with* a sampling, a
mid-cycle pond, and a pond with logged mortality would each exercise a different
branch of `applyContext` and remain untested.

---

## 6.3 Production data written during this audit

The audit was originally read-only. To reach the prefill path (§6.2 note 5) the
repo owner explicitly authorised writes to the **live** `api.upcheck.in` account.

| Object | Value | Created by |
|---|---|---|
| Pond | **`QA-AUDIT-POND`** on farm `1` — 100 m × 50 m × 1.5 m, 5000 m² | `maestro_tests/_seed_01_create_pond.yaml` |
| Cycle | **`Cycle 1`**, active, stocked 30 Aug 2026, **500 000 PL**, species Vannamei | `maestro_tests/_seed_02_start_cycle.yaml` |

> **RETAINED — no cleanup pending.** The account owner has decided these records
> stay. `QA-AUDIT-POND` and its cycle are therefore a **permanent test fixture**,
> not outstanding debt, and flows **40, 41, 43 and 44 depend on them existing**.
>
> Two consequences the dev team should know:
> - The farm permanently reports `1 FARM · 1 POND` and `1 of 1 stocked`. Any
>   dashboard, report or aggregate read from this account includes a pond that
>   exists for testing, not for farming. Exclude it before quoting production
>   numbers from this account.
> - The pond has an **active cycle with no sampling and no mortality logged**,
>   which is exactly the state that exposes **BUG-019** (survival reported as
>   100 %). It will keep showing that until a sampling is logged against it — so
>   it doubles as a standing reproduction case for the P1 blocker.
>
> Should it ever be removed, delete the cycle first, then the pond
> (Farm → `1` → `QA-AUDIT-POND` → Edit), and re-run both seed flows before
> flows 40/41/43/44.

Both seed files are **underscore-prefixed** so the `[0-9]*.yaml` suite glob never
picks them up — re-running the suite will not create duplicates. Nothing else in
the suite mutates anything: the calculators are pure request/response, and no
flow logs data, edits a record, or writes to the account.

---

## 6.4 Harness notes — reproduction hazards

Recorded so the suite can be re-run and so the weight of the results is clear.
Items 7–9 were discovered during this session and cost real time.

1. **The app OTA-updates itself.** `expo-updates` runs `CHECK_ON_LAUNCH=ALWAYS`, so the first `launchApp` after a publish swaps the JS bundle and can change the entire UI mid-run (§1.4). Expect the first launch after an OTA to behave differently from the rest.
2. **`launchApp` does not reset navigation.** Without a preceding `stopApp` each flow starts wherever the last one finished. `_nav_to_hub.yaml` always stops the app first.
3. **Maestro full-matches selectors as regexes.** `"Free Ammonia"` does not match `Free Ammonia (NH₃)`. Result assertions use `.*value.*` because React Native flattens a nested unit `<Text>` into the parent's accessibility text.
4. **`\.` is invalid inside a double-quoted YAML scalar.** Fourteen flows initially failed to parse for this reason; they are single-quoted, which preserves the backslash and keeps the regex precise. That was a fault in the test files, not the app.
5. **`hintText` survives once a field has content.** Android keeps the hint attribute on a populated `EditText`, so a placeholder selector never stops matching the first field. The two `0.0` fields on Cultivation Performance need `index: 0` **and** `index: 1`. The same behaviour is what makes an empty field detectable: an `EditText` whose `text` equals its placeholder is empty (this is how BUG-018's empty MBW was proven).
6. **`assertVisible` means visible in the viewport**, not present in the tree. Results under the fold need a `scroll` first.
7. **`scrollUntilVisible` without `centerElement: true` can leave a row underneath the floating bottom tab bar — and the tap then hits the centre "Quick log" FAB instead.** This produced a convincing false positive during the route sweep: tapping *All Workers* appeared to open *Quick Log*. Re-probing with `centerElement: true` opened All Workers correctly. **Every scroll in TC-42/44 sets `centerElement: true`.** Any "wrong screen opened" result from this suite must be re-probed this way before it is filed as a defect.
8. **ColorOS silently uninstalls `dev.mobile.maestro.test`.** The instrumentation APK was removed repeatedly by the OEM package scanner (`SG::UmsScanner`, then `PACKAGE_FULLY_REMOVED`). Maestro then fails **every** run with `AndroidDriverTimeoutException: Maestro Android driver did not start up in time`, which looks like a device or network fault and is not. Fix: extract both APKs and reinstall — they ship inside `maestro-client.jar`:
   ```bash
   unzip -o -j /c/maestro/lib/maestro-client.jar "*.apk" -d /tmp/mextract
   adb -s 21e2533f install -r -t /tmp/mextract/maestro-app.apk
   adb -s 21e2533f install -r -t /tmp/mextract/maestro-server.apk
   ```
   The suite runner checks for **both** packages before every flow and reinstalls if either is missing. Reinstalling only `dev.mobile.maestro` is not enough — the driver needs the `.test` instrumentation.
9. **The screen sleeping mid-suite silently fails everything after it.** Maestro cannot see past the lockscreen, so every subsequent assertion fails against a screen it never reaches. Set `svc power stayon usb` and a long `screen_off_timeout` before a long run; the runner also wakes and dismisses the lockscreen before each flow.
   > **Device setting changed by this audit:** `screen_off_timeout` was set to `1800000` (30 min) and `svc power stayon usb` enabled, and the original value was not captured beforehand. **Restore your preference in Settings → Display.**
10. **Maestro's on-device driver intermittently drops its gRPC channel** (`StatusRuntimeException: UNAVAILABLE`), and navigation occasionally flakes. The runner therefore retries each flow once and records both attempts, so a retry cannot silently mask a real failure. TC-39 passed only on retry; its first attempt died on a navigation flake, not a product defect.
11. **Concurrent Maestro processes corrupt a run.** Never run two flows against one device at once. Killing Maestro with `taskkill /F` also leaves stale adb port-forwards and a wedged driver — clear with `adb forward --remove-all` and reinstall the driver (note 8).
12. **`uiautomator dump` collides with a running Maestro driver.** It raises `IllegalStateException: UiAutomationService ... already registered!` and lands three `FATAL EXCEPTION` entries in the crash buffer that belong to the tooling, not the app (§4.3). Dump only between Maestro runs.
13. **Git Bash mangles device paths.** `adb shell ... /sdcard/x.xml` becomes a Windows path. Prefix with `MSYS_NO_PATHCONV=1`, or read the file with `adb shell "cat /sdcard/x.xml"` instead of `adb pull`.

---

## 6.5 Formula reference used to derive expected values

Every expected value in §2 was computed from the server's own implementation
(`backend/src/shrimp-calculations/shrimp-calculations.service.ts`) **before** any
flow ran, so the assertions test the app rather than restate its output.

| Quantity | Formula | Source |
|---|---|---|
| Biomass (Daily Feed, client) | `(count × SR/100) × MBW / 1000` | `DailyFeedCalculatorScreen.tsx:116` |
| Daily feed | `round₂(biomass × FR/100)` | `service.ts:68-70` |
| Product dosage | `round₂(area × depth × ppm / 1000)` | `service.ts:255-266` |
| Concentration-adjusted dose | `(volume × ppm) / (conc × 10)` | `ProductAmountScreen.tsx:63` |
| Free ammonia | `TAN / (1 + 10^(pKa − pH))` | `service.ts:222-249` |
| pKa | `0.0901821 + 2729.92/T_K + (0.1552 − 0.0003142·T_C)·I` | `service.ts:234-237` |
| Ionic strength | `I = 19.924·S / (1000 − 1.005·S)` | `service.ts:233` |
| FCR | `round₂(feed / harvest)` | `service.ts:34-37` |
| ADG | `round₃((final − initial) / days)` | `service.ts:43-53` |
| Survival rate | `round₂((harvested / stocked) × 100)` | `service.ts:59-62` |
| Expected harvest | `count = round(stock × SR/100)`, `kg = round₂(count × g / 1000)` | `service.ts:76-90` |
| Growth projection | `round₂(current + ADG × days)`, weekly at `min(7w, days)` | `service.ts:95-115` |
| Biomass (Growth screen) | `round₂(count × g / 1000)` | `service.ts:121-123` |
| Recommended feed rate | stepped table on ABW, per species | `service.ts:135-166` |

---

## 6.6 Build-vs-source divergence (resolved during the audit)

Recorded because it determines how much weight the `file:line` references carry.

The installed APK (`versionCode=3`, installed 2026-08-24) initially rendered the
**old** UI. HEAD (`fbd05ba`, 2026-08-29) has a different tab set and a redesigned
Daily Feed; that redesign landed in `f41e521` on 2026-08-26 — two days *after* the
APK was installed. On the first Maestro `launchApp`, `expo-updates` fetched and
applied an OTA JS bundle, after which the app matched HEAD.

Corroborating this, the four unchanged calculators are byte-identical between the
build baseline `704d816` and HEAD (line-ending-insensitive diff):

```
ProductAmountScreen           0 differing lines
FreeAmmoniaScreen             0 differing lines
CultivationPerformanceScreen  0 differing lines
GrowthAndHarvestScreen        0 differing lines
CalculatorHubScreen         209 differing lines   <- redesigned
DailyFeedCalculatorScreen   430 differing lines   <- redesigned
```

**Consequence:** every file/line reference in this report points at HEAD and
matches what the device actually executed. No finding rests on code the device
was not running.

================================================================================

*End of report. Suite: `maestro_tests/` — 45 numbered flows, 2 seed flows, 2
navigation subflows. Operating instructions: `maestro_tests/README.md`.*
