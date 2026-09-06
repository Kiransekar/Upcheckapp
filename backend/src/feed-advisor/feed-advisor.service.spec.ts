import { FeedAdvisorService } from './feed-advisor.service';
import { ShrimpCalculationsService } from '../shrimp-calculations/shrimp-calculations.service';

/**
 * Validates the ration engine against farmer_features_spec.md §3 and its
 * "unit tests to add" list (ration→0 on fasting; tray/molt/env factors
 * multiply correctly).
 */
describe('FeedAdvisorService.computeRation', () => {
  // Only the pure engine is exercised; repo/ponds are unused here.
  const svc = new FeedAdvisorService(
    null as any,
    new ShrimpCalculationsService(),
    null as any,
  );

  // Baseline: N=120,000, ABW=25g → biomass 3000kg; FR(25g)=2.5% → base 75kg.
  const base = { livePopulation: 120_000, abwG: 25 };

  it('computes biomass, FR(ABW) and base ration with neutral factors', () => {
    const r = svc.computeRation({ ...base });
    expect(r.biomassKg).toBe(3000);
    expect(r.frPct).toBe(2.5);
    expect(r.baseRationKg).toBe(75);
    expect(r.recommendedKg).toBe(75);
    expect(r.factors).toEqual({ tray: 1, molt: 1, env: 1, fasting: 1 });
    // Whole kg, per meal too (E3) — this is the figure the farmer scoops to,
    // and 18.75 kg implies a precision the population estimate cannot support.
    expect(r.perMeal).toEqual([19, 19, 19, 18]); // default 4 meals, sums to 75
  });

  it('zeroes the ration on a fasting day', () => {
    const r = svc.computeRation({ ...base, fasting: true });
    expect(r.recommendedKg).toBe(0);
    expect(r.perMeal.every((m) => m === 0)).toBe(true);
  });

  it('applies the tray-residue multiplier', () => {
    expect(
      svc.computeRation({ ...base, lastTray: 'empty' }).recommendedKg,
    ).toBe(80); // ×1.07
    expect(
      svc.computeRation({ ...base, lastTray: 'a_lot_left' }).recommendedKg,
    ).toBe(60); // ×0.8
    expect(
      svc.computeRation({ ...base, lastTray: 'few_left' }).recommendedKg,
    ).toBe(75); // ×1.0
  });

  it('cuts feed in a molt-peak window (×0.75)', () => {
    expect(svc.computeRation({ ...base, inMoltPeak: true }).recommendedKg).toBe(
      56,
    );
  });

  it('grades the ammonia cut by free-NH3 level (stress from ~0.1 mg/L)', () => {
    expect(svc.computeRation({ ...base, nh3: 0.05 }).recommendedKg).toBe(75); // below stress → no cut
    expect(svc.computeRation({ ...base, nh3: 0.15 }).recommendedKg).toBe(68); // ×0.9 early stress
    expect(svc.computeRation({ ...base, nh3: 0.3 }).recommendedKg).toBe(60); // ×0.8 high
    expect(svc.computeRation({ ...base, nh3: 0.5 }).recommendedKg).toBe(53); // ×0.7 toxic
  });

  it('compounds environmental stressors', () => {
    expect(svc.computeRation({ ...base, do: 3.5 }).recommendedKg).toBe(64); // ×0.85
    expect(svc.computeRation({ ...base, nh3: 0.4 }).recommendedKg).toBe(60); // ×0.8
    expect(svc.computeRation({ ...base, temp: 34 }).recommendedKg).toBe(68); // ×0.9
    // All three multiply: 0.85×0.8×0.9 = 0.612 → 75×0.612 = 46
    const r = svc.computeRation({ ...base, do: 3.5, nh3: 0.4, temp: 34 });
    expect(r.recommendedKg).toBe(46);
  });

  it('reduces feed in cool / cold water (both ends of the temp curve)', () => {
    expect(svc.computeRation({ ...base, temp: 26 }).recommendedKg).toBe(64); // <28 → ×0.85
    expect(svc.computeRation({ ...base, temp: 22 }).recommendedKg).toBe(53); // <24 → ×0.70
    expect(svc.computeRation({ ...base, temp: 30 }).recommendedKg).toBe(75); // optimal band → ×1.0
    expect(svc.computeRation({ ...base, temp: 26 }).reasons).toContain(
      '−15% cool water',
    );
    expect(svc.computeRation({ ...base, temp: 22 }).reasons).toContain(
      '−30% cold water',
    );
  });

  it('per-meal amounts always sum back to the recommended ration', () => {
    // Uneven split (50/3) must still conserve the total.
    const r = svc.computeRation({ ...base, fr: 2, mealsPerDay: 3 }); // base 60kg
    expect(r.recommendedKg).toBe(60);
    const sum = r.perMeal.reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(60);
    // An odd ration (48 / 4) also conserves.
    const r2 = svc.computeRation({ ...base, inMoltPeak: true, do: 3.5 });
    const sum2 = r2.perMeal.reduce((a, b) => a + b, 0);
    expect(Math.round(sum2 * 100) / 100).toBe(r2.recommendedKg);
  });

  it('stacks tray × molt × env together', () => {
    // 75 × 0.75(molt) × 0.85(DO) = 47.8125 → 48 whole kg (E3)
    const r = svc.computeRation({ ...base, inMoltPeak: true, do: 3.5 });
    expect(r.recommendedKg).toBe(48);
    expect(r.reasons).toEqual(['−25% molt window', '−15% low DO']);
  });

  it('honors an FR override', () => {
    expect(svc.computeRation({ ...base, fr: 2 }).baseRationKg).toBe(60); // 3000×2%
  });

  it('picks the species-specific FR table when species is given', () => {
    // At ABW 35g: vannamei tapers to 1.8%, tiger (monodon) holds a higher 2.0%.
    expect(svc.computeRation({ livePopulation: 100_000, abwG: 35 }).frPct).toBe(
      1.8,
    );
    expect(
      svc.computeRation({
        livePopulation: 100_000,
        abwG: 35,
        species: 'Penaeus monodon',
      }).frPct,
    ).toBe(2);
    // Scampi (freshwater prawn) uses a lower juvenile rate than vannamei.
    expect(
      svc.computeRation({ livePopulation: 100_000, abwG: 2, species: 'scampi' })
        .frPct,
    ).toBe(8);
    expect(svc.computeRation({ livePopulation: 100_000, abwG: 2 }).frPct).toBe(
      10,
    ); // vannamei
  });

  it('computes adherence clamped to [0,1]', () => {
    expect(svc.adherence(60, 75)).toBe(0.8);
    expect(svc.adherence(100, 75)).toBe(1); // clamp
    expect(svc.adherence(0, 75)).toBe(0);
  });
});

