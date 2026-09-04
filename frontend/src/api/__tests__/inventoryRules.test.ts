/**
 * The four bits of inventory arithmetic that were wrong in shipped code.
 * Markup is not tested here; these rules are.
 */
import { isLowStock, stockFraction, unitStep, itemIcon, CATEGORY_ICON } from '../inventory';
import { INVENTORY_CATEGORIES } from '../inventory';

describe('isLowStock — D1, one definition shared with the backend', () => {
    it('is low at or below the threshold', () => {
        expect(isLowStock({ quantity: 5, reorderLevel: 10 })).toBe(true);
        expect(isLowStock({ quantity: 10, reorderLevel: 10 })).toBe(true);
    });

    it('is not low above the threshold', () => {
        expect(isLowStock({ quantity: 11, reorderLevel: 10 })).toBe(false);
    });

    it('treats no threshold as "low only at zero" — the frontend used to flag every new item', () => {
        expect(isLowStock({ quantity: 1 })).toBe(false);
        expect(isLowStock({ quantity: 1, reorderLevel: null })).toBe(false);
        expect(isLowStock({ quantity: 0 })).toBe(true);
    });

    it('copes with the strings a pg `numeric` column actually returns', () => {
        expect(isLowStock({ quantity: '5.00', reorderLevel: '10.00' })).toBe(true);
        expect(isLowStock({ quantity: '20.00', reorderLevel: '10.00' })).toBe(false);
    });
});

describe('stockFraction — D6, the bar that divided by zero', () => {
    it('never returns NaN or Infinity, whatever the threshold', () => {
        for (const reorder of [undefined, null, 0, -1, 10]) {
            for (const qty of [0, 5, 1000]) {
                const f = stockFraction(qty, reorder as any);
                expect(Number.isFinite(f)).toBe(true);
                expect(f).toBeGreaterThanOrEqual(0);
                expect(f).toBeLessThanOrEqual(1);
            }
        }
    });

    it('reads half full at the threshold and full at twice it', () => {
        expect(stockFraction(10, 10)).toBeCloseTo(0.5);
        expect(stockFraction(20, 10)).toBe(1);
        expect(stockFraction(40, 10)).toBe(1);
    });

    it('is empty at zero and full when there is stock but no scale to draw against', () => {
        expect(stockFraction(0, 10)).toBe(0);
        expect(stockFraction(7)).toBe(1);
        expect(stockFraction('nonsense' as any, 10)).toBe(0);
    });
});

describe('unitStep', () => {
    it('steps whole things by one', () => {
        for (const u of ['pcs', 'bag', 'bottle', 'box']) expect(unitStep(u)).toBe(1);
    });
    it('steps kg and L by a half', () => {
        expect(unitStep('kg')).toBe(0.5);
        expect(unitStep('L')).toBe(0.5);
    });
    it('steps g and mL by ten', () => {
        expect(unitStep('g')).toBe(10);
        expect(unitStep('mL')).toBe(10);
    });
    it('falls back to one with no unit chosen', () => {
        expect(unitStep(undefined)).toBe(1);
        expect(unitStep(null)).toBe(1);
    });
});

describe('itemIcon — D5, one map, not two that disagree', () => {
    it('gives every category an icon', () => {
        for (const c of INVENTORY_CATEGORIES) {
            expect(CATEGORY_ICON[c]).toBeTruthy();
            expect(itemIcon({ category: c })).toBe(CATEGORY_ICON[c]);
        }
    });
    it('prefers the item\'s own picked glyph', () => {
        expect(itemIcon({ category: 'feed', icon: 'sack' })).toBe('sack');
    });
    it('falls back to a box for a category it has never heard of', () => {
        expect(itemIcon({ category: 'sorcery' })).toBe('package-variant');
    });
});
