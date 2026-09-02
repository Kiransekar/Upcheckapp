import { Injectable } from '@nestjs/common';

/** Cultured species the engines tune their constants for. */
export type ShrimpSpecies = 'vannamei' | 'monodon' | 'indicus' | 'scampi';

/**
 * Coerce a free-text species string (scientific name, common name, or code) to a
 * supported ShrimpSpecies, defaulting to vannamei. Mirrors the frontend
 * normalizeSpecies / toThresholdSpecies coercion so all surfaces agree.
 */
export function normalizeShrimpSpecies(
  raw: string | null | undefined,
): ShrimpSpecies {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('monodon') || s.includes('tiger') || s.includes('black'))
    return 'monodon';
  if (
    s.includes('scampi') ||
    s.includes('macrobrachium') ||
    s.includes('rosenbergii')
  )
    return 'scampi';
  if (s.includes('indicus')) return 'indicus';
  return 'vannamei';
}

@Injectable()
export class ShrimpCalculationsService {
  /**
   * Calculate Feed Conversion Ratio (FCR)
   * FCR = Total Feed Used (kg) / Total Harvest Weight (kg)
   * Lower is better (typically 1.2-1.8 for shrimp)
   */
  calculateFcr(totalFeedKg: number, harvestWeightKg: number): number {
    if (harvestWeightKg === 0) return 0;
    return Math.round((totalFeedKg / harvestWeightKg) * 100) / 100;
  }

  /**
   * Calculate Average Daily Growth (ADG) in grams
   * ADG = (Final Weight - Initial Weight) / Days of Culture
   */
  calculateAdg(
    initialWeightG: number,
    finalWeightG: number,
    daysOfCulture: number,
  ): number {
    if (daysOfCulture === 0) return 0;
    return (
      Math.round(((finalWeightG - initialWeightG) / daysOfCulture) * 1000) /
      1000
    );
  }

  /**
   * Calculate Survival Rate (%)
   * SR = (Harvested Count / Initial Stock) * 100
   */
  calculateSurvivalRate(initialStock: number, harvestedCount: number): number {
    if (initialStock === 0) return 0;
    return Math.round((harvestedCount / initialStock) * 10000) / 100;
  }

  /**
   * Calculate Daily Feeding Amount based on biomass
   * Daily Feed = Biomass (kg) * Feeding Rate (%)
   */
  calculateDailyFeed(biomassKg: number, feedingPercentage: number): number {
    return Math.round(((biomassKg * feedingPercentage) / 100) * 100) / 100;
  }

  /**
   * Calculate Expected Harvest Weight
   * Expected = Stock Count * Survival Rate * Target Weight
   */
  calculateExpectedHarvest(
    stockingCount: number,
    survivalRatePercent: number,
    targetWeightG: number,
  ): {
    expectedCount: number;
    expectedWeightKg: number;
  } {
    const expectedCount = Math.round(
      (stockingCount * survivalRatePercent) / 100,
    );
    const expectedWeightKg =
      Math.round(((expectedCount * targetWeightG) / 1000) * 100) / 100;
    return { expectedCount, expectedWeightKg };
  }

  /**
   * Project growth based on ADG
   */
  projectGrowth(
    currentWeightG: number,
    adgG: number,
    daysToProject: number,
  ): {
    projectedWeightG: number;
    projectedWeightByWeek: number[];
  } {
    const projectedWeightG =
      Math.round((currentWeightG + adgG * daysToProject) * 100) / 100;
    const projectedWeightByWeek: number[] = [];

    for (let week = 1; week <= Math.ceil(daysToProject / 7); week++) {
      const days = Math.min(week * 7, daysToProject);
      projectedWeightByWeek.push(
        Math.round((currentWeightG + adgG * days) * 100) / 100,
      );
    }

    return { projectedWeightG, projectedWeightByWeek };
  }

  /**
   * Calculate biomass
   * Biomass = (Stock Count * Average Weight) / 1000
   */
  calculateBiomass(stockCount: number, averageWeightG: number): number {
    return Math.round(((stockCount * averageWeightG) / 1000) * 100) / 100;
  }

