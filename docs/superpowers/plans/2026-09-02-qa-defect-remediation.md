# QA Defect Remediation Implementation Plan (Workstream A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the 19 defects in `QA_ENGINEERING_HANDOVER_REPORT.md`, clearing the CONDITIONAL GO release gate and leaving each defect guarded by a test.

**Architecture:** Eight PRs ordered by deploy target (backend vs OTA) and by shared code path. The three release blockers land first. Every fix ships with its regression test in the same PR rather than deferring test debt to the end.

**Tech Stack:** NestJS + TypeORM (backend, Jest), Expo/React Native + TanStack Query (frontend, Jest + @testing-library/react-native), Maestro (on-device E2E).

**Spec:** `docs/superpowers/specs/2026-09-02-qa-defect-remediation-design.md`

## Global Constraints

- **Frontend changes must add no new native dependency.** The app ships by OTA against an existing binary; a new native module requires a rebuild. Adding one is a plan failure.
- **Gate every commit:** `npx tsc --noEmit` and `npx jest` must both pass in the package you changed. Run jest as `npx jest --maxWorkers=2 --forceExit` to avoid worker pileup on Windows.
- **Files have mixed CRLF/LF.** Use the Edit tool for edits; a node `.replace()` with `\n` silently no-ops.
- **Maestro flows cannot be run from the development machine.** They need the physical OPPO CPH2467 on ADB with a signed-in session. Flow edits land as reviewed diffs; never claim Maestro verification you did not perform.
- **Six locales, always:** `en`, `hi`, `bn`, `ta`, `te`, `or` under `frontend/src/i18n/locales/<locale>/`. A string added to one must be added to all six.
- **Ammonia band rule (after Task 1):** `> 0.5` critical, `>= 0.1` warning, else safe — applied to the **rounded** value. Server, client fallback and on-screen legend must all agree.
- **Placeholder colour is `#586E82`**, not the report's `#5B7286` (which measures 4.45:1, below AA).

---

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `backend/src/shrimp-calculations/shrimp-calculations.service.ts` | Round-then-band ammonia; clamp SR | 1, 7 |
| `backend/src/shrimp-calculations/shrimp-calculations.boundary.spec.ts` *(new)* | Pins both sides of every band boundary and the SR clamp | 1, 7 |
| `backend/src/shrimp-calculations/shrimp-calculations.controller.ts` | Validate `recommended-feeding-rate` | 7 |
| `backend/src/shrimp-calculations/dto/advanced-calculations.dto.ts` | `@Max(14)` on pH | 7 |
| `frontend/src/i18n/locales/*/calculators.ts` | `safeMessage`, `hintSalinity`, `activeIngredientBasis` | 3, 5 |
| `frontend/src/screens/calculators/FreeAmmoniaScreen.tsx` | Salinity default | 3 |
| `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx` | Prefill gates; delete Pond Area; validation | 4, 6, 10, 11 |
| `frontend/src/screens/ponds/PondDashboardScreen.tsx` | Survival gate | 4 |
| `frontend/src/screens/calculators/ProductAmountScreen.tsx` | Dosage headline | 5 |
| `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx` | Area guard; drop dead call | 10, 11, 12 |
| `frontend/src/features/parseNumericInput.ts` *(new)* | One strict numeric parser for all five calculators | 10 |
| `frontend/src/theme/tokens.ts`, `colorRoles.ts` | Placeholder and hint contrast | 8 |
| `frontend/src/theme/__tests__/contrast.test.ts` *(new)* | WCAG ratios computed from tokens | 8 |
| `frontend/src/components/ui/StatRow.tsx` | Shrink instead of clipping figures | 11 |
| `frontend/src/components/ui/ScreenHeader.tsx` | 48 dp back target | 9 |
| `maestro_tests/maestro_tests/*.yaml` | Evidence-flow inversions | 2, 4, 6 |

## Where BUG-016 went

BUG-016 — "no test pins any calculator boundary" — has **no task of its own, deliberately**. The spec (§4) dissolves it into every other task, because deferring the guards to a final PR reproduces the exact gap that let BUG-001 survive a full screen redesign and BUG-008 survive the very comment documenting it.

It is discharged here:

| BUG-016 requirement | Where it lands |
|---|---|
| Ammonia band boundaries pinned on both sides | Task 1 — `shrimp-calculations.boundary.spec.ts` |
| The SR clamp asserted by `calculation.dto.ts:32` | Task 7 — same spec file |
| The prefill / survival rules | Task 4 — `__tests__/applyContext.test.ts` |
| Client-side validation guards on the calculators | Task 10 — `__tests__/parseNumericInput.test.ts` |
| A contrast check the build can enforce | Task 8 — `theme/__tests__/contrast.test.ts` |
| A guard against hardcoded strings returning | Task 13 — `scripts/check-calculator-i18n.sh` |

If you finish this plan and any row above has no passing test, BUG-016 is not closed.

---

# PR 1 — BUG-001, ammonia band boundary (backend deploy, RELEASE GATE)

### Task 1: Round once, then classify the rounded value

**Files:**
- Modify: `backend/src/shrimp-calculations/shrimp-calculations.service.ts:239-244`
- Test: `backend/src/shrimp-calculations/shrimp-calculations.boundary.spec.ts` *(create)*

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `calculateFreeAmmonia(tan, ph, temperature, salinity?) => { unionizedAmmonia: number; toxicityLevel: 'safe' | 'warning' | 'critical' }`. `toxicityLevel` is now a function of `unionizedAmmonia` as returned, so `Number(x.unionizedAmmonia.toFixed(4))` fully determines the band.

- [ ] **Step 1: Write the failing test**

Create `backend/src/shrimp-calculations/shrimp-calculations.boundary.spec.ts`:

```ts
import { ShrimpCalculationsService } from './shrimp-calculations.service';

/**
 * QA BUG-001. The service used to band the RAW double and round afterwards, so
 * two inputs whose results both PRINT as 0.1000 could land in opposite bands —
 * and the SAFE copy then claimed "< 0.1 ppm" directly beneath the figure
 * 0.1000. The rule now: round once, classify what the farmer is shown.
 *
 * Band rule, matching the on-screen legend: >0.5 critical, >=0.1 warning.
 */
describe('calculateFreeAmmonia — band boundaries', () => {
  const svc = new ShrimpCalculationsService();

  // The exact pair from the QA report, at the salinity the screen sends.
  it('gives the same band to two inputs that print the same value', () => {
    const low = svc.calculateFreeAmmonia(1.032, 8.2, 29, 15);
    const high = svc.calculateFreeAmmonia(1.0323, 8.2, 29, 15);

    expect(low.unionizedAmmonia).toBe(0.1);
    expect(high.unionizedAmmonia).toBe(0.1);
    expect(low.toxicityLevel).toBe(high.toxicityLevel);
  });

  it('places a displayed 0.1000 in WARNING, as the legend promises', () => {
    const r = svc.calculateFreeAmmonia(1.032, 8.2, 29, 15);
    expect(r.unionizedAmmonia).toBe(0.1);
    expect(r.toxicityLevel).toBe('warning');
  });

  // Both sides of both boundaries, so a future edit cannot slide either one.
  it('bands just below 0.1 as safe', () => {
    const r = svc.calculateFreeAmmonia(1.03, 8.2, 29, 15);
    expect(r.unionizedAmmonia).toBeLessThan(0.1);
    expect(r.toxicityLevel).toBe('safe');
  });

  it('bands just above 0.5 as critical and 0.5 itself as warning', () => {
    expect(svc.calculateFreeAmmonia(2, 8, 30, 0).toxicityLevel).toBe('warning');
    expect(svc.calculateFreeAmmonia(8, 9, 32, 0).toxicityLevel).toBe('critical');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest shrimp-calculations.boundary --maxWorkers=1 --forceExit`