/**
 * E3 / E-D3 — the ration is reported to the precision it actually has.
 *
 * `biomass = N × ABW / 1000`, and every other term is a multiplier between
 * 0.75 and 1.07. So the answer is dominated by two estimates that are each
 * wrong by tens of percent, in OPPOSITE directions: live population is
 * systematically over-estimated (mortality is chronically under-reported —
 * dead animals sink or are eaten), and ABW is under-estimated whenever the
 * sampling is stale (the shrimp have grown since).
 *
 * Two decimal places on top of that is not precision, it is a claim. A
 * two-decimal figure reads as MEASURED however it is captioned.
 */
describe('honest rounding (E3)', () => {
  // Same pure-engine construction as above: repo and ponds are unused here.
  const svc = new FeedAdvisorService(
    null as any,
    new ShrimpCalculationsService(),
    null as any,
  );

  it('reports whole kilograms below 100', () => {
    const r = svc.computeRation({ livePopulation: 120_000, abwG: 25, nh3: 0.15 });
    expect(Number.isInteger(r.recommendedKg)).toBe(true);
  });

  it('reports to the nearest 5 kg above 100', () => {
    // Nobody scoops 342 kg rather than 340. The difference is noise wearing
    // the clothes of signal.
    const r = svc.computeRation({ livePopulation: 600_000, abwG: 30 });
    expect(r.recommendedKg % 5).toBe(0);
    expect(r.recommendedKg).toBeGreaterThan(100);
  });

  it('rounds the per-meal split too — that is the number acted on', () => {
    const r = svc.computeRation({ livePopulation: 120_000, abwG: 25, mealsPerDay: 3 });
    for (const m of r.perMeal) expect(Number.isInteger(m)).toBe(true);
  });

  it('still conserves: the meals sum to the day exactly', () => {
    // Rounding each meal independently would drift the daily total, which is
    // a real error rather than a cosmetic one.
    for (const meals of [2, 3, 4, 5, 6]) {
      const r = svc.computeRation({ livePopulation: 120_000, abwG: 25, mealsPerDay: meals });
      const sum = r.perMeal.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(r.recommendedKg, 6);
    }
  });

  /**
   * A nursery pond genuinely feeds a few hundred grams. Whole-kg rounding
   * there would report "0 kg" for a real ration, which is a worse lie than
   * the one being fixed.
   */
  it('keeps sub-kilogram rations legible rather than rounding them to nothing', () => {
    const r = svc.computeRation({ livePopulation: 2_000, abwG: 1 });
    expect(r.recommendedKg).toBeGreaterThan(0);
    expect(r.recommendedKg).toBeLessThan(1);
  });
});

