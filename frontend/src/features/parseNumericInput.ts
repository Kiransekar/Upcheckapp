/**
 * Strict numeric field parse.
 *
 * `parseFloat` is a PREFIX parser — '20abc' yields 20 and 'Infinity' yields
 * Infinity — so a field declared numeric silently accepted values that are not
 * numbers and computed a confident answer from the truncation (QA BUG-017).
 * `Number()` rejects trailing garbage outright; `Number.isFinite` closes
 * Infinity and NaN. Returns null for "no usable value", so callers test
 * `=== null` rather than falsiness, which 0 would otherwise trip.
 *
 * `keyboardType="decimal-pad"` is a soft-keyboard hint, not an input filter:
 * paste, voice input and physical keyboards all reach these fields.
 */
export const parseNumericInput = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
};