Expected: FAIL — "gives the same band to two inputs that print the same value" reports `'safe'` vs `'warning'`.

- [ ] **Step 3: Write minimal implementation**

In `shrimp-calculations.service.ts`, replace the banding block (currently lines 239-244):

```ts
    // Classify the value we are going to SHOW, not the one we computed.
    // Banding the raw double and rounding afterwards let two inputs print the
    // identical figure under opposite verdicts (QA BUG-001).
    const reported = Number(nh3.toFixed(4));

    // Inclusive-low boundaries, matching the on-screen legend
    // ("< 0.1" safe / "0.1 - 0.5" warning / "> 0.5" critical) and the client
    // fallback in FreeAmmoniaScreen.tsx, which already uses >= 0.1.
    let toxicityLevel = 'safe';
    if (reported > 0.5) toxicityLevel = 'critical';
    else if (reported >= 0.1) toxicityLevel = 'warning';

    return {
      unionizedAmmonia: reported,
      toxicityLevel,
    };
```

- [ ] **Step 4: Run the full backend gate**

Run: `cd backend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS. `shrimp-calculations.validation.spec.ts:41` still passes — 0.1487 is `> 0.1` under both old and new rules.

- [ ] **Step 5: Commit**

```bash
git add backend/src/shrimp-calculations/shrimp-calculations.service.ts backend/src/shrimp-calculations/shrimp-calculations.boundary.spec.ts
git commit -m "fix(calculations): band the ammonia value we show, not the one we computed

QA BUG-001. The service classified the raw double and rounded afterwards, so
TAN 1.032 and 1.0323 both printed 0.1000 under opposite verdicts, and the SAFE
copy claimed '< 0.1 ppm' directly beneath 0.1000. Round once, then classify.

0.1 now starts WARNING on the server, matching the client fallback and the
on-screen legend, which already said so."
```

---

# PR 2 — BUG-002, salinity (OTA, RELEASE GATE)

> **Ordering constraint from the spec §2.1: Task 2 must land before Task 3.** Flows 12/13/14/26/27 ride the `'15'` screen default. Removing that default without first pinning salinity in the flows changes every asserted value and collapses the 26/27 boundary pair into two identical cases.

### Task 2: Pin salinity explicitly in the ammonia flows

**Files:**
- Modify: `maestro_tests/maestro_tests/12_ammonia_warning_band.yaml`, `13_ammonia_critical_band.yaml`, `14_ammonia_safe_band.yaml`, `26_ammonia_boundary_safe_side.yaml`, `27_ammonia_boundary_warning_side.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: five flows whose asserted values no longer depend on any screen default.

- [ ] **Step 1: Add an explicit salinity input to each of the five flows**

In each file, after the temperature input and its `hideKeyboard`, and **before** the `tapOn: 'Calculate NH.*'` line, insert:

```yaml
- tapOn: 'e.g. 15'
- inputText: '15'
- hideKeyboard
```

The placeholder `e.g. 15` is the salinity field's selector (fields are targeted by placeholder — see `maestro_tests/README.md`). `15` preserves every currently asserted value, so no assertion changes in this task.

- [ ] **Step 2: Update each flow's header comment**

In each of the five files, change the `# INPUTS:` line so it no longer describes salinity as a default. For example, in `12_ammonia_warning_band.yaml`:

```yaml
# INPUTS: TAN=1.5 ppm, pH=8.2, Temp=29 C, Salinity=15 ppt (entered explicitly,
#         NOT the screen default - BUG-002 removes that default)
```

- [ ] **Step 3: Verify by reading, not by running**

Run: `grep -c "e.g. 15" maestro_tests/maestro_tests/{12,13,14,26,27}*.yaml`
Expected: `1` for each of the five files.

These flows cannot be executed from this machine (Global Constraints). Do not record them as passing.

- [ ] **Step 4: Commit**

```bash
git add maestro_tests/maestro_tests
git commit -m "test(maestro): pin salinity explicitly in the ammonia flows

Flows 12/13/14/26/27 rode the screen's '15' salinity default. BUG-002 removes
that default, which would move every asserted value and collapse the 26/27
boundary pair into two identical 0.1096 cases - destroying the only on-device
evidence for BUG-001. Entering 15 explicitly keeps today's expectations and
makes the flows independent of any screen default."
```

### Task 3: Remove the salinity default and tell the truth in the hint

**Files:**
- Modify: `frontend/src/screens/calculators/FreeAmmoniaScreen.tsx:60`
- Modify: `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/calculators.ts:130` (`hintSalinity`) and `:136` (`safeMessage`)

**Interfaces:**
- Consumes: Task 1's band rule (the reworded `safeMessage` must not contradict it).
- Produces: salinity state initialised to `''`. `FreeAmmoniaScreen.tsx:89` keeps `parseFloat(salinity) || 0`, so a blank field submits `0` — the freshwater case the hint now names.

- [ ] **Step 1: Remove the default**

In `FreeAmmoniaScreen.tsx`, replace line 60:

```ts
    // Not pre-filled: salinity is a real term in the pKa model (QA BUG-002), and
    // a brackish default silently biases a freshwater pond's reading LOW - i.e.
    // toward "safe" - on a toxicity screen. Blank submits 0 via
    // `parseFloat(salinity) || 0` below, which is the freshwater Emerson form,
    // and the hint now says so.
    const [salinity, setSalinity] = useState('');
```

- [ ] **Step 2: Reword both strings in English**

In `frontend/src/i18n/locales/en/calculators.ts`:

```ts
    hintSalinity: 'Affects the result — enter 0 for freshwater ponds',
```

```ts
    safeMessage: 'NH₃ levels are within safe limits (below 0.1 ppm). No action required.',
```

`safeMessage` must not assert `< 0.1` — after Task 1 a displayed `0.1000` is WARNING, so the SAFE copy may never quote a bound the figure can equal.

- [ ] **Step 3: Translate both strings into the five sibling locales**

Apply the same two keys in `hi`, `bn`, `ta`, `te`, `or` at `calculators.ts:130` and `:136`. Keep each file's existing script and tone; translate the meaning "affects the result, enter 0 for freshwater" and "below 0.1 ppm", not the English words literally.

- [ ] **Step 4: Verify key parity across locales**

Run:
```bash
cd frontend && node -e "
const ls=['en','hi','bn','ta','te','or'];
for (const l of ls) {
  const s=require('fs').readFileSync('src/i18n/locales/'+l+'/calculators.ts','utf8');
  console.log(l, /hintSalinity/.test(s)?'hintSalinity ok':'MISSING hintSalinity', /safeMessage/.test(s)?'safeMessage ok':'MISSING safeMessage');
}"
```
Expected: all six locales report both keys present.

