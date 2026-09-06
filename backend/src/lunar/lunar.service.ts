import { Injectable } from '@nestjs/common';

export interface MoonPhase {
  jd: number;
  phase: number; // 0=new … 0.5=full … →1=new
  ageDays: number;
  illumination: number; // 0..1
  name: string;
  moltLikelihood: number; // 0..1, =1 at new & full, =0 at quarters
  daysToSpringTide: number; // unsigned days to nearest new/full
  signedDaysToSpringTide: number; // <0 = approaching (pre), >0 = just passed (post)
  inMoltWindow: boolean; // within ±windowDays of a spring tide

  /**
   * TRUE phase instants (E5.1), corrected per Meeus ch. 49 and reported as
   * IST calendar days. The mean-phase figures above can be up to ±14 h out,
   * which is enough to name the wrong date — and this audience checks the
   * app against the Panchang.
   */
  /** `YYYY-MM-DD` in IST — what the farmer's calendar says. */
  nextNewMoonIst: string;
  nextFullMoonIst: string;
  /** The same instants, unconverted, for any caller that wants the time. */
  nextNewMoonAt: string;
  nextFullMoonAt: string;
  /** Distance to the nearest true spring tide, in days. */
  trueDaysToSpringTide: number;
}

export interface MoltVulnerabilityInput {
  do?: number;
  temp?: number;
  freeNh3?: number;
  phSwing?: number;
  /** Mineral deficit as a fraction of target (0..1), max over Ca/Mg/K/alk. */
  mineralDeficitFrac?: number;
  diseaseHigh?: boolean;
  /** density / carrying-capacity density (0..1+). */
  densityRatio?: number;
  tray?: 'empty' | 'few_left' | 'a_lot_left' | null;
  /** Latest salinity (ppt). Low salinity (< 5) sharply raises soft-shell risk. */
  salinity?: number;
}

export type StepCategory =
  | 'mineral'
  | 'aeration'
  | 'feed'
  | 'handling'
  | 'biosecurity'
  | 'water'
  | 'monitoring'
  | 'general';

export type StepPriority = 'critical' | 'important' | 'routine';

export interface PlaybookStep {
  category: StepCategory;
  priority: StepPriority;
  /** Farmer-facing English text (sibling-engine convention). */
  text: string;
  /** Which datum triggered a data-driven step (transparency); absent for baseline. */
  trigger?: string;
}

export interface LunarPlaybook {
  /** Position relative to the nearest spring tide. */
  phaseRel: 'pre' | 'peak' | 'post' | 'inter';
  /** Short phase label, e.g. "Molt peak — protect the pond". */
  phaseLabel: string;
  /** One-line summary with timing + risk band. */
  headline: string;
  /** Honesty rule (spec §1): molt timing is a refined prediction, not a certainty. */
  note: string;
  steps: PlaybookStep[];
}

export interface MoltRisk {
  moltPressure: number; // 0..1
  vulnerability: number; // 0..1
  score: number; // 0..100
  band: 'Low' | 'Watch' | 'Critical';
  phaseRel: 'pre' | 'peak' | 'post' | 'none';
}

import { nextPhase, daysToNearestSpringTide } from './moon-phase-meeus';
import { toIstDateString } from '../common/ist-date';

const SYNODIC = 29.530588853;
const REF_NEW_MOON_JD = 2451550.26; // 2000-01-06 18:14 UTC new moon
const MS_PER_DAY = 86400000;
const JD_UNIX_EPOCH = 2440587.5;

const frac = (x: number) => x - Math.floor(x);

/**
 * Lunar-cycle molt management (lunar_module_spec.md). Pure, deterministic — no
 * external API. Moon phase drives a semi-lunar molt-likelihood; the *risk* is
 * personalized by each pond's latest data.
 */
@Injectable()
export class LunarService {
  /** Julian Day from a UTC date. */
  julianDay(date: Date): number {
    return date.getTime() / MS_PER_DAY + JD_UNIX_EPOCH;
  }

