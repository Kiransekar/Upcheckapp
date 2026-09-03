/**
 * Per-species five-zone water-quality thresholds (spec Requirement 10).
 *
 * Upgrades the single optimal/out-of-range band in `constants/ranges.ts` to a
 * five-zone model — critical-low, caution-low, optimal, caution-high,
 * critical-high — with distinct boundaries per cultured species. One-sided
 * parameters (e.g. dissolved oxygen has no upper concern; ammonia no lower) leave
 * the irrelevant boundaries null and the evaluator omits those zones.
 *
 * Values are seeded from public aquaculture literature so the client works
 * offline; the backend Parameter_Threshold table is authoritative and may
 * override these without a client release. Pure + unit-tested.
 *
 * Provisional notes:
 *  - indicus and scampi (Macrobrachium) bands are provisional and must be
 *    verified with ICAR-CIBA / RGCA before production (spec A-5).
 *  - free-ammonia caution/critical bands are kept aligned with the current app
 *    (0.1 / 0.5 mg/L); any recalibration must be agronomist-confirmed (spec A-4).
 */

export type ThresholdSpecies = 'vannamei' | 'monodon' | 'indicus' | 'scampi'

export type ThresholdParam =
  | 'do'
  | 'ph'
  | 'temperature'
  | 'salinity'
  | 'alkalinity'
  | 'ammonia'
  | 'nitrite'
  | 'nitrate'
  | 'transparency'

export type Zone =
  | 'critical-low'
  | 'caution-low'
  | 'optimal'
  | 'caution-high'
  | 'critical-high'

/** Traffic-light status used by the existing UI (mirrors constants/ranges). */
export type ParameterStatus = 'safe' | 'warning' | 'critical' | 'none'

export interface FiveZoneThreshold {
  /** Below this → critical-low. Null for parameters with no lower danger. */
  criticalLow?: number | null
  /** Below this (but ≥ criticalLow) → caution-low. */
  cautionLow?: number | null
  /** Above this (but ≤ criticalHigh) → caution-high. */
  cautionHigh?: number | null
  /** Above this → critical-high. Null for parameters with no upper danger. */
  criticalHigh?: number | null
}

// Penaeid baseline (vannamei). Other species override only what differs.
const VANNAMEI: Record<ThresholdParam, FiveZoneThreshold> = {
  do: { criticalLow: 3, cautionLow: 4, cautionHigh: null, criticalHigh: null },
  ph: { criticalLow: 7.0, cautionLow: 7.5, cautionHigh: 8.5, criticalHigh: 9.0 },
  temperature: { criticalLow: 24, cautionLow: 28, cautionHigh: 32, criticalHigh: 35 },
  salinity: { criticalLow: 5, cautionLow: 10, cautionHigh: 25, criticalHigh: 35 },
  alkalinity: { criticalLow: 50, cautionLow: 100, cautionHigh: 150, criticalHigh: 250 },
  ammonia: { criticalLow: null, cautionLow: null, cautionHigh: 0.1, criticalHigh: 0.5 },
  nitrite: { criticalLow: null, cautionLow: null, cautionHigh: 1.0, criticalHigh: 4.0 },
  nitrate: { criticalLow: null, cautionLow: null, cautionHigh: 60, criticalHigh: 200 },
  transparency: { criticalLow: 20, cautionLow: 30, cautionHigh: 45, criticalHigh: 60 },
}

function withOverrides(
  overrides: Partial<Record<ThresholdParam, FiveZoneThreshold>>,
): Record<ThresholdParam, FiveZoneThreshold> {
  return { ...VANNAMEI, ...overrides }
}

/** Seeded thresholds keyed by (species, parameter). */
export const THRESHOLDS: Record<
  ThresholdSpecies,
  Record<ThresholdParam, FiveZoneThreshold>
