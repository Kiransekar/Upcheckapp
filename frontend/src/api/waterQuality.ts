import apiClient from './client';

export interface WaterQualityRecord {
    id: string;
    pondId: string;
    ph?: number;
    dissolvedOxygen?: number;
    temperature?: number;
    salinity?: number;
    ammonia?: number;
    nitrite?: number;
    nitrate?: number;
    alkalinity?: number;
    hardness?: number;
    transparency?: number;
    notes?: string;
    recordedAt?: string;
}

export interface CreateWaterQualityRecordDto {
    pondId: string;
    ph?: number;
    dissolvedOxygen?: number;
    temperature?: number;
    salinity?: number;
    ammonia?: number;
    nitrite?: number;
    nitrate?: number;
    alkalinity?: number;
    hardness?: number;
    transparency?: number;
    notes?: string;
}

export interface UpdateWaterQualityRecordDto {
    ph?: number;
    dissolvedOxygen?: number;
    temperature?: number;
    salinity?: number;
    ammonia?: number;
    nitrite?: number;
    nitrate?: number;
    alkalinity?: number;
    hardness?: number;
    transparency?: number;
    notes?: string;
}

/**
 * `GET /water-quality/latest?pondId=` — per-COLUMN latest, not the latest row.
 *
 * Each `<field>` is the newest non-null value of that column across the newest
 * 60 records and `<field>AsOf` is the ISO time of the record it came from (both
 * null when never measured). The 12-hour prefill rule is applied per field
 * against that field's own `<field>AsOf` — never against `recordedAt`, which is
 * only the newest record's time.
 */
export interface LatestPerColumn {
    pondId: string;
    recordedAt: string | null;
    ph: number | null; phAsOf: string | null;
    temperature: number | null; temperatureAsOf: string | null;
    dissolvedOxygen: number | null; dissolvedOxygenAsOf: string | null;
    salinity: number | null; salinityAsOf: string | null;
    ammonia: number | null; ammoniaAsOf: string | null;
    nitrite: number | null; nitriteAsOf: string | null;
    nitrate: number | null; nitrateAsOf: string | null;
    alkalinity: number | null; alkalinityAsOf: string | null;
    hardness: number | null; hardnessAsOf: string | null;
    transparency: number | null; transparencyAsOf: string | null;
}

/** A reading older than this is offered, not silently carried over (spec §4.6). */
export const PREFILL_MAX_AGE_HOURS = 12;

/**
 * Fields that drift slowly (pond chemistry/geometry-driven, not day-to-day), so
 * carrying them over saves re-typing the same number every visit. pH/DO/
 * temperature are deliberately absent: they are the reason the farmer opened
 * the screen and must be a fresh reading.
 */
export const SLOW_CHANGING_PREFILL_FIELDS = [
    'salinity',
    'alkalinity',
    'hardness',
    'transparency',
] as const;

export type SlowChangingField = (typeof SLOW_CHANGING_PREFILL_FIELDS)[number];

export interface PrefillCandidate {
    field: SlowChangingField;
    value: number;
    asOf: string;
    ageHours: number;
    /** < PREFILL_MAX_AGE_HOURS old → prefill silently; otherwise only offer it. */
    fresh: boolean;
}

/**
 * Decide, per field, what the last reading offers. Pure — the whole 12-hour
 * rule lives here so it can be tested without a screen.
 */
export function prefillCandidates(
    latest: Partial<LatestPerColumn> | null | undefined,
    now: number = Date.now(),
    fields: readonly SlowChangingField[] = SLOW_CHANGING_PREFILL_FIELDS,
): PrefillCandidate[] {
    if (!latest) return [];
    const out: PrefillCandidate[] = [];
    for (const field of fields) {
        const value = (latest as any)[field];
        const asOf = (latest as any)[`${field}AsOf`];
        if (value == null || typeof value !== 'number' || Number.isNaN(value)) continue;
        if (!asOf) continue;
        const at = new Date(asOf).getTime();
        if (Number.isNaN(at)) continue;
        // A future timestamp means a skewed device clock, not a stale reading.
        const ageHours = Math.max(0, (now - at) / 3_600_000);
        out.push({ field, value, asOf, ageHours, fresh: ageHours < PREFILL_MAX_AGE_HOURS });
    }
    return out;
}

export const waterQualityApi = {
    getAll: (pondId: string, params?: { page?: number; take?: number; chemistryOnly?: boolean }) =>
        apiClient.get<any>('/water-quality', {
            params: {
                pondId,
                page: params?.page,
                take: params?.take,
                // The backend compares against the literal string 'true'; anything
                // else (including absence) keeps the unfiltered behaviour.
                chemistryOnly: params?.chemistryOnly ? 'true' : undefined,
            },
        }),

    getLatest: (pondId: string) =>
        apiClient.get<WaterQualityRecord>(`/water-quality/pond/${pondId}/latest`),

    getLatestPerColumn: (pondId: string) =>
        apiClient.get<LatestPerColumn>('/water-quality/latest', { params: { pondId } }),

    create: (data: CreateWaterQualityRecordDto) =>
        apiClient.post<WaterQualityRecord>('/water-quality', data),

    update: (id: string, data: UpdateWaterQualityRecordDto) =>
        apiClient.patch<WaterQualityRecord>(`/water-quality/${id}`, data),

    remove: (id: string) =>
        apiClient.delete<void>(`/water-quality/${id}`),
};