  /** Full moon-phase computation for a date (spec §2). */
  moonPhase(date: Date, windowDays = 2): MoonPhase {
    const jd = this.julianDay(date);
    const phase = frac((jd - REF_NEW_MOON_JD) / SYNODIC);
    const ageDays = phase * SYNODIC;
    const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
    const moltLikelihood = (Math.cos(4 * Math.PI * phase) + 1) / 2;
    // Distance (in phase) to the nearest spring tide at phase 0, 0.5 or 1.
    const distPhase = Math.min(phase, Math.abs(phase - 0.5), 1 - phase);
    const daysToSpringTide = distPhase * SYNODIC;
    // Signed days to the nearest spring tide: negative = approaching it (pre-molt),
    // positive = just passed it (post-molt). Springs sit at phase 0, 0.5 and 1.
    const nearestSpring = [0, 0.5, 1].reduce(
      (best, s) => (Math.abs(phase - s) < Math.abs(phase - best) ? s : best),
      0,
    );
    const signedDaysToSpringTide = (phase - nearestSpring) * SYNODIC;

    /**
     * The TRUE next new and full moon, and the true distance to the nearest
     * spring tide (E5.1).
     *
     * Everything above is MEAN phase — a fixed 29.53-day month — which is fine
     * for illumination and the shape of the molt curve, but wrong by up to
     * ±14 hours for the instant of a new or full moon. That is enough to put
     * the date on the wrong day, and this audience reads Amavasya and Purnima
     * off the Panchang, which uses true phase at local time. See
     * `moon-phase-meeus.ts`.
     *
     * The dates are emitted as IST CALENDAR DAYS, not as raw instants. The
     * September 2026 new moon is 03:26 UTC on the 11th — which is 08:56 IST on
     * the 11th — but a phase falling between 18:30 and 24:00 UTC lands on the
     * NEXT day in IST, and formatting the instant without converting is how
     * the app came to disagree with the farmer's own calendar.
     */
    const trueNextNewMoon = nextPhase(date, true);
    const trueNextFullMoon = nextPhase(date, false);

    return {
      jd,
      phase,
      ageDays,
      nextNewMoonIst: toIstDateString(trueNextNewMoon),
      nextFullMoonIst: toIstDateString(trueNextFullMoon),
      nextNewMoonAt: trueNextNewMoon.toISOString(),
      nextFullMoonAt: trueNextFullMoon.toISOString(),
      /** True distance, which is what the molt window should key on. */
      trueDaysToSpringTide: daysToNearestSpringTide(date),
      illumination,
      name: this.phaseName(phase),
      moltLikelihood,
      daysToSpringTide,
      signedDaysToSpringTide,
      inMoltWindow: daysToSpringTide <= windowDays,
    };
  }

  private phaseName(phase: number): string {
    const names = [
      'New',
      'Waxing Crescent',
      'First Quarter',
      'Waxing Gibbous',
      'Full',
      'Waning Gibbous',
      'Last Quarter',
      'Waning Crescent',
    ];
    // 8 buckets centered on the 8 principal phases.
    const idx = Math.round(phase * 8) % 8;
    return names[idx];
  }

  /**
   * How lunar-locked this pond is right now, from latest ABW (spec §3):
   * clamp((ABW − 3) / 17, 0.2, 1.0). Bigger shrimp → tighter lunar lock.
   */
  lunarLockFactor(abwG: number): number {
    return Math.max(0.2, Math.min(1.0, (abwG - 3) / 17));
  }

  /**
   * Mineral dose to correct a deficit (india §5 / spec §8):
   *   dose_kg = deficit_ppm × volume_m³ / 1000 / purity_fraction
   * e.g. raise K by 10 ppm in 1000 m³ with MOP (50% K) → 20 kg.
   */
  mineralDoseKg(
    deficitPpm: number,
    volumeM3: number,
    purityFraction: number,
  ): number {
    if (purityFraction <= 0) return 0;
    return (deficitPpm * volumeM3) / 1000 / purityFraction;
  }