- [ ] **Step 5: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/screens/calculators/FreeAmmoniaScreen.tsx frontend/src/i18n/locales
git commit -m "fix(ammonia): salinity is not 'for reference only', and it no longer defaults to brackish

QA BUG-002. Salinity drives the ionic-strength term of pKa - editing it moves
the result ~10% - while the only guidance on the field said 'For reference
only'. Worse, it defaulted to 15 ppt, so a freshwater farmer who believed the
hint submitted a wrong and consequential value that biased the reading toward
'safe'.

Also rewords safeMessage: after BUG-001 a displayed 0.1000 is WARNING, so the
SAFE copy must not quote '< 0.1 ppm' as the bound."
```

---

# PR 3 — BUG-018 + BUG-019, pond prefill (OTA, RELEASE GATE)

> These share the same 12 lines of `applyContext` and must ship together.

### Task 4: Treat survival as unknown until something has measured it

**Files:**
- Modify: `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx:74-83`
- Modify: `frontend/src/screens/ponds/PondDashboardScreen.tsx:196-201`
- Test: `frontend/src/screens/calculators/__tests__/applyContext.test.ts` *(create)*
- Modify: `maestro_tests/maestro_tests/41_prefill_dailyfeed.yaml`

**Interfaces:**
- Consumes: `PondContext` from `frontend/src/api/pondContext.ts` — the fields used here are `abwG: number | null`, `livePopulation: number | null`, `crop: { stockingCount: number | null } | null`, `areaM2: number | null`, `doc: number | null`.
- Produces: the rule "a survival figure requires `ctx.abwG != null`", relied on by both screens.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/screens/calculators/__tests__/applyContext.test.ts`:

```ts
import type { PondContext } from '../../../api/pondContext';
import { survivalPctFrom, didPrefillAnything } from '../prefill';

const ctx = (over: Partial<PondContext>): PondContext =>
    ({
        pondId: 'p1', cropId: 'c1', species: null, areaM2: 5000,
        installedAeratorHp: null, doc: 1, waterQuality: null,
        freeAmmoniaMgL: null, abwG: null, livePopulation: 500000,
        biomassKg: null,
        crop: {
            stockingCount: 500000, carryingCapacityKgM2: null,
            feedPriceRpPerKg: null, targetSrPercent: null,
            targetSize: null, targetCultivationDays: null,
        },
        cumulativeFeedKg: null, runningFcr: null, latestTrayResidue: null,
        lastFeedAt: null, lastTrayAt: null, samplingAt: null,
        confidence: { score: 0, band: 'low', missing: [], stale: [] },
        ...over,
    }) as PondContext;

/**
 * QA BUG-019. livePopulation equals stockingCount whenever no mortality has
 * been logged, so survival came out as exactly 100% on every un-sampled pond -
 * arithmetically true, factually unknown. Biomass is count x SR/100 x MBW/1000,
 * so carrying a real 80% as 100% over-estimates biomass, and therefore the
 * daily feed, by 25%. Over-feeding decays to ammonia.
 */
describe('survivalPctFrom', () => {
    it('is unknown when no sampling exists, even though the arithmetic works', () => {
        expect(survivalPctFrom(ctx({ abwG: null }))).toBeNull();
    });

    it('is reported once a sampling backs it', () => {
        expect(survivalPctFrom(ctx({ abwG: 18.4, livePopulation: 400000 }))).toBe(80);
    });

    it('is unknown when the pond was never stocked', () => {
        expect(survivalPctFrom(ctx({ abwG: 18.4, crop: null }))).toBeNull();
    });
});

/**
 * QA BUG-018. The banner said "Filled from the pond you picked" as soon as any
 * context arrived - before the conditional set* calls had decided whether they
 * had anything to write. On a pond with no sampling it filled neither MBW (the
 * required field) nor a real SR, and a farmer told the form is filled reads the
 * remaining blank as optional.
 */
describe('didPrefillAnything', () => {
    it('is false when the pond has no sampling, so MBW was not filled', () => {
        expect(didPrefillAnything(ctx({ abwG: null }))).toBe(false);
    });

    it('is true once the pond can fill the required MBW field', () => {
        expect(didPrefillAnything(ctx({ abwG: 18.4 }))).toBe(true);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest applyContext --maxWorkers=1 --forceExit`
Expected: FAIL — "Cannot find module '../prefill'".

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/screens/calculators/prefill.ts`:

```ts
import type { PondContext } from '../../api/pondContext';

/**
 * Survival from a pond context, or null when nobody has measured it.
 *
 * `livePopulation` is stocked-minus-logged-mortality, so with no mortality it
 * equals `stockingCount` and the ratio is exactly 100% — arithmetically correct
 * and semantically meaningless (QA BUG-019). `abwG` is the honest proxy for "a
 * sampling exists": it is what the pond dashboard already gates MBW, biomass
 * and FCR on, which is why those three correctly render "—" and survival did
 * not.
 */
export const survivalPctFrom = (ctx: PondContext | null): number | null => {
    if (!ctx || ctx.abwG == null) return null;
    const stocked = ctx.crop?.stockingCount;
    const live = ctx.livePopulation;
    if (!stocked || live == null) return null;
    return Math.round((live / stocked) * 100);
};

/**
 * Whether the pond can actually fill the form's REQUIRED field.
 *
 * The banner claims "filled from the pond", so it must be driven by what was
 * written, not by a payload having arrived (QA BUG-018). MBW is the required
 * field and the largest term in the biomass calculation; without a sampling the
 * pond fills neither it nor a real survival figure.
 */
export const didPrefillAnything = (ctx: PondContext | null): boolean =>
    !!ctx && ctx.abwG != null;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest applyContext --maxWorkers=1 --forceExit`
Expected: PASS, 5 tests.

- [ ] **Step 5: Use it in `applyContext`**

In `DailyFeedCalculatorScreen.tsx`, add the import and replace the body of `applyContext` (lines 70-83):

```ts
import { survivalPctFrom, didPrefillAnything } from './prefill';
```

```ts
    const applyContext = useCallback((id: string, ctx: PondContext | null) => {
        setPondId(id);
        if (!ctx) return;
        setDoc(ctx.doc ?? null);
        // Only claim the form was filled from the pond when the pond could fill
        // the REQUIRED field (QA BUG-018).
        setPrefilled(didPrefillAnything(ctx));
        if (ctx.abwG != null) setMbwG((v) => v || String(ctx.abwG));
        if (ctx.crop?.stockingCount != null) {
            setInitialCount((v) => v || String(ctx.crop!.stockingCount));
            // Null until a sampling backs it — never the fabricated 100%
            // (QA BUG-019).
            const sr = survivalPctFrom(ctx);
            if (sr != null) setSrPct((v) => v || String(sr));
        }
        if (ctx.areaM2 != null) setPondAreaM2((v) => v || String(Math.round(ctx.areaM2!)));
    }, []);
