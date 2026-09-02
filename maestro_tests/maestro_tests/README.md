# Maestro test suite — Upcheck calculators

End-to-end output-correctness flows for `com.upcheck.app`, driven against a
physical device and the **live** `api.upcheck.in` backend.

## Running

```bash
# one flow
maestro --device 21e2533f test ./maestro_tests/01_dailyfeed_valid_standard.yaml

# whole suite, sequentially
for f in ./maestro_tests/[0-9]*.yaml; do
  maestro --device 21e2533f test "$f"
done
```

## Preconditions

1. **The device must be signed in.** Every calculator is behind `JwtAuthGuard`
   (registered globally as an `APP_GUARD` in `backend/src/app.module.ts:227`).
   The flows do not log in — they assume a live session. If they fail at
   `Assert that "Settings" is visible`, the app is on the login screen.
2. **The backend must be reachable** — all five calculators POST their arithmetic
   to the server. Check with `curl https://api.upcheck.in/api/health`.
3. `expo-updates` runs with `CHECK_ON_LAUNCH=ALWAYS`, so the first `launchApp`
   may swap the JS bundle underneath you. Re-run the suite after any OTA lands.

## Conventions that matter

- **`stopApp` before `launchApp`** (in `_nav_to_hub.yaml`). `launchApp` alone
  resumes the previous React Navigation stack, so without it a flow starts
  wherever the last one stopped.
- **Maestro full-matches the selector as a regex.** `Free Ammonia` does *not*
  match the element `Free Ammonia (NH₃)` — use `Free Ammonia.*`. Result values
  are asserted as `.*<value>.*` because React Native merges a nested unit
  `<Text>` into the parent's accessibility text.
- **Fields are targeted by placeholder**, not label: the `Input` component sets
  `accessibilityLabel={label}` on the `TextInput` *and* renders the same string
  as a visible `<Text>`, so a label selector is ambiguous. Placeholders are
  unique per screen — except the two `0.0` fields on Cultivation Performance,
  which need `index: 0` and `index: 1` (see the `hintText` note below).
- React Native exposes no `text` attribute to uiautomator, only
  `accessibilityText`. That is what every assertion here matches against.
- **Selector matching is case-insensitive.** `SAFE.*` also matches the word
  "Safe" in the toxicity-scale legend that is always on screen, so the Free
  Ammonia band assertions anchor on the `(Server)` suffix that only the result
  badge carries.
- **`hintText` survives once a field has content.** Android keeps the hint
  attribute on a populated `EditText`, so a placeholder selector never stops
  matching the first field. The two `0.0` fields on Cultivation Performance
  therefore need `index: 0` **and** `index: 1` — using `index: 0` twice types
  both values into Total Harvested and leaves Total Feed empty.
- **Maestro indexes only elements currently on screen.** A fixed index for one of
  Growth & Harvest's three identical `Calculate` buttons breaks as soon as the
  scroll position changes. Prefer a relational selector — `below: {text: "Stock
  Count"}` — anchored on a label unique to that card.
- **`assertVisible` means visible in the viewport**, not present in the tree.
  Results that render under the fold need a `scroll` or `scrollUntilVisible`
  first; that is why flow 20 scrolls before checking the weekly breakdown.

## Flow index

| # | Flow | Kind |
|---|---|---|
| 00 | `navigation_hub` | smoke |
| 01 | `dailyfeed_valid_standard` | valid |
| 02 | `dailyfeed_valid_decimal` | valid / rounding |
| 03 | `dailyfeed_invalid_empty` | invalid |
| 04 | `dailyfeed_invalid_sr_over_100` | boundary |
| 05 | `dailyfeed_invalid_negative` | invalid |
| 06 | `dailyfeed_boundary_large` | extreme |
| 07 | `dailyfeed_special_characters` | invalid |
| 08 | `dosage_valid_standard` | valid |
| 09 | `dosage_with_concentration` | valid → **evidence for D4** |
| 10 | `dosage_invalid_concentration` | boundary |
| 11 | `dosage_invalid_empty` | invalid |
| 12 | `ammonia_warning_band` | valid |
| 13 | `ammonia_critical_band` | valid |
| 14 | `ammonia_safe_band` | valid |
| 15 | `ammonia_invalid_ph` | boundary |
| 16 | `ammonia_invalid_empty` | invalid |
| 17 | `performance_valid_standard` | valid |
| 18 | `performance_invalid_sr` | boundary |
| 19 | `growth_expected_harvest` | valid |
| 20 | `growth_projection` | valid |
| 21 | `growth_biomass` | valid |
| 22 | `growth_recommended_rate` | valid / table lookup |
| 23 | `growth_invalid_sr` | boundary |
| 24 | `ammonia_salinity_sensitivity` | **evidence for D2** |
| 26 | `ammonia_boundary_safe_side` | **evidence for D1** |
| 27 | `ammonia_boundary_warning_side` | **evidence for D1** |
| 28 | `performance_nonnumeric_area` | **evidence for D8** |
| 29 | `dailyfeed_feedrate_over_100` | **evidence for D9** |
| 30 | `sanitize_whitespace` | sanitization |
| 31 | `sanitize_max_buffer` | **evidence for BUG-011** |
| 32 | `sanitize_injection_chars` | sanitization |
| 33 | `race_double_tap_calculate` | idempotency |
| 34 | `i18n_hindi_calculators` | **evidence for BUG-013** |
| 35 | `i18n_restore_english` | housekeeping |
| 36 | `sanitize_partial_parse` | **evidence for BUG-017** |
| 37 | `locale_hi_dailyfeed_standard` | i18n x arithmetic |
| 38 | `locale_hi_dailyfeed_decimal` | i18n x rounding |
| 39 | `locale_hi_performance` | i18n x arithmetic |
| 40 | `prefill_pond_picker` | prefill path |
| 41 | `prefill_dailyfeed` | **evidence for BUG-018 / BUG-019** (no longer asserts Pond Area — field removed, BUG-005) |
| 42 | `smoke_settings_tools` | route smoke (9 routes) |
| 43 | `smoke_tabs` | route smoke (6 tabs) |
| 44 | `smoke_pond_logs` | route smoke (7 routes) |

