import apiClient from './client';

export interface PondContext {
  pondId: string;
  cropId: string | null;
  /** Cultured species (free text, e.g. "Penaeus monodon") — tunes the engines. */
  species: string | null;
  areaM2: number | null;
  /** Total installed aerator power (HP) — auto-fills the Aeration optimizer. */
  installedAeratorHp: number | null;
  doc: number | null;
  waterQuality: {
    dissolvedOxygen: number | null;
    ph: number | null;
    temperature: number | null;
    salinity: number | null;
    ammonia: number | null;
    nitrite: number | null;
    nitrate: number | null;
    alkalinity: number | null;
    /** When the daily probe params were last logged. */
    recordedAt: string | null;
    /** When ammonia (chemistry) was last measured — may be older. */
    chemistryAsOf: string | null;
  } | null;
  freeAmmoniaMgL: number | null;
  abwG: number | null;
  livePopulation: number | null;
  biomassKg: number | null;
  crop: {
    stockingCount: number | null;
    carryingCapacityKgM2: number | null;
    feedPriceRpPerKg: number | null;
    targetSrPercent: number | null;
    targetSize: number | null;
    targetCultivationDays: number | null;
  } | null;
  cumulativeFeedKg: number | null;
  runningFcr: number | null;
  latestTrayResidue: 'empty' | 'few_left' | 'a_lot_left' | null;
  lastFeedAt: string | null;
  lastTrayAt: string | null;
  samplingAt: string | null;
  confidence: DataConfidence;
}

export interface DataConfidence {
  score: number; // 0..100
  band: 'high' | 'medium' | 'low';
  missing: string[];
  stale: string[];
}

export const pondContextApi = {
  /** Latest-input snapshot for a pond (engines prefill from this). */
  get: (pondId: string) => apiClient.get<PondContext>(`/pond-context/${pondId}`),

  /**
   * Every readable pond on a farm, in one request.
   *
   * The Farms and Ponds screens need day / DO / biomass for the whole farm at
   * once; asking pond by pond was 9-24 round trips on the app's two busiest
   * screens. The server applies the same per-pond READ check either way.
   */
  forFarm: (farmId: string) =>
    apiClient.get<PondContext[]>('/pond-context', { params: { farmId } }),
};