  /**
   * Species-specific feeding-rate (% body weight / day) by mean body weight.
   * Different cultured species feed at different rates and grow to different
   * sizes, so a single table mis-advises non-vannamei farmers.
   *
   * Sources: vannamei penaeid baseline; P. monodon grow-out ~3–5% BW (FAO
   * AFFRIS / CP charts); M. rosenbergii (scampi) ~5% juvenile grow-out, lower
   * tail (freshwater prawn). Step thresholds on ABW(g). Values are tunable —
   * confirm against your local feed brand's chart.
   */
  getRecommendedFeedingRate(
    averageWeightG: number,
    species: ShrimpSpecies | string = 'vannamei',
  ): number {
    switch (normalizeShrimpSpecies(species)) {
      case 'monodon': // Giant tiger prawn — grows larger, longer cycle.
        if (averageWeightG < 3) return 9;
        if (averageWeightG < 5) return 7;
        if (averageWeightG < 10) return 5;
        if (averageWeightG < 15) return 3.8;
        if (averageWeightG < 20) return 3;
        if (averageWeightG < 25) return 2.5;
        return 2;
      case 'scampi': // Macrobrachium rosenbergii — freshwater prawn.
        if (averageWeightG < 3) return 8;
        if (averageWeightG < 6) return 6;
        if (averageWeightG < 12) return 4;
        if (averageWeightG < 20) return 3;
        return 2.5;
      case 'indicus': // Indian white shrimp — penaeid, smaller final size.
      case 'vannamei':
      default:
        if (averageWeightG < 3) return 10;
        if (averageWeightG < 5) return 8;
        if (averageWeightG < 10) return 5;
        if (averageWeightG < 15) return 4;
        if (averageWeightG < 20) return 3;
        if (averageWeightG <= 25) return 2.5; // 20–25 g
        if (averageWeightG <= 30) return 2.0; // 25–30 g — large shrimp eat less
        return 1.8; // > 30 g (tapers near harvest; was a flat 2.5% floor)
    }
  }

  /**
   * Calculate Cultivation Performance
   * Estimates Biomass, Population, FCR, SR based on current feeding data
   */
  calculateCultivationPerformance(
    dailyFeed: number,
    fr: number,
    abw: number,
    cumulativeFeed: number,
    initialStocking: number,
  ): {
    biomass: number;
    population: number;
    fcr: number;
    sr: number;
  } {
    // Prevent division by zero
    if (fr === 0 || abw === 0) {
      return { biomass: 0, population: 0, fcr: 0, sr: 0 };
    }

    // Biomass back-estimate = Daily Feed / (FR / 100): if the farmer feeds
    // `dailyFeed` at the size-appropriate rate, standing biomass ≈ that ratio
    // (used mid-cycle when there's no fresh sampling).
    const biomass = dailyFeed / (fr / 100);

    // Population = (Biomass (kg) * 1000) / ABW (g)
    const population = (biomass * 1000) / abw;

    // Running FCR = cumulative feed / standing biomass (JALA §10 convention —
    // same definition as PondContextService.runningFcr; an in-cycle efficiency
    // proxy, NOT the final feed-per-gain FCR which needs harvested + dead weight).
    const fcr = biomass > 0 ? cumulativeFeed / biomass : 0;

    // SR = (Population / Initial Stocking) * 100
    const sr = initialStocking > 0 ? (population / initialStocking) * 100 : 0;

    return {
      biomass: Math.round(biomass * 100) / 100,
      population: Math.round(population),
      fcr: Math.round(fcr * 100) / 100,
      sr: Math.round(sr * 100) / 100,
    };
  }

  /**
   * Calculate Free (un-ionised) Ammonia NH3-N.
   *   NH3 = TAN × 1 / (1 + 10^(pKa − pH))
   *   pKa = 0.0901821 + 2729.92/T(K) + (0.1552 − 0.0003142·T_°C)·I   (Bower & Bidwell 1978)
   *   I (molal ionic strength) = 19.924·S / (1000 − 1.005·S),  S = salinity (ppt)
   * At S=0 the ionic-strength term vanishes → the freshwater Emerson form, so
   * existing freshwater callers are unaffected. Higher salinity raises pKa →
   * LESS un-ionised (toxic) ammonia, matching seawater chemistry.
   */
  calculateFreeAmmonia(
    tan: number,
    ph: number,
    temperature: number,
    salinity = 0,
  ): {
    unionizedAmmonia: number;
    toxicityLevel: string;
  } {
    const tempK = temperature + 273.15;
    const s = Math.max(0, salinity || 0);
    const ionicStrength = s > 0 ? (19.924 * s) / (1000 - 1.005 * s) : 0;
    const pKa =
      0.0901821 +
      2729.92 / tempK +
      (0.1552 - 0.0003142 * temperature) * ionicStrength;
    const nh3 = tan * (1 / (1 + Math.pow(10, pKa - ph)));

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
  }

  /**
   * Calculate Product Dosage Amount
   * Amount (kg) = (Pond Area (m2) * Water Level (m) * Dosage (ppm)) / 1000
   */
  calculateProductDosage(
    pondArea: number,
    waterLevel: number,
    dosage: number,
  ): {
    amountKg: number;
  } {
    const amountKg = (pondArea * waterLevel * dosage) / 1000;
    return {
      amountKg: Math.round(amountKg * 100) / 100,
    };
  }
}
