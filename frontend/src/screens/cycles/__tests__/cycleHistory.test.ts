import { computeDoc, Crop } from '../../../api/crops';
import type { Harvest } from '../../../api/harvests';
import { summariseCycles } from '../cycleHistory';

const crop = (over: Partial<Crop>): Crop => ({
    id: 'c1',
    pondId: 'p1',
    name: 'Cycle 1',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...over,
});

const harvest = (over: Partial<Harvest>): Harvest => ({
    id: 'h1',
    cropId: 'c1',
    harvestDate: '2026-03-01',
    weightKg: 100,
    harvestType: 'partial',
    status: 'sold',
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    ...over,
});

describe('computeDoc', () => {
    it('counts the stocking day as day 1', () => {
        const today = new Date();
        const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        expect(computeDoc({ stockingDate: iso })).toBe(1);
    });

    it('freezes at the actual harvest date', () => {
        expect(computeDoc({
            stockingDate: '2026-01-01',
            actualHarvestDate: '2026-01-11T09:30:00.000Z',
        })).toBe(11);
    });

    it('adds the seed age at stocking', () => {
        expect(computeDoc({
            stockingDate: '2026-01-01',
            actualHarvestDate: '2026-01-01',
            initialAgeDays: 10,
        })).toBe(11);
    });

    it('is 0 without a stocking date and for a future one', () => {
        expect(computeDoc({})).toBe(0);
        expect(computeDoc({ stockingDate: '2099-01-01' })).toBe(0);
    });
});

describe('summariseCycles', () => {
    it('pins the active cycle on top, then orders newest stocking first', () => {
        const rows = summariseCycles(
            [
                { crop: crop({ id: 'old', status: 'completed', stockingDate: '2025-01-01' }) },
                { crop: crop({ id: 'recent', status: 'completed', stockingDate: '2026-01-01' }) },
                { crop: crop({ id: 'live', status: 'active', stockingDate: '2024-01-01' }) },
            ],
            [],
        );
        expect(rows.map((r) => r.crop.id)).toEqual(['live', 'recent', 'old']);
    });

    it('totals harvest weight per cycle from a pond-wide harvest list', () => {
        const rows = summariseCycles(
            [{ crop: crop({ id: 'a' }) }, { crop: crop({ id: 'b', status: 'completed' }) }],
            [
                harvest({ id: 'h1', cropId: 'a', weightKg: 120 }),
                harvest({ id: 'h2', cropId: 'a', weightKg: 80.5 }),
                harvest({ id: 'h3', cropId: 'b', weightKg: 300 }),
            ],
        );
        expect(rows.find((r) => r.crop.id === 'a')!.harvestKg).toBe(200.5);
        expect(rows.find((r) => r.crop.id === 'b')!.harvestKg).toBe(300);
    });

    it('reports no harvest as null, never 0', () => {
        const rows = summariseCycles([{ crop: crop({}) }], []);
        expect(rows[0].harvestKg).toBeNull();
        expect(rows[0].revenue).toBeNull();
    });

    it('leaves revenue null when the API masked every sale price', () => {
        // What a member without VIEW_FINANCIALS receives: rows present, money
        // nulled. Summing to 0 would render "₹0" — a sale that never happened.
        const rows = summariseCycles(
            [{ crop: crop({}) }],
            [harvest({ salePriceTotal: null }), harvest({ id: 'h2', salePriceTotal: null })],
        );
        expect(rows[0].harvestKg).toBe(200);
        expect(rows[0].revenue).toBeNull();
    });

    it('sums the sale prices that are visible', () => {
        const rows = summariseCycles(
            [{ crop: crop({}) }],
            [harvest({ salePriceTotal: 50_000 }), harvest({ id: 'h2', salePriceTotal: 25_000 })],
        );
        expect(rows[0].revenue).toBe(75_000);
    });
});
