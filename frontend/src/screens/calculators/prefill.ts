import type { PondContext } from '../../api/pondContext';

/**
 * Survival from a pond context, or null when nobody has measured it.
 *
 * `livePopulation` is stocked-minus-logged-mortality, so with no mortality it
 * equals `stockingCount` and the ratio is exactly 100% — arithmetically correct
 * and semantically meaningless (QA BUG-019). `abwG` is the honest proxy for "a
 * sampling exists": it is what the pond dashboard already gates MBW, biomass
 * and FCR on, which is why those three correctly render "—" and survival did
 * not.
 */
export const survivalPctFrom = (ctx: PondContext | null): number | null => {
    if (!ctx || ctx.abwG == null) return null;
    const stocked = ctx.crop?.stockingCount;
    const live = ctx.livePopulation;
    if (!stocked || live == null) return null;
    return Math.round((live / stocked) * 100);
};

/**
 * Whether the pond can actually fill the form's REQUIRED field.
 *
 * The banner claims "filled from the pond", so it must be driven by what was
 * written, not by a payload having arrived (QA BUG-018). MBW is the required
 * field and the largest term in the biomass calculation; without a sampling the
 * pond fills neither it nor a real survival figure.
 */
export const didPrefillAnything = (ctx: PondContext | null): boolean =>
    !!ctx && ctx.abwG != null;
