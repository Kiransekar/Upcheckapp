import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiseaseRiskSnapshot } from './disease-risk-snapshot.entity';
import { PondsService } from '../ponds/ponds.service';

/**
 * Flat indicator set derived from a pond's latest data + trends. The derivation
 * (computing `*Up` slopes, threshold crossings) happens upstream; the engine
 * only maps indicators → per-disease scores, so it stays pure and testable.
 */
export interface DiseaseIndicators {
  // WSSV
  tempDrop3in48h?: boolean;
  doBelow4?: boolean;
  seasonWinter?: boolean;
  regionalWssv?: boolean;
  redBody?: boolean;
  // AHPND
  docBelow35?: boolean;
  yellowVibrioUp?: boolean;
  emptyGut?: boolean;
  paleHp?: boolean;
  // EHP
  sizeCvUp?: boolean;
  adgBelowExpected?: boolean;
  whiteFecesTray?: boolean;
  regionWfd?: boolean;
  // WFD
  vibrioUp?: boolean;
  ehpRiskUp?: boolean;
  // Luminous
  luminousVibrioUp?: boolean;
  nightGlow?: boolean;
  // RMS
  chronicDailyMortality?: boolean;
  multiStress?: boolean;
  // LSS
  looseShellObs?: boolean;
  mineralDeficit?: boolean;
  hpStress?: boolean;
}

export type DiseaseName =
  | 'WSSV'
  | 'AHPND'
  | 'EHP'
  | 'WFD'
  | 'Luminous'
  | 'RMS'
  | 'LSS';

export interface DiseaseRisk {
  disease: DiseaseName;
  score: number; // 0..100
  band: 'Low' | 'Watch' | 'Critical';
  triggers: Array<keyof DiseaseIndicators>;
  steps: string[];
}

/** Per-disease weighted indicator signatures (farmer_features_spec.md §2). */
const SIGNATURES: Record<
  DiseaseName,
  Array<{ indicator: keyof DiseaseIndicators; weight: number }>
> = {
  WSSV: [
    { indicator: 'tempDrop3in48h', weight: 0.3 },
    { indicator: 'doBelow4', weight: 0.15 },
    { indicator: 'seasonWinter', weight: 0.2 },
    { indicator: 'regionalWssv', weight: 0.2 },
    { indicator: 'redBody', weight: 0.15 },
  ],
  AHPND: [
    { indicator: 'docBelow35', weight: 0.25 },
    { indicator: 'yellowVibrioUp', weight: 0.3 },
    { indicator: 'emptyGut', weight: 0.25 },
    { indicator: 'paleHp', weight: 0.2 },
  ],
  EHP: [
    { indicator: 'sizeCvUp', weight: 0.3 },
    { indicator: 'adgBelowExpected', weight: 0.3 },
    { indicator: 'whiteFecesTray', weight: 0.25 },
    { indicator: 'regionWfd', weight: 0.15 },
  ],
  WFD: [
    { indicator: 'whiteFecesTray', weight: 0.4 },
    { indicator: 'vibrioUp', weight: 0.3 },
    { indicator: 'ehpRiskUp', weight: 0.3 },
  ],
  Luminous: [
    { indicator: 'luminousVibrioUp', weight: 0.6 },
    { indicator: 'nightGlow', weight: 0.4 },
  ],
  RMS: [
    { indicator: 'chronicDailyMortality', weight: 0.5 },
    { indicator: 'multiStress', weight: 0.5 },
  ],
  LSS: [
    { indicator: 'looseShellObs', weight: 0.4 },
    { indicator: 'mineralDeficit', weight: 0.4 },
    { indicator: 'hpStress', weight: 0.2 },
  ],
};

