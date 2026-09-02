import type { PondContext } from '../../../api/pondContext';
import { survivalPctFrom, didPrefillAnything } from '../prefill';

const ctx = (over: Partial<PondContext>): PondContext =>
    ({
        pondId: 'p1', cropId: 'c1', species: null, areaM2: 5000,
        installedAeratorHp: null, doc: 1, waterQuality: null,
        freeAmmoniaMgL: null, abwG: null, livePopulation: 500000,
        biomassKg: null,
        crop: {
            stockingCount: 500000, carryingCapacityKgM2: null,
            feedPriceRpPerKg: null, targetSrPercent: null,
            targetSize: null, targetCultivationDays: null,
        },
        cumulativeFeedKg: null, runningFcr: null, latestTrayResidue: null,
        lastFeedAt: null, lastTrayAt: null, samplingAt: null,
        confidence: { score: 0, band: 'low', missing: [], stale: [] },
        ...over,
    }) as PondContext;

/**
 * QA BUG-019. livePopulation equals stockingCount whenever no mortality has
 * been logged, so survival came out as exactly 100% on every un-sampled pond -
 * arithmetically true, factually unknown. Biomass is count x SR/100 x MBW/1000,
 * so carrying a real 80% as 100% over-estimates biomass, and therefore the
 * daily feed, by 25%. Over-feeding decays to ammonia.
 */
describe('survivalPctFrom', () => {
    it('is unknown when no sampling exists, even though the arithmetic works', () => {
        expect(survivalPctFrom(ctx({ abwG: null }))).toBeNull();
    });

    it('is reported once a sampling backs it', () => {
        expect(survivalPctFrom(ctx({ abwG: 18.4, livePopulation: 400000 }))).toBe(80);
    });

    it('is unknown when the pond was never stocked', () => {
        expect(survivalPctFrom(ctx({ abwG: 18.4, crop: null }))).toBeNull();
    });
});

/**
 * QA BUG-018. The banner said "Filled from the pond you picked" as soon as any
 * context arrived - before the conditional set* calls had decided whether they
 * had anything to write. On a pond with no sampling it filled neither MBW (the
 * required field) nor a real SR, and a farmer told the form is filled reads the
 * remaining blank as optional.
 */
describe('didPrefillAnything', () => {
    it('is false when the pond has no sampling, so MBW was not filled', () => {
        expect(didPrefillAnything(ctx({ abwG: null }))).toBe(false);
    });

    it('is true once the pond can fill the required MBW field', () => {
        expect(didPrefillAnything(ctx({ abwG: 18.4 }))).toBe(true);
    });
});