```

- [ ] **Step 6: Apply the same gate to the pond dashboard**

In `PondDashboardScreen.tsx`, add the import and replace the `survival` memo at lines 195-201:

```ts
import { survivalPctFrom } from '../calculators/prefill';
```

```ts
    /**
     * Survival = live population over what was stocked, but only once a
     * sampling exists. Without one this rendered 100% directly above a card
     * saying survival cannot be worked out without a sampling (QA BUG-019).
     */
    const survival = useMemo(() => survivalPctFrom(context), [context]);
```

The render at `:420` already handles `null` by showing `—`, exactly as MBW, biomass and FCR do; no change is needed there.

- [ ] **Step 7: Invert the evidence flow**

In `maestro_tests/maestro_tests/41_prefill_dailyfeed.yaml`, replace the two defect assertions:

```yaml
# The banner must NOT claim the form was filled when the required MBW field
# was not (BUG-018 fixed).
- assertNotVisible: "Filled from the pond you picked.*"
# These two really were filled by the pond.
- assertVisible: "500000"
- assertVisible: "5000"
# Survival is no longer invented: the SR field shows its placeholder, not 100.
- assertVisible: "78"
# MBW is still empty on an un-sampled pond: its placeholder is what renders.
- assertVisible: "18.4"
```

Update the file's header comment to say it now asserts the FIXED behaviour and is no longer an evidence flow.

- [ ] **Step 8: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/screens/calculators/prefill.ts frontend/src/screens/calculators/__tests__/applyContext.test.ts frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx frontend/src/screens/ponds/PondDashboardScreen.tsx maestro_tests/maestro_tests/41_prefill_dailyfeed.yaml
git commit -m "fix(prefill): survival is unknown until a sampling measures it

QA BUG-019 and BUG-018, which share the same twelve lines of applyContext.

livePopulation equals stockingCount whenever no mortality has been logged, so
every un-sampled pond reported exactly 100% survival - as a Daily Feed prefill
labelled 'Filled from the pond you picked', and on the dashboard directly
beneath a card saying survival cannot be known without a sampling. Biomass is
count x SR/100 x MBW/1000, so a real 80% carried as 100% over-estimates biomass
and the daily feed by 25%. Uneaten feed decays to ammonia.

The banner now reflects what was actually written rather than a payload having
arrived: on a pond with no sampling it filled neither MBW - the required field -
nor a real survival figure."
```

---

# PR 4 — BUG-003 + BUG-005, calculator UI (OTA)

### Task 5: Promote the dose the farmer actually weighs out

**Files:**
- Modify: `frontend/src/screens/calculators/ProductAmountScreen.tsx:141-158`
- Modify: `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/calculators.ts` (new key `activeIngredientBasis`)
- Modify: `maestro_tests/maestro_tests/09_dosage_with_concentration.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: no new exports.

- [ ] **Step 1: Add the new key to all six locales**

In `frontend/src/i18n/locales/en/calculators.ts`, inside the `productDosage` block:

```ts
    activeIngredientBasis: '100% active-ingredient basis:',
```

Add a translation of the same meaning to `hi`, `bn`, `ta`, `te`, `or`.

- [ ] **Step 2: Swap the hierarchy**

In `ProductAmountScreen.tsx`, replace the result block:

```tsx
                {result && (
                    <View style={styles.resultBox}>
                        {/* The headline must be the mass the farmer weighs out. For a
                            sub-100% product that is the concentration-corrected figure,
                            not the pure-active-ingredient basis (QA BUG-003) - promoting
                            the latter under-doses a 50% product by half, and an
                            under-dosed treatment fails with no visible symptom. */}
                        <Text style={styles.resultLabel}>{t('calculators.productDosage.requiredAmount')}</Text>
                        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.5} style={styles.resultValue}>
                            {(clientResult ?? result.amountKg).toFixed(clientResult !== null ? 3 : 2)}
                        </Text>
                        <Text style={styles.resultUnit}>kg</Text>

                        {clientResult !== null && (
                            <View style={styles.clientResultSection}>
                                <View style={styles.divider} />
                                <Text style={styles.clientLabel}>{t('calculators.productDosage.activeIngredientBasis')}</Text>
                                <Text style={styles.clientValue}>{result.amountKg.toFixed(2)} kg</Text>
                                <Text style={styles.clientFormula}>
                                    ({pondVolume?.toFixed(0)} m³ × {targetPpm} ppm) / (10 × {concentration || 100}%)
                                </Text>
                            </View>
                        )}
                    </View>
                )}
```

- [ ] **Step 3: Invert the evidence flow**

In `09_dosage_with_concentration.yaml`, the flow currently asserts the 100 %-basis figure as the headline. Update the assertions so `24.000` is the primary figure and `12.00` appears in the supporting line, and rewrite the header comment to describe the fixed behaviour.

- [ ] **Step 4: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/screens/calculators/ProductAmountScreen.tsx frontend/src/i18n/locales maestro_tests/maestro_tests/09_dosage_with_concentration.yaml
git commit -m "fix(dosage): headline the mass the farmer weighs out

QA BUG-003. Concentration was added client-side only, so the server's
amountKg is by construction the 100%-active quantity - and the screen promoted
it. A farmer using a 50% product read 12.00 kg as the answer and applied half
the intended dose. Under-dosing a pond treatment fails silently."
```

### Task 6: Delete the inert Pond Area field

**Files:**
- Modify: `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx` — remove line 59 (state), line 82 (prefill), the `pondAreaM2` entry in the dependency array at line 91, and the `Input` at lines 220-228
- Delete: `maestro_tests/maestro_tests/25_dailyfeed_pond_area_inert.yaml`
- Modify: `maestro_tests/maestro_tests/41_prefill_dailyfeed.yaml`

**Interfaces:**
- Consumes: Task 4's edited `applyContext` (the `areaM2` line is removed from it here).
- Produces: `DailyFeedCalculatorScreen` no longer has `pondAreaM2` state.

- [ ] **Step 1: Remove the state, prefill, dependency and input**

Delete `const [pondAreaM2, setPondAreaM2] = useState('')`. Delete the `if (ctx.areaM2 != null) setPondAreaM2(...)` line from `applyContext`. Remove `pondAreaM2` from the `useEffect` dependency array so the array reads `[mbwG, srPct, initialCount, feedingRatePct]`. Delete the Pond Area `Input` block.

- [ ] **Step 2: Confirm nothing still references it**

Run: `cd frontend && grep -n "pondAreaM2" src/screens/calculators/DailyFeedCalculatorScreen.tsx`
Expected: no output.

- [ ] **Step 3: Delete the evidence flow and fix flow 41**

```bash
git rm maestro_tests/maestro_tests/25_dailyfeed_pond_area_inert.yaml
```

In `41_prefill_dailyfeed.yaml`, remove the `- assertVisible: "5000"` line — that field no longer exists. Remove row 25 from the flow index table in `maestro_tests/maestro_tests/README.md` and update row 41.

- [ ] **Step 4: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "fix(daily-feed): remove the Pond Area field that affected nothing