  /**
   * Molt Risk Score (spec §4): 100 × MoltPressure × (0.4 + 0.6 × Vulnerability).
   * The 0.4 floor means an imminent molt always registers some risk, but a
   * stressed pond escalates hard.
   */
  computeMoltRisk(
    phase: MoonPhase,
    abwG: number,
    v: MoltVulnerabilityInput,
  ): MoltRisk {
    const moltPressure = phase.moltLikelihood * this.lunarLockFactor(abwG);

    const vDO =
      v.do === undefined
        ? 0.1
        : v.do < 3
          ? 1
          : v.do < 4
            ? 0.7
            : v.do < 5
              ? 0.4
              : 0.1;
    const vTemp =
      v.temp === undefined
        ? 0.1
        : v.temp > 33
          ? 0.8
          : v.temp > 31
            ? 0.5
            : v.temp < 26
              ? 0.4
              : 0.1;
    const vNh3 =
      v.freeNh3 === undefined
        ? 0.1
        : v.freeNh3 > 0.3
          ? 1
          : v.freeNh3 > 0.1
            ? 0.5
            : 0.1;
    const vPh = (v.phSwing ?? 0) > 0.5 ? 0.6 : 0.2;
    const vDisease = v.diseaseHigh ? 0.8 : 0.2;
    const vDensity = Math.max(0, Math.min(1, v.densityRatio ?? 0.2));
    const vMineral = Math.max(0, Math.min(1, v.mineralDeficitFrac ?? 0));
    const vAppetite =
      v.tray === 'a_lot_left' ? 0.6 : v.tray === 'few_left' ? 0.3 : 0.1;

    const vulnerability =
      vDO * 0.22 +
      vMineral * 0.22 +
      vDisease * 0.15 +
      vTemp * 0.12 +
      vNh3 * 0.1 +
      vDensity * 0.08 +
      vAppetite * 0.06 +
      vPh * 0.05;

    const score = 100 * moltPressure * (0.4 + 0.6 * vulnerability);
    const band: MoltRisk['band'] =
      score >= 60 ? 'Critical' : score >= 30 ? 'Watch' : 'Low';

    // Phase relative to the nearest spring tide (waxing→pre, etc.).
    let phaseRel: MoltRisk['phaseRel'] = 'none';
    if (phase.inMoltWindow) {
      phaseRel = phase.daysToSpringTide <= 1 ? 'peak' : 'pre';
    }

    return {
      moltPressure: round4(moltPressure),
      vulnerability: round4(vulnerability),
      score: round2(score),
      band,
      phaseRel,
    };
  }

