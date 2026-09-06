import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedPlan } from './feed-plan.entity';
import { ShrimpCalculationsService } from '../shrimp-calculations/shrimp-calculations.service';
import { PondsService } from '../ponds/ponds.service';
import { confidenceBand } from '../pond-context/pond-context.service';

export type TrayResidue = 'empty' | 'few_left' | 'a_lot_left';

export interface RationInput {
  /** Estimated live population N(t). */
  livePopulation: number;
  /** Average body weight (g). */
  abwG: number;
  /** Cultured species (free-text; normalized internally). Picks the FR table. */
  species?: string;
  /** Override FR%; otherwise derived from ABW + species via the FR table. */
  fr?: number;
  /** Last feeding-tray residue score. */
  lastTray?: TrayResidue | null;
  /** Inside a lunar molt-peak window (feed-cut). */
  inMoltPeak?: boolean;
  /** Dissolved oxygen (mg/L). */
  do?: number;
  /** FREE / un-ionised ammonia NH3-N (mg/L) — not total ammonia (TAN). */
  nh3?: number;
  /** Water temperature (°C). */
  temp?: number;
  fasting?: boolean;
  mealsPerDay?: number;
  /**
   * How complete and recent the inputs are, 0–100 (E2 / E-D2).
   *
   * `computeConfidence` lives in pond-context and the engine never saw it —
   * only the CLIENT could join the two, and it joined them visually: a chip
   * next to the hero number. Nothing anywhere hedged, widened or refused. A
   * `low` band still produced a precise figure in a large font.
   *
   * Passed in rather than recomputed here, so there is ONE definition of
   * confidence, server-side — the same discipline that makes `logProgress.ts`
   * the single definition of "done".
   *
   * Optional: an older client sends nothing and gets exactly the old
   * behaviour, a point value.
   */
  confidence?: number;
}

/**
 * A ration expressed as a range rather than a point (E2).
 *
 * NOT an error bar and not a statistical claim — it is a presentation of KNOWN
 * INPUT UNCERTAINTY, derived from the confidence score by a documented,
 * testable mapping. Saying "42-52 kg" when the last sampling is sixteen days
 * old is honest in a way that "47 kg" is not.
 */
export interface RationRange {
  lowKg: number;
  highKg: number;
  /** The band that produced the spread, for the copy beside it. */
  band: 'low' | 'medium' | 'high';
}

export interface RationResult {
  biomassKg: number;
  frPct: number;
  baseRationKg: number;
  recommendedKg: number;
  perMeal: number[];
  factors: { tray: number; molt: number; env: number; fasting: number };
  reasons: string[];
  /**
   * Present only when confidence was supplied AND is below `high`. Its
   * presence is the instruction to the client: show this instead of the point
   * value. `recommendedKg` stays populated so nothing downstream breaks and so
   * the per-meal split still has something to divide.
   */
  range?: RationRange;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Confidence band → how wide the range should be (E2 / E-D2).
 *
 * The spreads are a DOCUMENTED CHOICE, not a measurement of anything. They say
 * "we know less than usual, so here is a window instead of a point" — and the
 * widths were picked to be legible rather than derived: ±15% is visibly a
 * range without being useless, ±8% is a nudge, and high confidence gets no
 * range at all because the whole point is that the point value is defensible.
 *
 * The BANDING comes from pond-context's own `confidenceBand`; only the widths
 * live here.
 */
export const CONFIDENCE_SPREAD: Record<'low' | 'medium' | 'high', number> = {
  low: 0.15,
  medium: 0.08,
  high: 0,
};

/*
 * The banding itself is IMPORTED from pond-context, not restated. A second
 * copy is how the chip the farmer sees ends up disagreeing with the range they
 * act on — and my first draft of this file got the thresholds wrong, which is
 * the whole argument for not having two.
 */

/**
 * Round a feed quantity to a precision the number actually has (E3 / E-D3).
 *
 * `biomass = N × ABW / 1000`, and every other term is a multiplier between
 * 0.75 and 1.07. So the output is dominated by two ESTIMATES:
 *
 *  • `livePopulation` = stocking − Σ observed mortality. Mortality is
 *    chronically under-reported in shrimp farming — dead animals sink or are
 *    eaten — so this is SYSTEMATICALLY OVER-estimated.
 *  • `abwG` = the latest sampling. Two weeks stale means the shrimp have
 *    grown, so it is UNDER-estimated.
 *
 * Two errors of easily ±30–50%, pushing in opposite directions and cancelling
 * unpredictably. Reporting the result to two decimal places implied a
 * precision of ten grams that nothing upstream can support, and a two-decimal
 * figure reads as MEASURED however it is captioned.
 *
 * Whole kg below 100, nearest 5 kg above — because nobody weighs feed to ten
 * grams, and at 340 kg the difference between 340 and 342 is noise dressed as
 * signal. Feed is 50–60% of production cost; this costs nothing and removes a
 * falsehood.
 */
export const roundFeedKg = (n: number): number => {
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Below 1 kg, whole-kg rounding would say "0" for a real small ration —
  // early nursery ponds genuinely feed a few hundred grams.
  if (n < 1) return round2(n);
  if (n < 100) return Math.round(n);
  return Math.round(n / 5) * 5;
};

@Injectable()
export class FeedAdvisorService {
  constructor(
    @InjectRepository(FeedPlan)
    private readonly repo: Repository<FeedPlan>,
    private readonly calc: ShrimpCalculationsService,
    private readonly pondsService: PondsService,
  ) {}

