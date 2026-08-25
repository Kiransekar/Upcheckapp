import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedPlan } from './feed-plan.entity';
import { ShrimpCalculationsService } from '../shrimp-calculations/shrimp-calculations.service';
import { PondsService } from '../ponds/ponds.service';

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
}

export interface RationResult {
  biomassKg: number;
  frPct: number;
  baseRationKg: number;
  recommendedKg: number;
  perMeal: number[];
  factors: { tray: number; molt: number; env: number; fasting: number };
  reasons: string[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

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

    const recommendedKg = round2(baseRationKg * tray * molt * env * fasting);
    // Split evenly, but make the last meal absorb the rounding remainder so the
    // per-meal amounts sum back to recommendedKg exactly (no daily drift).
    const mealSize = round2(recommendedKg / mealsPerDay);
    const perMeal = Array.from({ length: mealsPerDay }, () => mealSize);
    perMeal[mealsPerDay - 1] = round2(
      recommendedKg - mealSize * (mealsPerDay - 1),
    );

    return {
      biomassKg: round2(biomassKg),
      frPct,
      baseRationKg: round2(baseRationKg),
      recommendedKg,
      perMeal,
      factors: { tray, molt, env: round2(env), fasting },
      reasons,
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
