import { Injectable } from '@nestjs/common';

/**
 * PROVENANCE (E4). Every constant here says where it came from, because a
 * constant nobody can trace is a constant nobody can ever safely change — and
 * the first real farm data that contradicts a prediction should be able to
 * move a number.
 *
 * FEATURES.md already admits these are "uncalibrated heuristics", but that
 * caveat lived only in a developer document: nothing in the code and nothing
 * in the UI told a farmer that a predicted pre-dawn DO is a rule of thumb
 * rather than a measurement. The UI half is a one-time hint on the aeration
 * and lunar screens.
 *
 * NOTHING HERE IS RECALIBRATED. Changing a number without farm data would only
 * swap one uncalibrated guess for another; this documents what we have.
 */

/** Exact unit conversion. Not a heuristic. */
const HP_TO_KW = 0.746;

/**
 * Aerator sizing: about 2 HP per tonne of standing biomass.
 *
 * SOURCE: industry rule of thumb, widely quoted for semi-intensive vannamei
 * and consistent with the 1 HP per 400-500 kg range in common extension
 * advice. UNCALIBRATED against this app's own farms.
 */
const HP_PER_KG = 1 / 500;

export interface NightDoInput {
  currentDo: number; // mg/L
  biomassKg: number;
  areaM2: number;
  installedHp: number;
  runHours: number; // planned aerator on-hours overnight
  /** Plankton density proxy (0..1), higher = more respiration. Default 0.4. */
  planktonLoad?: number;
  temp?: number; // °C
  nightHours?: number; // default 8
  /** Tunable coefficients (mg/L per unit). */
  kBiomass?: number;
  kPlankton?: number;
  kAeration?: number;
}

export interface AerationAdequacy {
  requiredHp: number;
  installedHp: number;
  deficitHp: number; // >0 = under-aerated
  adequacyRatio: number; // installed / required
  underAerated: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round3 = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Aeration & Power Optimizer (farmer_features_spec.md §4). Pure engine —
 * attacks the #2 cost (electricity/diesel) and forecasts pre-dawn DO crashes.
 */
@Injectable()
export class AerationService {
  /** requiredHP = biomass / 500 (≈ 2 HP per tonne standing biomass). */
  requiredHp(biomassKg: number): number {
    return biomassKg * HP_PER_KG;
  }

  /** Installed vs required adequacy; positive deficit ⇒ under-aerated. */
  adequacy(biomassKg: number, installedHp: number): AerationAdequacy {
    const requiredHp = this.requiredHp(biomassKg);
    const deficitHp = requiredHp - installedHp;
    return {
      requiredHp: round2(requiredHp),
      installedHp,
      deficitHp: round2(deficitHp),
      adequacyRatio:
        requiredHp > 0 ? round2(installedHp / requiredHp) : Infinity,
      underAerated: deficitHp > 0,
    };
  }

  /** Grid power cost = Σ HP × 0.746 × runHours × ₹/kWh. */
  powerCostGrid(totalHp: number, runHours: number, ratePerKwh: number): number {
    return round2(totalHp * HP_TO_KW * runHours * ratePerKwh);
  }

  /** Diesel power cost = Σ L/hr × runHours × ₹/L. */
  powerCostDiesel(
    litresPerHour: number,
    runHours: number,
    ratePerLitre: number,
  ): number {
    return round2(litresPerHour * runHours * ratePerLitre);
  }

  /** Contribution of power cost to ₹/kg of shrimp. */
  costPerKg(powerCost: number, harvestBiomassKg: number): number {
    if (harvestBiomassKg <= 0) return 0;
    return round3(powerCost / harvestBiomassKg);
  }

  /**
   * Predicted pre-dawn DO minimum from a simple overnight O₂ budget:
   *   draw-down = (biomassDensity·kB + planktonLoad·kP) · tempFactor · nightHours
   *   supply    = (installedHp/area)·kA · runHours
   *   predDOmin = max(0, currentDO − drawDown + supply)
   * Higher biomass/temperature lowers it; more aeration raises it.
   */
  predictNightDoMin(input: NightDoInput): number {
    const nightHours = input.nightHours ?? 8;
    /*
     * The night-DO coefficients. All three are TUNABLE PER REQUEST (see
     * NightDoInput) and nothing in the product ever tunes them. That gap is
     * real and deliberately left open here: there is today no path from a
     * farmer's observation back to a coefficient. The knob stays; building the
     * wiring is not part of this change.
     *
     * SOURCE for all three: industry rules of thumb, UNCALIBRATED. They set
     * the shape of an overnight oxygen-decline curve, not a measured rate.
     */
    const kB = input.kBiomass ?? 0.25; // mg/L per (kg/m²) overnight
    const kP = input.kPlankton ?? 0.5; // mg/L per plankton-load unit
    const kA = input.kAeration ?? 0.04; // mg/L recovered per (HP/ha · hour)
    const planktonLoad = input.planktonLoad ?? 0.4;
    const temp = input.temp ?? 30;
    const tempFactor = 1 + Math.max(0, temp - 28) * 0.03;

    const biomassDensity =
      input.areaM2 > 0 ? input.biomassKg / input.areaM2 : 0;
    const drawDown =
      (biomassDensity * kB + planktonLoad * kP) * tempFactor * nightHours;
    const supply =
      this.hpPerHa(input.installedHp, input.areaM2) * kA * input.runHours;
    return round2(Math.max(0, input.currentDo - drawDown + supply));
  }

  /**
   * Minimum overnight aerator hours to keep the predicted DO-min ≥ target.
   * Returns 0 when no aeration is needed, capped at `nightHours`.
   */
  recommendRunHours(
    input: Omit<NightDoInput, 'runHours'>,
    doTarget = 4,
  ): number {
    const nightHours = input.nightHours ?? 8;
    const zero = this.predictNightDoMin({ ...input, runHours: 0 });
    if (zero >= doTarget) return 0;
    const kA = input.kAeration ?? 0.04;
    const perHourSupply = this.hpPerHa(input.installedHp, input.areaM2) * kA;
    if (perHourSupply <= 0) return nightHours;
    const needed = (doTarget - zero) / perHourSupply;
    return round2(Math.min(nightHours, Math.max(0, needed)));
  }

  private hpPerHa(installedHp: number, areaM2: number): number {
    return areaM2 > 0 ? installedHp / (areaM2 / 10000) : 0;
  }
}