  /**
   * Phase × pond-data action playbook (spec §5). Maps the pond's position in the
   * semi-lunar cycle to concrete management steps — baseline steps for the phase
   * plus data-driven escalations from the pond's latest readings. This is the
   * "which management during which phase" layer on top of the raw phase data.
   */
  buildPlaybook(
    phase: MoonPhase,
    risk: MoltRisk,
    v: MoltVulnerabilityInput,
  ): LunarPlaybook {
    const sd = phase.signedDaysToSpringTide;
    const days = Math.abs(sd);
    const target = phase.illumination > 0.5 ? 'full moon' : 'new moon';

    // 4-way phase classification (computeMoltRisk only distinguishes pre/peak).
    const phaseRel: LunarPlaybook['phaseRel'] =
      days <= 1
        ? 'peak'
        : sd < 0 && days <= 3
          ? 'pre'
          : sd > 0 && days <= 3
            ? 'post'
            : 'inter';

    const steps: PlaybookStep[] = [];
    const add = (
      category: StepCategory,
      priority: StepPriority,
      text: string,
      trigger?: string,
    ) => steps.push({ category, priority, text, trigger });

    // Shared data flags.
    const lowDO = v.do !== undefined && v.do < 4;
    const hotWater = v.temp !== undefined && v.temp > 33;
    const highNh3 = v.freeNh3 !== undefined && v.freeNh3 > 0.1;
    const mineralLow = (v.mineralDeficitFrac ?? 0) > 0;
    const crowded = (v.densityRatio ?? 0) > 0.8;
    const lowSalinity = v.salinity !== undefined && v.salinity < 5;
    const heavyResidue = v.tray === 'a_lot_left';

    let phaseLabel: string;
    let headline: string;

    if (phaseRel === 'pre') {
      phaseLabel = 'Pre-molt — build reserves';
      headline = `Molt surge expected in ~${days.toFixed(0)} day(s) around the ${target}. Build mineral and oxygen reserves now.`;
      add(
        'mineral',
        'important',
        'Top up calcium, magnesium & potassium to molt targets now, before demand spikes.',
      );
      add(
        'water',
        'important',
        'Raise alkalinity toward ≥ 120 ppm (agricultural lime / dolomite) for shell hardening.',
      );
      add(
        'biosecurity',
        'routine',
        'Add probiotic / immunostimulant and avoid introducing stressors before the window.',
      );
      if (mineralLow)
        add(
          'mineral',
          lowSalinity ? 'critical' : 'important',
          'Mineral deficit detected — dose Ca/Mg/K via the mineral calculator before the molt window opens.',
          'mineralDeficit',
        );
      if (lowSalinity)
        add(
          'mineral',
          'important',
          'Low salinity: soft-shell risk is high at molt — prioritise potassium & magnesium top-up.',
          'salinity',
        );
      if (lowDO || crowded)
        add(
          'aeration',
          'important',
          'Service aerators now and target night DO ≥ 4 mg/L — molting sharply raises oxygen demand.',
          lowDO ? 'lowDO' : 'density',
        );
      if (highNh3)
        add(
          'water',
          'important',
          'Bring ammonia down before the molt — trim feed / exchange water; toxic NH₃ stresses molting shrimp.',
          'freeNh3',
        );
    } else if (phaseRel === 'peak') {
      phaseLabel = 'Molt peak — protect the pond';
      headline = `Molt window is open (${target}). Shrimp are soft and vulnerable — protect, don't disturb.`;
      add(
        'feed',
        'important',
        'Reduce feed 15–30% — shrimp go off-feed while molting and uneaten feed fouls water.',
      );
      add(
        'aeration',
        'critical',
        'Maximise aeration, especially 02:00–06:00 (pre-dawn DO minimum).',
      );
      add(
        'handling',
        'critical',
        'No handling — suspend sampling, netting, partial harvest and chemical treatments; soft shrimp die from stress and cannibalism.',
      );
      add(
        'mineral',
        'important',
        'Hold calcium, magnesium, potassium and alkalinity levels to support shell hardening.',
      );
      if (lowDO)
        add(
          'aeration',
          'critical',
          `DO is ${v.do} mg/L — run ALL aerators continuously and keep emergency oxygen / peroxide on standby.`,
          'lowDO',
        );
      if (heavyResidue)
        add(
          'feed',
          'important',
          'Heavy tray residue confirms the molt — cut feed 30% until appetite returns.',
          'tray',
        );
      if (v.diseaseHigh)
        add(
          'biosecurity',
          'critical',
          'Biosecurity lockdown: no water exchange, no new inputs, disinfect all gear — molt stress widens the disease window.',
          'disease',
        );
      if (mineralLow)
        add(
          'mineral',
          'critical',
          'Soft-shell risk HIGH — immediate K/Mg/Ca top-up (especially in low-salinity ponds).',
          'mineralDeficit',
        );
      if (hotWater)
        add(
          'water',
          'important',
          'Heat + molt — deepen the water and add extra night aeration to ease stress.',
          'temp',
        );
    } else if (phaseRel === 'post') {
      phaseLabel = 'Post-molt — recover & grow';
      headline = `Past the ${target} molt by ~${days.toFixed(0)} day(s). Shells are hardening — feed the growth window.`;
      add(
        'feed',
        'important',
        'Restore feed and add +5–10% — the fastest growth happens right after molt; ride the compensatory window.',
      );
      add(
        'monitoring',
        'routine',
        'Watch for soft-shell / Loose-Shell Syndrome and cannibalism over the next 2–3 days.',
      );
      add(
        'monitoring',
        'routine',
        'Safe window to sample for a weight check once shells have hardened (~3 days after the tide).',
      );
      add(
        'mineral',
        'routine',
        'Confirm Ca/Mg/K held through hardening; top up if levels dropped.',
      );
      if (mineralLow)
        add(
          'mineral',
          'important',
          'Minerals still low post-molt — top up to support new-shell hardening and prevent soft-shell.',
          'mineralDeficit',
        );
      if (v.tray === 'empty')
        add(
          'feed',
          'important',
          'Trays emptying fast — shrimp are feeding hard; raise the ration to capture growth.',
          'tray',
        );
    } else {
      phaseLabel = 'Between molts — routine operations';
      const toNext = phase.daysToSpringTide.toFixed(0);
      headline = `No molt surge near — next window in ~${toNext} day(s). Good time for routine work.`;
      add(
        'general',
        'routine',
        'Routine feeding and management — no molt surge in the immediate window.',
      );
      add(
        'monitoring',
        'routine',
        'Best window for sampling, grading, partial harvest and pond operations.',
      );
      if (mineralLow)
        add(
          'mineral',
          'routine',
          'Start building mineral reserves now, ahead of the next molt window.',
          'mineralDeficit',
        );
      if (lowDO)
        add(
          'aeration',
          'important',
          'Low DO — service aeration regardless of phase.',
          'lowDO',
        );
    }

    return {
      phaseRel,
      phaseLabel,
      headline: `${headline}${risk.band === 'Critical' ? ' Risk is CRITICAL — act today.' : ''}`,
      note: 'Molt timing is a prediction the app refines from your pond’s own observations — treat disease links as elevated-risk flags, not certainties.',
      steps,
    };
  }
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;
