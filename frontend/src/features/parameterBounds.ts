/**
 * The PHYSICAL bounds the server enforces, mirrored so the client can warn
 * before a reading is queued (L4).
 *
 * These are not agronomic bands — `waterQualityThresholds.ts` owns those, and
 * a value outside them is unusual but real. These are the limits of the
 * quantity itself: pH runs 0–14, dissolved oxygen does not reach 30 mg/L. A
 * value outside them is a typo, and the server WILL refuse it.
 *
 * Why the client needs to know: online, a rejection is a harmless round trip.
 * Offline it is not. A 6 a.m. fat-finger under screen glare is queued, toasted
 * as "Saved", and only discovered that evening when it parks in
 * `failedOperations` — recoverable and visible, but hours late, and the actual
 * reading is long gone.
 *
 * WARN, NEVER BLOCK (D3). Even here. The rule exists because a real crisis
 * reading — DO at 1.2, an ammonia spike — is precisely the extreme value most
 * worth recording, and a form that argues with the farmer during an emergency
 * is a form they abandon for the notebook. A typo warned about is fixed in two
 * seconds; a blocked save loses the whole record.
 *
 * Kept in step with `backend/src/water-quality/dto/create-water-quality-record.dto.ts`.
 */
export interface ParameterBound {
    min: number;
    max: number;
}

/**
 * Keyed by `ThresholdParam`, which is what the inputs already carry — note
 * `do`, not `dissolvedOxygen`. The DTO name is the server's; this is the UI's,
 * and mapping here rather than at each call site keeps the mismatch in one
 * place instead of ten.
 */
export const PARAMETER_BOUNDS: Record<string, ParameterBound> = {
    do: { min: 0, max: 30 },
    ph: { min: 0, max: 14 },
    temperature: { min: 0, max: 50 },
    salinity: { min: 0, max: 60 },
    ammonia: { min: 0, max: 100 },
    nitrite: { min: 0, max: 100 },
    nitrate: { min: 0, max: 500 },
    alkalinity: { min: 0, max: 1000 },
    hardness: { min: 0, max: 5000 },
    transparency: { min: 0, max: 300 },
};

/**
 * Is this value one the server would refuse outright?
 *
 * A blank or half-typed field is NOT out of bounds — the farmer is mid-entry,
 * and shouting at someone who has typed "1" of "12" is how a form earns being
 * ignored.
 */
export const isOutOfBounds = (parameterKey: string | undefined, raw: string): boolean => {
    if (!parameterKey) return false;
    const bound = PARAMETER_BOUNDS[parameterKey];
    if (!bound) return false;
    const trimmed = raw.trim();
    if (!trimmed) return false;
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return false;
    return n < bound.min || n > bound.max;
};
