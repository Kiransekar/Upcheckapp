import type { Crop } from '../../api/crops';
import { computeDoc } from '../../api/crops';
import type { Harvest } from '../../api/harvests';

export interface CycleRow {
    crop: Crop;
    /** Only set in farm scope, where rows span several ponds. */
    pondName?: string;
    doc: number;
    /** Total harvested biomass; `null` when nothing has been harvested yet. */
    harvestKg: number | null;
    /**
     * Sale revenue, or `null` when there is nothing to show — no harvest, or a
     * caller without VIEW_FINANCIALS, for whom the API masks `salePriceTotal`
     * to null. Null must render as "—": ₹0 would read as "sold for nothing".
     */
    revenue: number | null;
}

const startedAt = (c: Crop) => new Date(c.stockingDate ?? c.createdAt).getTime();

/**
 * One row per cycle, active pinned on top, then newest stocking first.
 * `harvests` is the pond's whole run across cycles — grouped here by cropId.
 */
export const summariseCycles = (
    entries: { crop: Crop; pondName?: string }[],
    harvests: Harvest[],
): CycleRow[] => {
    const byCrop = new Map<string, Harvest[]>();
    for (const h of harvests) {
        const list = byCrop.get(h.cropId);
        if (list) list.push(h);
        else byCrop.set(h.cropId, [h]);
    }

    return entries
        .map(({ crop, pondName }) => {
            const own = byCrop.get(crop.id) ?? [];
            const priced = own.filter((h) => h.salePriceTotal != null);
            return {
                crop,
                pondName,
                doc: computeDoc(crop),
                harvestKg: own.length
                    ? own.reduce((s, h) => s + (h.weightKg || 0), 0)
                    : crop.harvestWeightKg ?? null,
                revenue: priced.length
                    ? priced.reduce((s, h) => s + (h.salePriceTotal || 0), 0)
                    : null,
            };
        })
        .sort((a, b) => {
            const active = Number(b.crop.status === 'active') - Number(a.crop.status === 'active');
            return active !== 0 ? active : startedAt(b.crop) - startedAt(a.crop);
        });
};