  /**
   * Pure ration engine (farmer_features_spec.md §3):
   *   biomass    = N × ABW / 1000
   *   baseRation = biomass × FR(ABW)/100
   *   ration     = baseRation × trayFactor × moltFactor × envFactor
   *   ration     = fasting ? 0 : ration
   * Engines never branch on data source; all inputs are plain numbers.
   */
  computeRation(input: RationInput): RationResult {
    const mealsPerDay =
      input.mealsPerDay && input.mealsPerDay > 0 ? input.mealsPerDay : 4;
    const biomassKg = (input.livePopulation * input.abwG) / 1000;
    const frPct =
      input.fr ??
      this.calc.getRecommendedFeedingRate(input.abwG, input.species);
    const baseRationKg = (biomassKg * frPct) / 100;

    const reasons: string[] = [];

    // Tray residue → next-feed multiplier (jala §7 anco loop).
    let tray = 1.0;
    if (input.lastTray === 'empty') {
      tray = 1.07;
      reasons.push('+7% trays empty (under-fed)');
    } else if (input.lastTray === 'a_lot_left') {
      tray = 0.8;
      reasons.push('−20% lots of residue');
    }

    // Molt peak → cut feed (shrimp off-feed).
    /*
     * PROVENANCE (E4): the −25% molt cut and the +7% empty-tray bump are
     * both industry rules of thumb, UNCALIBRATED. Shrimp feed less while
     * moulting and an empty tray means yesterday was short — the DIRECTIONS
     * are well established; these exact magnitudes are not measured here.
     */
    const molt = input.inMoltPeak ? 0.75 : 1.0;
    if (input.inMoltPeak) reasons.push('−25% molt window');

    // Environmental stressors compound.
    let env = 1.0;
    if (input.do !== undefined && input.do < 4) {
      env *= 0.85;
      reasons.push('−15% low DO');
    }
    // Free (un-ionised) NH3-N (mg/L) stresses shrimp; sub-lethal effects begin
    // ~0.1 mg/L. Graded cut — harder the higher the toxic fraction. (input.nh3 is
    // free ammonia, e.g. PondContext.freeAmmoniaMgL, not total ammonia/TAN.)
    if (input.nh3 !== undefined) {
      if (input.nh3 > 0.45) {
        env *= 0.7;
        reasons.push('−30% toxic ammonia');
      } else if (input.nh3 > 0.25) {
        env *= 0.8;
        reasons.push('−20% high ammonia');
      } else if (input.nh3 > 0.1) {
        env *= 0.9;
        reasons.push('−10% ammonia stress');
      }
    }
    // Temperature: vannamei feed best ~28–32°C. Appetite falls off both ends —
    // heat above ~33°C, and (more sharply) cool water below ~28°C.
    if (input.temp !== undefined) {
      if (input.temp > 33) {
        env *= 0.9;
        reasons.push('−10% high temp');
      } else if (input.temp < 24) {
        env *= 0.7;
        reasons.push('−30% cold water');
      } else if (input.temp < 28) {
        env *= 0.85;
        reasons.push('−15% cool water');
      }
    }

    const fasting = input.fasting ? 0 : 1;
    if (input.fasting) reasons.push('Fasting day — no feed');

    // Rounded to the precision the inputs actually support — see roundFeedKg.
    const recommendedKg = roundFeedKg(baseRationKg * tray * molt * env * fasting);
    /**
     * Split evenly, with the last meal absorbing the remainder so the per-meal
     * amounts sum back to `recommendedKg` exactly (no daily drift).
     *
     * The per-meal figures are rounded the SAME way, deliberately: this is the
     * number the farmer acts on at the pond side, scooping from a sack. A
     * whole-kg hero with 22.47 kg meals underneath would put the false
     * precision back where it does the most work.
     */
    const mealSize = roundFeedKg(recommendedKg / mealsPerDay);
    const perMeal = Array.from({ length: mealsPerDay }, () => mealSize);
    perMeal[mealsPerDay - 1] = roundFeedKg(
      recommendedKg - mealSize * (mealsPerDay - 1),
    );

    /**
     * Low or medium confidence returns a RANGE (E2 / E-D2).
     *
     * `computeConfidence` already knew the inputs were thin; the engine simply
     * never saw the score, so a `low` band still produced a precise number in
     * a large font with a worried chip beside it. Two subsystems computing
     * different truths, and only the optimistic one was ever acted on.
     *
     * This is also the seam the daily-logging document deliberately left open:
     * a quick-mode-only log is legitimately "done" for the streak AND
     * legitimately not enough for a point estimate. Both are true, and the
     * farmer should see both.
     */
    const range =
      input.confidence === undefined || fasting === 0
        ? undefined
        : (() => {
            const band = confidenceBand(input.confidence);
            const spread = CONFIDENCE_SPREAD[band];
            if (spread === 0) return undefined;
            return {
              lowKg: roundFeedKg(recommendedKg * (1 - spread)),
              highKg: roundFeedKg(recommendedKg * (1 + spread)),
              band,
            };
          })();

    return {
      biomassKg: round2(biomassKg),
      frPct,
      baseRationKg: round2(baseRationKg),
      recommendedKg,
      perMeal,
      factors: { tray, molt, env: round2(env), fasting },
      reasons,
      ...(range ? { range } : {}),
    };
  }

