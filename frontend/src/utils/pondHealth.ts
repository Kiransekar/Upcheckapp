import { theme } from '../theme';
import type { AlertSeverity, BriefingItem } from '../api/alertCenter';
import type { Pond } from '../api/ponds';
import type { PondContext } from '../api/pondContext';

/**
 * One pond's state as the redesign shows it: the strip of coloured bars on a
 * farm card, the left border on a pond row, the "2 act now" counts.
 *
 * Four states, not five, and deliberately so — the drawings legend them as
 * "Act now / Watch / Fine / Fallow". A pond either needs you today, needs
 * watching, is fine, or has nothing in it.
 *
 * Severity comes from the alert engine's briefing rather than being re-derived
 * from raw DO and ammonia here. The engine already knows this farm's species,
 * stocking density and thresholds; a second set of hard-coded limits in the UI
 * would eventually disagree with it, and the farmer would see one screen say
 * "act now" while another says everything is fine.
 */
export type PondHealth = 'critical' | 'watch' | 'fine' | 'fallow';

/** Worst first. Drives both the pond strip and the "worst pond first" list. */
export const HEALTH_RANK: Record<PondHealth, number> = {
    critical: 0,
    watch: 1,
    fine: 2,
    fallow: 3,
};

export const HEALTH_COLOR: Record<PondHealth, string> = {
    critical: theme.roles.light.dangerBorder,
    watch: theme.roles.light.warningBorder,
    fine: theme.roles.light.successBorder,
    // A fallow pond is not a problem, so it takes the neutral border rather
    // than any status colour — it reads as "empty", not "unknown".
    fallow: theme.roles.light.borderDefault,
};

/** Severity → the text colour the design uses for that pond's one-line reason. */
export const HEALTH_TEXT: Record<PondHealth, string> = {
    critical: theme.roles.light.dangerText,
    watch: theme.roles.light.warningText,
    fine: theme.roles.light.textTertiary,
    fallow: theme.roles.light.textTertiary,
};

/** An empty pond is empty whatever the alerts say. */
const isFallow = (pond: Pick<Pond, 'status' | 'activeCycleId'>): boolean =>
    pond.status === 'fallow' || !pond.activeCycleId;

export const healthOf = (
    pond: Pick<Pond, 'status' | 'activeCycleId'>,
    severity?: AlertSeverity | null,
): PondHealth => {
    if (isFallow(pond)) return 'fallow';
    if (severity === 'critical') return 'critical';
    if (severity === 'watch') return 'watch';
    return 'fine';
};

/** Worst severity per pond, from a briefing that spans every farm. */
export const severityByPond = (items: BriefingItem[]): Map<string, AlertSeverity> => {
    const rank: Record<AlertSeverity, number> = { critical: 3, watch: 2, info: 1 };
    const out = new Map<string, AlertSeverity>();
    for (const item of items) {
        if (!item.pondId) continue;
        const current = out.get(item.pondId);
        if (!current || rank[item.topSeverity] > rank[current]) {
            out.set(item.pondId, item.topSeverity);
        }
    }
    return out;
};

export interface PondWithHealth {
    pond: Pond;
    health: PondHealth;
    /** The engine's one-line reason, when there is one. */
    reason: string | null;
    context: PondContext | null;
}

/** Worst first; ties broken by name so the order is stable between loads. */
export const sortByHealth = (rows: PondWithHealth[]): PondWithHealth[] =>
    [...rows].sort(
        (a, b) =>
            HEALTH_RANK[a.health] - HEALTH_RANK[b.health] ||
            pondLabel(a.pond).localeCompare(pondLabel(b.pond)),
    );

export const pondLabel = (p: Pick<Pond, 'displayName' | 'name'>): string =>
    p.displayName || p.name;

export interface FarmRollup {
    /** Ponds with a cycle running, over ponds that exist. */
    stocked: number;
    total: number;
    /** Summed standing biomass, or null when no pond has an estimate yet. */
    biomassKg: number | null;
    actNow: number;
    watch: number;
    /** One entry per pond, worst first — the strip on a farm card. */
    strip: PondHealth[];
}

/**
 * Roll a farm's ponds up to the three figures its card shows.
 *
 * Biomass is null rather than 0 when nothing is known: an owner who has not
 * sampled yet should see "—", not a confident zero next to a stocked pond.
 */
export const rollUpFarm = (rows: PondWithHealth[]): FarmRollup => {
    const sorted = sortByHealth(rows);
    const biomassValues = rows
        .map((r) => r.context?.biomassKg)
        .filter((v): v is number => typeof v === 'number');

    return {
        stocked: rows.filter((r) => r.health !== 'fallow').length,
        total: rows.length,
        biomassKg: biomassValues.length
            ? Math.round(biomassValues.reduce((a, b) => a + b, 0))
            : null,
        actNow: rows.filter((r) => r.health === 'critical').length,
        watch: rows.filter((r) => r.health === 'watch').length,
        strip: sorted.map((r) => r.health),
    };
};

/** Join ponds, their contexts and the briefing into the shape the screens render. */
export const buildPondRows = (
    ponds: Pond[],
    contexts: PondContext[],
    briefing: BriefingItem[],
): PondWithHealth[] => {
    const severity = severityByPond(briefing);
    const reason = new Map(
        briefing.filter((b) => b.pondId).map((b) => [b.pondId as string, b.topTitle]),
    );
    const ctxById = new Map(contexts.map((c) => [c.pondId, c]));

    return ponds.map((pond) => {
        const health = healthOf(pond, severity.get(pond.id));
        return {
            pond,
            health,
            // A pond that is fine has nothing to explain; showing the last
            // resolved alert there would read as a live problem.
            reason: health === 'critical' || health === 'watch' ? reason.get(pond.id) ?? null : null,
            context: ctxById.get(pond.id) ?? null,
        };
    });
};