QA BUG-005. The field was editable and sat in the result-invalidation
dependency array, so typing into it visibly cleared the result - but
handleCalculate never read it, and a 999999 m2 area produced the same answer as
a blank one. A leftover of the pre-redesign form: the redesign kept the input
and dropped its consumer.

Deleted rather than wired up: nothing on this screen reports anything derived
from area, and a field that looks live but is not is worse than no field."
```

---

# PR 5 — BUG-004 + BUG-007 + BUG-008, API contract (backend deploy)

### Task 7: Validate and bound the calculations API

**Files:**
- Modify: `backend/src/shrimp-calculations/shrimp-calculations.controller.ts:136-147`
- Modify: `backend/src/shrimp-calculations/dto/advanced-calculations.dto.ts:1` and the `FreeAmmoniaDto.ph` field
- Modify: `backend/src/shrimp-calculations/shrimp-calculations.service.ts:59-62`
- Modify: `backend/src/shrimp-calculations/dto/calculation.dto.ts:32` (comment)
- Test: `backend/src/shrimp-calculations/shrimp-calculations.boundary.spec.ts` (extend)

**Interfaces:**
- Consumes: the boundary spec file created in Task 1.
- Produces: `calculateSurvivalRate(initialStock, harvestedCount)` now returns at most `100`.

- [ ] **Step 1: Write the failing tests**

Append to `shrimp-calculations.boundary.spec.ts`:

```ts
/**
 * QA BUG-008. CalculateSurvivalRateDto:32 documents a 100% clamp as the reason
 * harvestedCount carries no @Max. The clamp was never implemented, so the guard
 * lived nowhere and 150000 of 100000 returned 150%.
 */