> = {
  vannamei: VANNAMEI,
  // Tiger shrimp: broader salinity tolerance, similar thermal range.
  monodon: withOverrides({
    salinity: { criticalLow: 5, cautionLow: 10, cautionHigh: 30, criticalHigh: 40 },
    temperature: { criticalLow: 24, cautionLow: 27, cautionHigh: 32, criticalHigh: 35 },
  }),
  // P. indicus (provisional, A-5): euryhaline indigenous penaeid.
  indicus: withOverrides({
    salinity: { criticalLow: 5, cautionLow: 12, cautionHigh: 30, criticalHigh: 40 },
  }),
  // Scampi / M. rosenbergii (provisional, A-5): freshwater prawn.
  scampi: withOverrides({
    salinity: { criticalLow: null, cautionLow: null, cautionHigh: 8, criticalHigh: 15 },
    temperature: { criticalLow: 22, cautionLow: 26, cautionHigh: 31, criticalHigh: 34 },
    ph: { criticalLow: 6.5, cautionLow: 7.0, cautionHigh: 8.5, criticalHigh: 9.0 },
  }),
}

/**
 * Coerce a free-text species string to a supported ThresholdSpecies, or `null`
 * when it matches nothing.
 *
 * It used to answer 'vannamei' for anything it did not recognise, so a typo
 * ('VannameiVannamei' is in production) silently evaluated a tiger-prawn pond
 * against vannamei bands and raised the wrong alerts with nothing to say why.
 * Null makes the caller choose its fallback out loud. Cycles created from now
 * on pick from CANONICAL_SPECIES (features/species.ts), so this only has to
 * cope with the free-text backlog.
 */
export function toThresholdSpecies(
  raw: string | null | undefined,
): ThresholdSpecies | null {
  const s = (raw ?? '').toLowerCase()
  if (s.includes('monodon') || s.includes('tiger') || s.includes('black')) return 'monodon'
  if (s.includes('indicus')) return 'indicus'
  if (s.includes('scampi') || s.includes('macrobrachium') || s.includes('rosenbergii')) {
    return 'scampi'
  }
  if (s.includes('vannamei')) return 'vannamei'
  return null
}

/** Get the threshold record for a (species, parameter), defaulting to vannamei. */
export function getThreshold(
  species: ThresholdSpecies,
  parameter: ThresholdParam,
): FiveZoneThreshold {
  return (THRESHOLDS[species] ?? VANNAMEI)[parameter]
}

/** Classify a measured value into one of the five zones. */
export function classifyZone(value: number, t: FiveZoneThreshold): Zone {
  if (t.criticalLow != null && value < t.criticalLow) return 'critical-low'
  if (t.cautionLow != null && value < t.cautionLow) return 'caution-low'
  if (t.criticalHigh != null && value > t.criticalHigh) return 'critical-high'
  if (t.cautionHigh != null && value > t.cautionHigh) return 'caution-high'
  return 'optimal'
}

/** Map a zone to the traffic-light status used by the UI. */
export function zoneStatus(zone: Zone): ParameterStatus {
  if (zone === 'optimal') return 'safe'
  if (zone === 'caution-low' || zone === 'caution-high') return 'warning'
  return 'critical'
}

export interface Evaluation {
  zone: Zone
  status: ParameterStatus
}

/** Evaluate a measured value for a species + parameter. */
export function evaluateParameter(
  species: ThresholdSpecies,
  parameter: ThresholdParam,
  value: number | null | undefined,
): Evaluation | { zone: null; status: 'none' } {
  if (value == null || Number.isNaN(value)) return { zone: null, status: 'none' }
  const zone = classifyZone(value, getThreshold(species, parameter))
  return { zone, status: zoneStatus(zone) }
}

/**
 * Nighttime dissolved-oxygen alarm. DO reaches its diel minimum just before dawn
 * (no photosynthesis, ongoing respiration), so a night reading already in the
 * caution-low band signals a likely pre-dawn crash and is escalated to critical.
 *
 * @param hour  Hour of the reading in 24h local time (0–23).
 */
export function nighttimeDoAlarm(params: {
  dissolvedOxygen: number
  hour: number
  species?: ThresholdSpecies
}): boolean {
  const { dissolvedOxygen, hour, species = 'vannamei' } = params
  const isNight = hour >= 22 || hour < 6
  const t = getThreshold(species, 'do')
  return isNight && t.cautionLow != null && dissolvedOxygen < t.cautionLow
}

export default {
  THRESHOLDS,
  toThresholdSpecies,
  getThreshold,
  classifyZone,
  zoneStatus,
  evaluateParameter,
  nighttimeDoAlarm,
}
