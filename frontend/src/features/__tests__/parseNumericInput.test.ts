import { parseNumericInput, MAX_STOCKING_COUNT } from '../parseNumericInput';

/**
 * QA BUG-017. parseFloat is a PREFIX parser: parseFloat('20abc') is 20, so a
 * field declared numeric silently accepted and truncated a value that is not a
 * number, and the screen rendered a confident answer identical to a clean 20.
 * parseFloat('1e3') is 1000, a silent 1000x reading; parseFloat('Infinity') is
 * Infinity, which passes `!v || v <= 0` and reaches the arithmetic.
 */
describe('parseNumericInput', () => {
    it('rejects trailing garbage rather than truncating to a prefix', () => {
        expect(parseNumericInput('20abc')).toBeNull();
    });

    it('rejects a value with no numeric content', () => {
        expect(parseNumericInput('abc!@#')).toBeNull();
    });

    it('rejects Infinity and NaN, which pass a naive falsy/sign guard', () => {
        expect(parseNumericInput('Infinity')).toBeNull();
        expect(parseNumericInput('-Infinity')).toBeNull();
        expect(parseNumericInput('NaN')).toBeNull();
    });

    it('treats an empty or whitespace-only field as absent', () => {
        expect(parseNumericInput('')).toBeNull();
        expect(parseNumericInput('   ')).toBeNull();
    });

    // TC-30 pins whitespace tolerance; Number(' 20 ') is 20, so it survives.
    it('keeps the whitespace tolerance the suite already relies on', () => {
        expect(parseNumericInput(' 20 ')).toBe(20);
    });

    it('accepts ordinary decimals, zero and negatives', () => {
        expect(parseNumericInput('18.4')).toBe(18.4);
        expect(parseNumericInput('0')).toBe(0);
        expect(parseNumericInput('-5')).toBe(-5);
    });
});

/**
 * QA BUG-011. A pond holding more than 100 million post-larvae does not
 * exist; the count/seed guards on the stocking screens reject anything past
 * this ceiling instead of rendering an astronomic "answer".
 */
describe('MAX_STOCKING_COUNT', () => {
    it('is 100 million post-larvae', () => {
        expect(MAX_STOCKING_COUNT).toBe(100_000_000);
    });

    it('a count guard (count > MAX_STOCKING_COUNT) accepts the ceiling itself and rejects one past it', () => {
        expect(parseNumericInput('100000000')! > MAX_STOCKING_COUNT).toBe(false);
        expect(parseNumericInput('100000001')! > MAX_STOCKING_COUNT).toBe(true);
    });
});