describe('calculateSurvivalRate — clamp', () => {
  const svc = new ShrimpCalculationsService();

  it('clamps an overshoot to 100 rather than reporting an impossible rate', () => {
    expect(svc.calculateSurvivalRate(100_000, 150_000)).toBe(100);
    expect(svc.calculateSurvivalRate(1_000, 999_999)).toBe(100);
  });

  it('leaves a normal rate untouched', () => {
    expect(svc.calculateSurvivalRate(100_000, 80_000)).toBe(80);
  });

  it('still returns 0 for an unstocked pond', () => {
    expect(svc.calculateSurvivalRate(0, 500)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx jest shrimp-calculations.boundary --maxWorkers=1 --forceExit`
Expected: FAIL — received `150`.

- [ ] **Step 3: Implement the clamp**

In `shrimp-calculations.service.ts`:

```ts
  calculateSurvivalRate(initialStock: number, harvestedCount: number): number {
    if (initialStock === 0) return 0;
    // Clamped, as CalculateSurvivalRateDto:32 has always claimed. Field counts
    // routinely overshoot stock slightly through estimation error, so report
    // the ceiling rather than an impossible figure — or than rejecting a
    // legitimate caller.
    const pct = Math.round((harvestedCount / initialStock) * 10000) / 100;
    return Math.min(pct, 100);
  }
```

- [ ] **Step 4: Bound pH in the DTO**

In `dto/advanced-calculations.dto.ts`, extend the import on line 1 and add the bound:

```ts
import { IsNumber, Min, Max, IsOptional } from 'class-validator';
```

```ts
  @IsNumber()
  @Min(0)
  @Max(14)
  ph: number;
```

- [ ] **Step 5: Validate the feeding-rate endpoint**

In `shrimp-calculations.controller.ts`, replace the handler:

```ts
  @Get('recommended-feeding-rate')
  getRecommendedFeedingRate(
    @Query('averageWeightG') averageWeightG: string,
    @Query('species') species?: string,
  ) {
    // Nest hands query params through as strings, so the old `: number` type was
    // decorative: Number('abc') is NaN, every `<` rung in the step table is
    // false, and control fell to the unconditional tail `return 1.8`. Empty
    // string became 0 and matched the post-larvae bucket. Both were returned as
    // confident advice (QA BUG-004). Mirrors the biomass handler above.
    const weight = Number(averageWeightG);
    if (!Number.isFinite(weight) || weight <= 0) {
      throw new BadRequestException('averageWeightG must be a positive number');
    }
    return {
      recommendedFeedingRatePercent:
        this.calculationsService.getRecommendedFeedingRate(weight, species),
    };
  }
```

`BadRequestException` is already imported in this file.

- [ ] **Step 6: Fix the stale DTO comment**

In `dto/calculation.dto.ts:32`, the comment now describes real behaviour. Reword it to state the clamp is implemented in `calculateSurvivalRate`, so the next reader does not have to check.

- [ ] **Step 7: Run the backend gate**

Run: `cd backend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/shrimp-calculations
git commit -m "fix(calculations-api): reject junk instead of answering it confidently

Three API-surface defects from the QA handover.

BUG-004: recommended-feeding-rate typed its query param as number, but Nest
passes query strings through as strings, so 'abc' became NaN, fell through
every rung of the step table and returned the tail value 1.8; empty string
became 0 and matched the post-larvae bucket, returning 10. Both came back 200.
The correct pattern already existed ten lines above in the biomass handler.

BUG-007: FreeAmmoniaDto.ph had no upper bound, so pH 20 computed happily.

BUG-008: the DTO comment documented a 100% survival clamp as the reason
harvestedCount carries no @Max. The clamp was never written, so it lived
nowhere. Implemented rather than rejected - field counts overshoot stock
slightly through estimation error."
```

---

# PR 6 — BUG-006 + BUG-014 + BUG-015, accessibility (OTA)

### Task 8: Give informational text a contrast budget it can meet

**Files:**
- Modify: `frontend/src/theme/tokens.ts:37` (`placeholderColor`), `:40` (`helperColor`)
- Modify: `frontend/src/theme/colorRoles.ts:17` (`textTertiary`)
- Test: `frontend/src/theme/__tests__/contrast.test.ts` *(create)*

**Interfaces:**
- Consumes: nothing.
- Produces: `contrastRatio(hexA, hexB): number` exported from the test's helper for reuse.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/theme/__tests__/contrast.test.ts`:

```ts
import { theme } from '../index';

/**
 * QA BUG-006 and BUG-014. Placeholder text was #A3B5BF on #EEF2F5 — 1.88:1,
 * against a WCAG AA requirement of 4.5:1 — and hint text was #7A909F on white,
 * 3.32:1 at 11px, where no large-text exemption exists.
 *
 * Neither is decorative: placeholders carry the only worked example of the
 * expected magnitude and unit (28700 for a stocking count), and hints carry the
 * clarifying guidance, including the salinity hint that BUG-002 made
 * safety-relevant. The target user is often outdoors in bright sunlight.
 *
 * The colours were borrowed from the disabled-grey family, which is a different
 * contrast budget. This pins them so the pair cannot silently regress again.
 */
const relativeLuminance = (hex: string): number => {
    const channel = (i: number) => {
        const v = parseInt(hex.substr(i, 2), 16) / 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
};

export const contrastRatio = (a: string, b: string): number => {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
};

const AA_NORMAL_TEXT = 4.5;

/** Both surfaces an Input renders against: unfocused field and surfaceVariant. */
const INPUT_BACKGROUNDS = ['#F5F8FA', '#EEF2F5'];

describe('theme contrast — WCAG 2.1 AA', () => {
    it('sanity-checks the ratio function against known pairs', () => {
        expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
        expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    });

    it.each(INPUT_BACKGROUNDS)('placeholder text clears AA on %s', (bg) => {
        expect(contrastRatio(theme.tokens.input.placeholderColor, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it('hint/helper text clears AA on a white card', () => {
        expect(contrastRatio(theme.tokens.input.helperColor, '#FFFFFF')).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it('tertiary text clears AA on a white card', () => {
        expect(contrastRatio(theme.roles.light.textTertiary, '#FFFFFF')).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest contrast --maxWorkers=1 --forceExit`
Expected: FAIL — placeholder 1.88 and 1.99, hint/tertiary 3.32, all below 4.5.

- [ ] **Step 3: Replace the colours**

In `frontend/src/theme/tokens.ts`:

```ts
        // Placeholders carry the worked example of magnitude and unit, so they are
        // informational text and owe WCAG AA 4.5:1 — not the disabled-grey budget
        // they used to borrow from textDisabled. 4.70:1 on #EEF2F5 (QA BUG-006).
        placeholderColor: '#586E82',
```

```ts
        // Hints at 11px have no large-text exemption; #7A909F was 3.32:1 on a
        // white card (QA BUG-014). 4.83:1.
        helperColor: '#5C6F7E',
```

In `frontend/src/theme/colorRoles.ts`:

```ts
    textTertiary: '#5C6F7E',
```

Keep `#A3B5BF` wherever it genuinely means *disabled* — `colorRoles.ts:18` `textDisabled`, `:27` `primaryDisabled`, `tokens.ts:78`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest contrast --maxWorkers=1 --forceExit`
Expected: PASS. If `helperColor` still falls short, darken it one step and re-run — the test is the authority, not the hex value quoted here.

- [ ] **Step 5: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/theme
git commit -m "fix(theme): placeholders and hints are informational text, not disabled chrome

QA BUG-006 and BUG-014. Placeholder text measured 1.88:1 and hint text 3.32:1
against a 4.5:1 AA requirement. Both colours were borrowed from the
disabled-grey family and so inherited a contrast budget they should never have
had: placeholders carry the only worked example of the expected magnitude and
unit, and hints carry clarifying guidance - including the salinity hint that
BUG-002 just made safety-relevant. The target user is often outdoors in
sunlight.

Adds a contrast test computed from the tokens so the pair cannot regress
silently again; nothing in the build caught this."
```

### Task 9: Make the back target 48 dp

**Files:**
- Modify: `frontend/src/components/ui/ScreenHeader.tsx:97` (`HIT_SLOP`), `:111` (`back` style)

**Interfaces:**
- Consumes: nothing.
- Produces: no new exports.

- [ ] **Step 1: Widen the slop**

A 24 dp icon with a symmetric 10 dp `hitSlop` yields 44 dp, not 48 — the slop was sized by eye. `paddingBottom: 5` pushes the *height* over the line while leaving the width short, which is why the shortfall is asymmetric and easy to miss.

```ts
// A 24dp icon needs 12dp on each side to reach the 48dp minimum (WCAG 2.1
// SC 2.5.5 / Material). The previous symmetric 10dp gave 44.3dp wide — and
// back is the primary escape affordance, in the hardest corner to reach
// one-handed on a 6.7-inch device (QA BUG-015).
const HIT_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };
```

- [ ] **Step 2: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui/ScreenHeader.tsx
git commit -m "fix(header): back button reaches the 48dp minimum touch target

QA BUG-015. Measured 44.3 x 49.0 dp effective - the height cleared, the width
did not, because a 24dp icon with symmetric 10dp hitSlop is 44dp and
paddingBottom:5 lifted only the height."
```

> **Note for the operator:** BUG-015's measurement was taken by uiautomator on one handset at 408 dpi effective. Re-measure on device after this lands; the dp arithmetic is density-independent but the claim is not verifiable from the development machine.

---

# PR 7 — BUG-017 + BUG-009 + BUG-010 + BUG-011, input hardening (OTA)

> **Do Task 10 before Task 11.** `parseNumericInput` closes BUG-009 as a side effect and turns BUG-010/011 into one-line range checks on a parser that already returns a real number or `null`.

### Task 10: One strict numeric parser for every calculator field

**Files:**
- Create: `frontend/src/features/parseNumericInput.ts`
- Create: `frontend/src/features/__tests__/parseNumericInput.test.ts`
- Modify: all five calculator screens (29 `parseFloat` call sites): `DailyFeedCalculatorScreen.tsx`, `FreeAmmoniaScreen.tsx`, `ProductAmountScreen.tsx`, `CultivationPerformanceScreen.tsx`, `GrowthAndHarvestScreen.tsx`
- Modify: `maestro_tests/maestro_tests/36_sanitize_partial_parse.yaml`, `28_performance_nonnumeric_area.yaml`

**Interfaces:**
- Consumes: nothing.
- Produces: `parseNumericInput(raw: string): number | null` — `null` for empty, non-numeric, trailing-garbage, `Infinity` and `NaN`; a finite number otherwise.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/features/__tests__/parseNumericInput.test.ts`:

```ts
import { parseNumericInput } from '../parseNumericInput';

/**
 * QA BUG-017. parseFloat is a PREFIX parser: parseFloat('20abc') is 20, so a
 * field declared numeric silently accepted and truncated a value that is not a
 * number, and the screen rendered a confident answer identical to a clean 20.
 * parseFloat('1e3') is 1000, a silent 1000x reading; parseFloat('Infinity') is
 * Infinity, which passes `!v || v <= 0` and reaches the arithmetic.
 */
describe('parseNumericInput', () => {
    it('rejects trailing garbage rather than truncating to a prefix', () => {
        expect(parseNumericInput('20abc')).toBeNull();
    });

    it('rejects a value with no numeric content', () => {
        expect(parseNumericInput('abc!@#')).toBeNull();
    });

    it('rejects Infinity and NaN, which pass a naive falsy/sign guard', () => {
        expect(parseNumericInput('Infinity')).toBeNull();
        expect(parseNumericInput('-Infinity')).toBeNull();
        expect(parseNumericInput('NaN')).toBeNull();
    });

    it('treats an empty or whitespace-only field as absent', () => {
        expect(parseNumericInput('')).toBeNull();
        expect(parseNumericInput('   ')).toBeNull();
    });

    // TC-30 pins whitespace tolerance; Number(' 20 ') is 20, so it survives.
    it('keeps the whitespace tolerance the suite already relies on', () => {
        expect(parseNumericInput(' 20 ')).toBe(20);
    });

    it('accepts ordinary decimals, zero and negatives', () => {
        expect(parseNumericInput('18.4')).toBe(18.4);
        expect(parseNumericInput('0')).toBe(0);
        expect(parseNumericInput('-5')).toBe(-5);
    });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest parseNumericInput --maxWorkers=1 --forceExit`
Expected: FAIL — "Cannot find module '../parseNumericInput'".

- [ ] **Step 3: Write minimal implementation**

Create `frontend/src/features/parseNumericInput.ts`:

```ts
/**
 * Strict numeric field parse.
 *
 * `parseFloat` is a PREFIX parser — '20abc' yields 20 and 'Infinity' yields
 * Infinity — so a field declared numeric silently accepted values that are not
 * numbers and computed a confident answer from the truncation (QA BUG-017).
 * `Number()` rejects trailing garbage outright; `Number.isFinite` closes
 * Infinity and NaN. Returns null for "no usable value", so callers test
 * `=== null` rather than falsiness, which 0 would otherwise trip.
 *
 * `keyboardType="decimal-pad"` is a soft-keyboard hint, not an input filter:
 * paste, voice input and physical keyboards all reach these fields.
 */
export const parseNumericInput = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx jest parseNumericInput --maxWorkers=1 --forceExit`
Expected: PASS, 6 tests.

- [ ] **Step 5: Route every calculator field through it**

In each of the five screens, import the parser and replace every `parseFloat(x)` on a *user input field* with `parseNumericInput(x)`. Then change each guard from a falsy test to an explicit null test, because `0` is falsy but valid input. In `DailyFeedCalculatorScreen.tsx`:

```ts
        const mbw = parseNumericInput(mbwG);
        const sr = parseNumericInput(srPct);
        const count = parseNumericInput(initialCount);
        const fr = parseNumericInput(feedingRatePct);

        if (mbw === null || mbw <= 0) {
            Alert.alert(t('calculators.dailyFeed.validationTitle'), t('calculators.dailyFeed.errorMbw'));
            return;
        }
        if (sr === null || sr <= 0 || sr > 100) {
            Alert.alert(t('calculators.dailyFeed.validationTitle'), t('calculators.dailyFeed.errorSr'));
            return;
        }
```

Apply the same substitution in `FreeAmmoniaScreen.tsx:66-68`, `ProductAmountScreen.tsx:28`, `CultivationPerformanceScreen.tsx:42-48` and `GrowthAndHarvestScreen.tsx`.

**Do not** change `FreeAmmoniaScreen.tsx:89`'s `parseFloat(salinity) || 0` — that is the deliberate blank-means-freshwater coercion from Task 3.

- [ ] **Step 5b: Close BUG-009 — the optional Pond Area guard**

`CultivationPerformanceScreen.tsx:74` is a *separate* guard from the parse sites above and must be updated explicitly, or BUG-009 survives this task. It currently reads `if (areaM2 && (area <= 0))`. `parseFloat('abc')` was `NaN`, and `NaN <= 0` is `false`, so the guard never fired; the renderer's `area > 0` gate at `:106` was also `false`, so the Productivity card silently vanished with no error. Every `NaN` comparison is `false`, so no reordering fixes it — the type must be tested.

With `area` now coming from `parseNumericInput` it is `number | null`:

```ts
        // 'abc' used to parse to NaN, pass this guard, and then silently delete
        // the Productivity metric the farmer asked for (QA BUG-009). null is the
        // parser's "not a number", and it must be rejected explicitly — `!area`
        // would also reject a legitimate 0.
        if (areaM2 && (area === null || area <= 0)) {
            Alert.alert(t('calculators.performance.validationTitle'), t('calculators.performance.errorArea'));
            return;
        }
```

`errorArea` already exists in all six locales; no new key is needed.

- [ ] **Step 6: Invert the two evidence flows**

In `36_sanitize_partial_parse.yaml`, replace the assertion that `20abc` computes as `20` with an assertion that the `Validation Error` alert appears. In `28_performance_nonnumeric_area.yaml`, replace the silent-drop assertion with the alert. Rewrite both header comments to describe the fixed behaviour.

- [ ] **Step 7: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features frontend/src/screens/calculators maestro_tests/maestro_tests
git commit -m "fix(calculators): a numeric field rejects what is not a number

QA BUG-017, which also closes BUG-009. parseFloat is a prefix parser, so
'20abc' computed as 20 and rendered an answer identical to a clean 20 with
nothing indicating truncation; '1e3' became a silent 1000x reading; and
'Infinity' passed every `!v || v <= 0` guard and reached the arithmetic.

One shared strict parser now backs all five calculators, and the guards test
`=== null` rather than falsiness so a legitimate 0 is not rejected."
```

### Task 11: Bound the ranges, and stop clipping figures

**Files:**
- Modify: `frontend/src/screens/calculators/DailyFeedCalculatorScreen.tsx` (feeding-rate and stocking-count guards)
- Modify: `frontend/src/components/ui/StatRow.tsx:57`
- Modify: `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/calculators.ts` (`errorFeedingRate`, `errorCount` wording)
- Modify: `maestro_tests/maestro_tests/29_dailyfeed_feedrate_over_100.yaml`, `31_sanitize_max_buffer.yaml`

**Interfaces:**
- Consumes: `parseNumericInput` from Task 10.
- Produces: no new exports.

- [ ] **Step 1: Add the two bounds**

In `DailyFeedCalculatorScreen.tsx`, above `handleCalculate`:

```ts
/**
 * A pond holding more than 100 million post-larvae does not exist. Without a
 * ceiling the screen rendered 4.8e16 kg of feed per day with the confidence of
 * a real answer, and the biomass stat clipped silently past
 * Number.MAX_SAFE_INTEGER (QA BUG-011).
 */
const MAX_STOCKING_COUNT = 100_000_000;
```

Then tighten the two guards:

```ts
        if (count === null || count <= 0 || count > MAX_STOCKING_COUNT) {
            Alert.alert(t('calculators.dailyFeed.validationTitle'), t('calculators.dailyFeed.errorCount'));
            return;
        }
        // Mirror the server's @Max(100) (calculation.dto.ts:45) so an
        // out-of-range rate fails with the same field-named message every other
        // input gives, instead of a wasted round-trip and a generic error
        // (QA BUG-010).
        if (fr === null || fr <= 0 || fr > 100) {
            Alert.alert(t('calculators.dailyFeed.validationTitle'), t('calculators.dailyFeed.errorFeedingRate'));
            return;
        }
```

- [ ] **Step 2: Reword the two error strings in all six locales**

`errorCount` and `errorFeedingRate` must state the accepted range, not only "must be positive". English:

```ts
    errorCount: 'Stocking count must be between 1 and 100,000,000.',
    errorFeedingRate: 'Feeding rate must be between 0 and 100%.',
```

Translate the same meaning into `hi`, `bn`, `ta`, `te`, `or`.

- [ ] **Step 3: Stop StatRow clipping numbers**

In `frontend/src/components/ui/StatRow.tsx`, on the value `<Text>` at line 57:

```tsx
                        numberOfLines={1}
                        // Shrink rather than ellipsise: truncating a figure drops
                        // its LEAST significant digits and leaves a wrong number
                        // that still looks right, with no visual cue (QA BUG-011).
                        // The screen headline already does this.
                        adjustsFontSizeToFit
                        minimumFontScale={0.6}
```

- [ ] **Step 4: Invert the two evidence flows**

In `29_dailyfeed_feedrate_over_100.yaml`, assert the client-side `Validation Error` instead of the absent validation. In `31_sanitize_max_buffer.yaml`, assert the `Validation Error` instead of the unbounded render. Rewrite both header comments.

- [ ] **Step 5: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src maestro_tests/maestro_tests
git commit -m "fix(calculators): bound stocking count and feeding rate, and shrink long figures

QA BUG-010 and BUG-011. A stocking count of 1e20 rendered 4.8e16 kg of feed per
day - about 48 trillion tonnes - with the confidence of a real answer, while
the biomass stat clipped to '16,00,00,00...' because StatRow ellipsised instead
of shrinking. Truncating a number removes its least significant digits and
leaves a plausible wrong figure.

Feeding rate now mirrors the server's @Max(100) client-side, so it fails with
the same field-named message as every other input rather than a wasted round
trip and a generic network error."
```

---

# PR 8 — BUG-012 + BUG-013, dead code and i18n (OTA)

### Task 12: Drop the API call nobody reads

**Files:**
- Modify: `frontend/src/screens/calculators/CultivationPerformanceScreen.tsx:24, 83-113`

**Interfaces:**
- Consumes: nothing.
- Produces: the screen's results object no longer has a `perf` property.

- [ ] **Step 1: Confirm it is genuinely unread**

Run: `cd frontend && grep -n "results\.perf\|\.perf\b" src/screens/calculators/CultivationPerformanceScreen.tsx`
Expected: only the declaration at `:24` and the assignment at `:113` — no read.

- [ ] **Step 2: Remove the call, the field and the type member**

Delete `calculateCultivationPerformance({...})` from the `Promise.all` (and destructure only `[fcrRes, adgRes, srRes]`), delete `perf: perfRes.data` from `setResults`, and delete `perf: CultivationPerformanceResponse | null` from the results interface at `:24`. Remove the now-unused import if nothing else uses it.

- [ ] **Step 3: Run the frontend gate**

Run: `cd frontend && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: PASS. `tsc` will catch any remaining reference.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/screens/calculators/CultivationPerformanceScreen.tsx
git commit -m "fix(performance): drop the fourth API call whose response was never rendered

QA BUG-012. Four requests went out per Calculate; three were rendered.
results.perf had no read anywhere in the file. Because it sat in the same
Promise.all, a slow or failing call nobody consumed delayed or failed the whole
calculation. Its awkward inline `|| 0` fr expression existed only to satisfy
the DTO of that call."
```

### Task 13: Translate the calculator strings that survive a language switch

**Files:**
- Modify: all five calculator screens (39 literals — placeholders and unit/range strings)
- Modify: `frontend/src/i18n/locales/{en,hi,bn,ta,te,or}/calculators.ts`
- Modify: `maestro_tests/maestro_tests/34_i18n_hindi_calculators.yaml`
- Create: a CI guard

**Interfaces:**
- Consumes: nothing.
- Produces: no new exports.

- [ ] **Step 1: Add the keys**

For each hardcoded literal listed in the QA report under BUG-013 — 6 in `CultivationPerformanceScreen`, 5 in `DailyFeedCalculatorScreen`, 4 in `FreeAmmoniaScreen`, 9 in `GrowthAndHarvestScreen`, 4 in `ProductAmountScreen`, plus 11 unit/range strings — add a key to `en/calculators.ts` and a translation to the other five locales.

- [ ] **Step 2: Replace the literals**

Replace each literal with its `t('calculators....')` call.

**Do not** translate `toLocaleString('en-IN')` grouping. Report §6.4 confirms the arithmetic is locale-independent precisely because that is hardcoded; changing it would move rendered figures and break flows 37-39.

- [ ] **Step 3: Add a CI guard**

Add a script that fails if a user-visible literal placeholder reappears on a calculator screen:

```bash
# frontend/scripts/check-calculator-i18n.sh
# Fails the build if a placeholder= prop on a calculator screen holds a string
# literal rather than a t() call. QA BUG-013: 39 hardcoded English strings
# survived a language switch, including every input placeholder.
set -e
if grep -rnE 'placeholder=\{?"' src/screens/calculators/*.tsx; then
  echo "ERROR: hardcoded placeholder on a calculator screen — use t()." >&2
  exit 1
fi
echo "calculator i18n check passed"
```

- [ ] **Step 4: Run the guard and the frontend gate**

Run: `cd frontend && bash scripts/check-calculator-i18n.sh && npx tsc --noEmit && npx jest --maxWorkers=2 --forceExit`
Expected: guard prints "passed"; gate PASS.

- [ ] **Step 5: Update the evidence flow**

In `34_i18n_hindi_calculators.yaml`, replace assertions that English placeholders persist under Hindi with assertions that the Hindi strings render. Rewrite the header comment.

- [ ] **Step 6: Commit**

```bash
git add frontend/src frontend/scripts maestro_tests/maestro_tests/34_i18n_hindi_calculators.yaml
git commit -m "fix(i18n): translate the 39 calculator strings that survived a language switch

QA BUG-013. Every input placeholder on all five calculator screens was a
hardcoded English literal, along with 11 unit and range strings. Placeholders
are the only worked example of the expected magnitude and unit, so a
non-English farmer lost that guidance entirely.

Adds a CI guard so a literal placeholder cannot reappear. The en-IN number
grouping stays hardcoded deliberately - report 6.4 confirms the arithmetic is
locale-independent because of it."
```

---

## Release gate exit checklist

Run through this before declaring the build GO. Items marked **(device)** cannot be verified from the development machine.

- [ ] `service.ts` bands `Number(nh3.toFixed(4))`, not the raw double
- [ ] Server (`>= 0.1`), client fallback (`FreeAmmoniaScreen.tsx:16`) and the legend (`:203`, `:207`) place `0.1` in the same band
- [ ] `safeMessage` no longer asserts a bound `0.1000` violates — all six locales
- [ ] `hintSalinity` states that salinity affects the result — all six locales
- [ ] Salinity no longer defaults to `15`
- [ ] Survival is not prefilled, and the dashboard shows `—`, on a stocked pond with no sampling
- [ ] Backend deployed to Singapore and `/api/health` returns `database: up`, `redis: up`
- [ ] OTA published and confirmed live (applies on the **second** launch)
- [ ] **(device)** flows 12, 13, 14, 27 pass unchanged
- [ ] **(device)** flow 26 passes with its inverted `WARNING (Server)` assertion
- [ ] **(device)** flow 41 passes with its inverted assertions
- [ ] **(device)** flows 09, 28, 29, 31, 34, 36 pass with inverted assertions
- [ ] **(device)** flow 25 deleted and removed from the README index

## Known gaps carried into release

From spec §7 — state these when reporting, do not let them pass silently:

- BUG-004, BUG-007 and BUG-008 are verified by source analysis plus local re-execution of the service functions, **not** by observed HTTP requests. `run-as` fails on a release build, so no JWT could be extracted. Closing this needs a debug build, an intercepting proxy with a trusted CA, or a service-account token.
- Prefill was exercised on one shape of pond only — day 1, stocked, no sampling. Task 4's unit tests cover the other branches; the device suite does not.
- Touch-target and contrast measurements come from one handset at 408 dpi effective.
- ~72 of 105 routes remain unexercised, including all auth and onboarding. This plan covers the calculators and the prefill path; it is not a whole-app remediation.