const STEPS: Record<DiseaseName, string[]> = {
  WSSV: [
    'Raise biosecurity: stop water exchange, disinfect gear, no new inputs',
    'Stabilize temperature; deepen water; maximize aeration',
    'Reduce feed; PCR-test if mortality begins',
  ],
  AHPND: [
    'Reduce feed; check feeding trays for empty guts',
    'Apply probiotics; reduce yellow-vibrio load',
    'Improve bottom hygiene; siphon sludge',
  ],
  EHP: [
    'Confirm via PCR; quantify size variation (CV)',
    'Improve feed quality; add gut probiotics',
    'Disinfect/dry pond between crops to break the cycle',
  ],
  WFD: [
    'Cut feed 20–30%; add gut probiotics/binders',
    'Reduce vibrio load; improve water quality',
  ],
  Luminous: [
    'Reduce luminous vibrio: probiotics, partial water exchange',
    'Avoid night feeding; improve aeration',
  ],
  RMS: [
    'Reduce multi-stress: stabilize DO, ammonia and temperature',
    'Lower handling stress; add minerals + probiotics',
  ],
  LSS: [
    'Top up Ca/Mg/K to molt targets (use the mineral dose calc)',
    'Hold alkalinity ≥120 ppm; improve feed; reduce HP stress',
  ],
};

const round1 = (n: number) => Math.round(n * 10) / 10;

@Injectable()
export class DiseaseWarningService {
  constructor(
    @InjectRepository(DiseaseRiskSnapshot)
    private readonly repo: Repository<DiseaseRiskSnapshot>,
    private readonly pondsService: PondsService,
  ) {}

  /**
   * Score every disease from the indicator set and return them ranked
   * high→low. score = 100 × Σ(weight where indicator matched).
   */
  computeRisks(indicators: DiseaseIndicators): DiseaseRisk[] {
    const risks: DiseaseRisk[] = (Object.keys(SIGNATURES) as DiseaseName[]).map(
      (disease) => {
        const triggers: Array<keyof DiseaseIndicators> = [];
        let sum = 0;
        for (const { indicator, weight } of SIGNATURES[disease]) {
          if (indicators[indicator]) {
            sum += weight;
            triggers.push(indicator);
          }
        }
        const score = round1(100 * sum);
        const band: DiseaseRisk['band'] =
          score >= 60 ? 'Critical' : score >= 30 ? 'Watch' : 'Low';
        return { disease, score, band, triggers, steps: STEPS[disease] };
      },
    );
    return risks.sort((a, b) => b.score - a.score);
  }

  /**
   * Cumulative disease risk in [0,1] — the max single-disease score scaled to a
   * fraction. Consumed by the Harvest-Timing engine's riskLoss term.
   */
  cumulativeRisk(indicators: DiseaseIndicators): number {
    const top = this.computeRisks(indicators)[0];
    return top ? top.score / 100 : 0;
  }

  /**
   * Linear-regression slope over a series — used upstream to set the `*Up`
   * trend indicators (positive slope above a threshold ⇒ rising).
   */
  linearSlope(values: number[]): number {
    const n = values.length;
    if (n < 2) return 0;
    const meanX = (n - 1) / 2;
    const meanY = values.reduce((a, b) => a + b, 0) / n;
    let num = 0;
    let den = 0;
    for (let i = 0; i < n; i++) {
      num += (i - meanX) * (values[i] - meanY);
      den += (i - meanX) ** 2;
    }
    return den === 0 ? 0 : num / den;
  }

  // ── Persistence ─────────────────────────────────────────────────────────
  async snapshot(
    pondId: string,
    date: string,
    indicators: DiseaseIndicators,
    userId: string,
    cropId?: string,
  ): Promise<DiseaseRiskSnapshot> {
    // Persisting a risk snapshot is field-level output — WRITE_OPERATIONAL.
    await this.pondsService.verifyAccess(pondId, userId, 'WRITE_OPERATIONAL');
    const risks = this.computeRisks(indicators);
    const snap = this.repo.create({
      pondId,
      cropId: cropId ?? null,
      date,
      risks,
    });
    return this.repo.save(snap);
  }

  async recent(pondId: string, userId: string): Promise<DiseaseRiskSnapshot[]> {
    await this.pondsService.verifyAccess(pondId, userId, 'READ');
    return this.repo.find({
      where: { pondId },
      order: { date: 'DESC' },
      take: 30,
    });
  }

  async latest(pondId: string, userId: string): Promise<DiseaseRiskSnapshot> {
    await this.pondsService.verifyAccess(pondId, userId, 'READ');
    const snap = await this.repo.findOne({
      where: { pondId },
      order: { date: 'DESC' },
    });
    if (!snap) throw new NotFoundException('No risk snapshot for this pond');
    return snap;
  }
}