### Subflows and seeds (excluded by the `[0-9]*.yaml` glob)

| File | Kind |
|---|---|
| `_nav_to_hub.yaml` | shared subflow — cold launch to the Calculator Hub |
| `_nav_to_hub_hi.yaml` | shared subflow — same, with the UI switched to Hindi |
| `_seed_01_create_pond.yaml` | **one-time setup — WRITES TO PRODUCTION** |
| `_seed_02_start_cycle.yaml` | **one-time setup — WRITES TO PRODUCTION** |

> **The two seed flows create real records** on the live `api.upcheck.in`
> account: pond `QA-AUDIT-POND` and an active `Cycle 1` (500 000 PL). They exist
> because the calculator **prefill** path (`PondPicker` + `applyContext`) is
> unreachable without a stocked pond. Re-running them creates duplicates.
>
> **The pond is being kept** by the account owner's decision, so it is a standing
> fixture and flows **40, 41, 43 and 44 run against it as-is.** Do not delete it
> without also re-running the seeds. See §6.3 of the handover report.

## Reading the evidence flows

Ten flows — 09, 24, 25, 26, 27, 28, 29, 31, 34 and 36 — are written to **assert
the buggy behaviour that is actually there**, so they pass today. They are
regression tripwires: when a defect is fixed, its evidence flow should start
failing, and the assertion should then be inverted to lock in the fix. Each file
documents the expected-vs-actual split in its header comment.

Flows 30–36 cover the cross-cutting audit pillars — input sanitization and
boundary resilience (30, 31, 32, 36), idempotency and race conditions (33), and
localization (34, 35). Flow 35 is housekeeping, not a product test: it restores
the app to English after flow 34 leaves it in Hindi, so run it whenever 34 has
run.

Defect IDs: `BUG-001`–`BUG-019` in `QA_ENGINEERING_HANDOVER_REPORT.md`, which is
the single source of truth and carries the file/line references, root-cause
analysis and proposed patches. (The earlier `E2E_OUTPUT_CORRECTNESS_REPORT.md`
and its `D1`–`D11` numbering have been folded into it and removed.)

## Two device hazards that will waste your afternoon

1. **ColorOS silently uninstalls `dev.mobile.maestro.test`.** Maestro then fails
   every run with `AndroidDriverTimeoutException`, which looks like a device or
   network fault. Reinstall **both** APKs — they ship inside `maestro-client.jar`:
   ```bash
   unzip -o -j /c/maestro/lib/maestro-client.jar "*.apk" -d /tmp/mextract
   adb -s 21e2533f install -r -t /tmp/mextract/maestro-app.apk
   adb -s 21e2533f install -r -t /tmp/mextract/maestro-server.apk
   ```
2. **A sleeping screen fails every assertion after it**, silently. Run
   `adb -s 21e2533f shell svc power stayon usb` before a long sweep.

Both are handled automatically by the runner described in §6.4 of the handover
report.

## `scrollUntilVisible` needs `centerElement: true`

Without it the scroll stops as soon as the row is technically on screen, which
can leave it **underneath the floating bottom tab bar** — the following `tapOn`
then hits the centre "Quick log" FAB and opens the wrong screen. This produced a
convincing false positive during the route sweep. Any "wrong screen opened"
result must be re-probed with centering before it is filed as a defect.
