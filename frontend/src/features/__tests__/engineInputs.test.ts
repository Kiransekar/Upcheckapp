/**
 * E1 / E-D1 — an engine must refuse rather than invent.
 *
 * Every computational engine screen was pre-seeded with fabricated numbers
 * (Feed Advisor: 120,000 shrimp at 25 g; Harvest Timing: 80,000 shrimp and
 * feed at ₹60/kg) and every one swallowed its pond-context failure with
 * `.catch(() => {})`. The seeds survived the failure, so offline or on a cold
 * start the farmer tapped Calculate and got a confident, precisely formatted
 * recommendation computed ENTIRELY FROM NUMBERS NOBODY ENTERED.
 *
 * This is the gate that replaces that. It is deliberately strict about what
 * counts as supplied, because a zero denominator produces a confident answer
 * rather than an honest refusal.
 */
import { isSupplied, missingInputs, canCompute } from '../engineInputs';

describe('isSupplied', () => {
    it.each(['120000', '25', '0.4', ' 7.8 '])('accepts a real value: %s', (v) => {
        expect(isSupplied(v)).toBe(true);
    });

    it.each(['', '   '])('rejects an empty field: %s', (v) => {
        expect(isSupplied(v)).toBe(false);
    });

    it('rejects text that is not a number', () => {
        expect(isSupplied('soon')).toBe(false);
    });

    /**
     * Zero is a DENOMINATOR here — population and average weight — so it is an
     * empty pond or a missing sampling, not a measurement. Dividing by it
     * yields a confident zero, which is the fabrication in another costume.
     *
     * Note this is the OPPOSITE of the water-quality rule, where zero IS a
     * reading (DO of 0 is the emergency worth logging). The difference is
     * deliberate and is about what the number is used for.
     */
    it('rejects zero and negatives, which are not measurements of a stocked pond', () => {
        expect(isSupplied('0')).toBe(false);
        expect(isSupplied('-5')).toBe(false);
    });
});

describe('missingInputs', () => {
    const inputs = (population: string, abw: string) => [
        { value: population, labelKey: 'engines.common.needsPopulation' },
        { value: abw, labelKey: 'engines.common.needsSampling' },
    ];

    it('names everything that is missing, in the order declared', () => {
        expect(missingInputs(inputs('', ''))).toEqual([
            'engines.common.needsPopulation',
            'engines.common.needsSampling',
        ]);
    });

    it('names only what is actually missing', () => {
        expect(missingInputs(inputs('120000', ''))).toEqual([
            'engines.common.needsSampling',
        ]);
    });

    it('names nothing once both are supplied', () => {
        expect(missingInputs(inputs('120000', '25'))).toEqual([]);
    });

    /**
     * The label keys are ACTIONS, not field names — "a recent sampling", never
     * "abwG is null". A refusal is only useful if the farmer knows what to go
     * and do about it.
     */
    it('reports label keys rather than field names', () => {
        for (const key of missingInputs(inputs('', ''))) {
            expect(key).toMatch(/^engines\.common\.needs/);
        }
    });
});

describe('canCompute', () => {
    it('refuses until every required input exists', () => {
        expect(canCompute([{ value: '', labelKey: 'k' }])).toBe(false);
        expect(canCompute([{ value: '1', labelKey: 'k' }])).toBe(true);
    });

    it('is true for an engine that requires nothing', () => {
        expect(canCompute([])).toBe(true);
    });
});
