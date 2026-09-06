/**
 * What an engine needs before it may answer (E1 / E-D1).
 *
 * ── The defect this exists to close ───────────────────────────────────────
 * Every computational engine screen was pre-seeded with invented numbers —
 * Feed Advisor with 120,000 shrimp at 25 g, Harvest Timing with a population
 * of 80,000 and feed at ₹60/kg — and every one swallowed its pond-context
 * failure with `.catch(() => {})`. The seeds survived the failure, because the
 * fill helper only overwrote a field when the real value was non-null.
 *
 * So offline, or on a cold start, or on any error at all, the farmer tapped
 * Calculate and got a confident, precisely formatted recommendation computed
 * ENTIRELY FROM NUMBERS NOBODY ENTERED. No error, no warning, no way to tell.
 * Harvest Timing was the worst of them: it advises when to harvest — the
 * season's biggest financial decision — from a feed price and a population
 * that were never supplied.
 *
 * This is the same lie `Pond.assumedFields` was built to stop: "rendering a
 * default with the same confidence as a measurement is a lie the farmer plans
 * a season on". That principle simply never reached the engines.
 *
 * ── The rule ──────────────────────────────────────────────────────────────
 * Refuse, and name what is missing IN THE FARMER'S TERMS. "Needs a recent
 * sampling", not "abwG is null". An engine that refuses can be trusted; an
 * engine that guesses cannot.
 */

/** One input an engine cannot proceed without. */
export interface RequiredInput {
    /** The raw text-field value, exactly as the screen holds it. */
    value: string;
    /**
     * What the farmer should go and do about it, as an i18n key — phrased as
     * the action, not the field name.
     */
    labelKey: string;
}

/**
 * A value counts as present when it parses to a real, positive number.
 *
 * Deliberately stricter than "non-empty": `0` shrimp and `0` g ABW are not
 * measurements, they are an empty pond or a missing sampling, and dividing by
 * them produces a confident zero rather than an honest refusal. (Contrast the
 * water-quality rule, where a zero IS a reading — DO of 0 is the emergency.
 * The difference is that these are DENOMINATORS.)
 */
export const isSupplied = (raw: string): boolean => {
    const n = Number(raw.trim());
    return raw.trim() !== '' && Number.isFinite(n) && n > 0;
};

/** The label keys of everything still missing. Empty means ready to compute. */
export const missingInputs = (inputs: RequiredInput[]): string[] =>
    inputs.filter((i) => !isSupplied(i.value)).map((i) => i.labelKey);

/** Can this engine answer yet? */
export const canCompute = (inputs: RequiredInput[]): boolean =>
    missingInputs(inputs).length === 0;