  /** Adherence = actual / recommended, clamped to [0,1]. */
  adherence(actualKg: number, recommendedKg: number): number {
    if (recommendedKg <= 0) return actualKg <= 0 ? 1 : 0;
    return Math.max(0, Math.min(1, actualKg / recommendedKg));
  }

  // ── Persistence ─────────────────────────────────────────────────────────
  async generate(
    pondId: string,
    date: string,
    input: RationInput,
    userId: string,
    cropId?: string,
  ): Promise<FeedPlan> {
    // Generating and persisting a feed plan is planning — WRITE_MANAGEMENT.
    await this.pondsService.verifyAccess(pondId, userId, 'WRITE_MANAGEMENT');
    const r = this.computeRation(input);
    const plan = this.repo.create({
      pondId,
      cropId: cropId ?? null,
      date,
      biomassKg: r.biomassKg,
      frPct: r.frPct,
      baseRationKg: r.baseRationKg,
      recommendedKg: r.recommendedKg,
      perMeal: r.perMeal,
      factors: r.factors,
      reasons: r.reasons,
      actualKg: null,
      adherence: null,
    });
    return this.repo.save(plan);
  }

  async recent(pondId: string, userId: string): Promise<FeedPlan[]> {
    await this.pondsService.verifyAccess(pondId, userId, 'READ');
    return this.repo.find({
      where: { pondId },
      order: { date: 'DESC' },
      take: 30,
    });
  }

  async logActual(
    id: string,
    actualKg: number,
    userId: string,
  ): Promise<FeedPlan> {
    const plan = await this.repo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Feed plan not found');
    // Recording what was actually fed is field data, not planning.
    await this.pondsService.verifyAccess(plan.pondId, userId, 'WRITE_OPERATIONAL');
    plan.actualKg = actualKg;
    plan.adherence = round2(
      this.adherence(actualKg, Number(plan.recommendedKg)),
    );
    return this.repo.save(plan);
  }
}