/**
 * E2 / E-D2 — confidence must change the ANSWER, not sit beside it.
 *
 * `computeConfidence` lives in pond-context, and `POST /feed-advisor/compute`
 * had no guard, no pondId and took raw numbers — so the engine never saw the
 * score. Only the client could join them, and it joined them VISUALLY: a
 * worried chip next to a precise number in a large font. Nothing hedged,
 * widened or refused.
 *
 * This is also the seam the daily-logging document left open on purpose. A
 * quick-mode-only log is legitimately "done" for the streak AND legitimately
 * not enough for a point estimate; both are true and the farmer should see
 * both.
 */
describe('confidence widens the answer (E2)', () => {
  const svc = new FeedAdvisorService(
    null as any,
    new ShrimpCalculationsService(),
    null as any,
  );
  const base = { livePopulation: 120_000, abwG: 25 };

  it('returns a point value when confidence is high', () => {
    // The whole argument for a point value is that it is defensible.
    const r = svc.computeRation({ ...base, confidence: 90 });
    expect(r.range).toBeUndefined();
    expect(r.recommendedKg).toBe(75);
  });

  it('returns a range on a low band, straddling the point value', () => {
    const r = svc.computeRation({ ...base, confidence: 20 });
    expect(r.range).toBeDefined();
    expect(r.range!.band).toBe('low');
    expect(r.range!.lowKg).toBeLessThan(r.recommendedKg);
    expect(r.range!.highKg).toBeGreaterThan(r.recommendedKg);
  });

  it('widens more on low confidence than on medium', () => {
    const low = svc.computeRation({ ...base, confidence: 20 }).range!;
    const med = svc.computeRation({ ...base, confidence: 60 }).range!;
    expect(low.highKg - low.lowKg).toBeGreaterThan(med.highKg - med.lowKg);
  });

  /**
   * The banding is pond-context's, imported rather than restated — my first
   * draft of this file restated it and got the thresholds wrong, which is
   * exactly how the chip a farmer SEES ends up disagreeing with the range they
   * ACT ON. 75 and 50 are the real boundaries.
   */
  it('bands on the same thresholds pond-context uses', () => {
    expect(svc.computeRation({ ...base, confidence: 75 }).range).toBeUndefined();
    expect(svc.computeRation({ ...base, confidence: 74 }).range!.band).toBe('medium');
    expect(svc.computeRation({ ...base, confidence: 50 }).range!.band).toBe('medium');
    expect(svc.computeRation({ ...base, confidence: 49 }).range!.band).toBe('low');
  });

  it('leaves an older client, which sends no confidence, exactly as it was', () => {
    const r = svc.computeRation({ ...base });
    expect(r.range).toBeUndefined();
    expect(r.recommendedKg).toBe(75);
  });

  it('offers no range on a fasting day — zero is not uncertain', () => {
    // "0 to 0 kg" would be noise, and the answer is not an estimate at all.
    const r = svc.computeRation({ ...base, confidence: 10, fasting: true });
    expect(r.recommendedKg).toBe(0);
    expect(r.range).toBeUndefined();
  });

  it('rounds the range ends as honestly as the point value', () => {
    const r = svc.computeRation({ livePopulation: 600_000, abwG: 30, confidence: 20 });
    expect(r.range!.lowKg % 5).toBe(0);
    expect(r.range!.highKg % 5).toBe(0);
  });
});
