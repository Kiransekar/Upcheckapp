import { theme } from '../theme';
import type { AlertSeverity, BriefingItem } from '../api/alertCenter';
import type { Pond } from '../api/ponds';
import type { PondContext } from '../api/pondContext';
import { pondFreshness, type Freshness, type PondFreshness } from '../features/logProgress';

/**
 * One pond's state as the redesign shows it: the strip of coloured bars on a
 * farm card, the left border on a pond row, the "2 act now" counts.
 *
 * Five states: the drawings legend them as "Act now / Watch / Fine / Fallow",
 * plus `stale` — a pond either needs you today, needs watching, is fine, has
 * nothing in it, or nobody has logged it recently enough to trust "fine".
 *
 * Severity comes from the alert engine's briefing rather than being re-derived
 * from raw DO and ammonia here. The engine already knows this farm's species,
 * stocking density and thresholds; a second set of hard-coded limits in the UI
 * would eventually disagree with it, and the farmer would see one screen say
 * "act now" while another says everything is fine.
 */
export type PondHealth = 'critical' | 'watch' | 'stale' | 'fine' | 'fallow';

/** Worst first. Drives both the pond strip and the "worst pond first" list. */
export const HEALTH_RANK: Record<PondHealth, number> = {
    critical: 0,
    watch: 1,
    stale: 2,
    fine: 3,
    fallow: 4,
};

export const HEALTH_COLOR: Record<PondHealth, string> = {
    critical: theme.roles.light.dangerBorder,
    watch: theme.roles.light.warningBorder,
    // Slate, not amber. `stale` and `noData` share one colour because the bar
    // answers "can I trust this", and the answer is the same for both; the age
    // hint beside it is what distinguishes "8 d" from "never logged".
    stale: theme.roles.light.staleBorder,
    fine: theme.roles.light.successBorder,
    // A fallow pond is not a problem, so it takes the neutral border rather
    // than any status colour — it reads as "empty", not "unknown".
    fallow: theme.roles.light.borderDefault,
};

/** Severity → the text colour the design uses for that pond's one-line reason. */
export const HEALTH_TEXT: Record<PondHealth, string> = {
    critical: theme.roles.light.dangerText,
    watch: theme.roles.light.warningText,
    stale: theme.roles.light.staleText,
    fine: theme.roles.light.textTertiary,
    fallow: theme.roles.light.textTertiary,
};

/**
 * An empty pond is empty whatever the alerts say — and "empty" means it has no
 * cycle running, which is `activeCycleId` and nothing else.
 *
 * This used to also treat `status === 'fallow'` as empty. Those two fields
 * describe the same fact and were allowed to disagree: the backend set
 * `activeCycleId` when a cycle started but left `status` at 'fallow', so a
 * stocked pond rendered as empty on Farms, on Ponds and on the pond page, and
 * every one of them kept offering "Start a cycle" for a pond that had one.
 *
 * The backend now keeps `status` in step. Reading only `activeCycleId` here
 * means rows written before that fix still display correctly.
 */
const isFallow = (pond: Pick<Pond, 'status' | 'activeCycleId'>): boolean =>
    !pond.activeCycleId;

export const healthOf = (
    pond: Pick<Pond, 'status' | 'activeCycleId'>,
    severity?: AlertSeverity | null,
    freshness?: Freshness,
): PondHealth => {
    if (isFallow(pond)) return 'fallow';
    if (severity === 'critical') return 'critical';
    if (severity === 'watch') return 'watch';
    // A real alarm outranks silence; silence outranks a confident green.
    if (freshness && freshness !== 'fresh') return 'stale';
    return 'fine';
};

/** Worst severity per pond, from a briefing that spans every farm. */
/**
 * Merge the LIVE briefing with the persisted one into a single per-pond view.
 *
 * The two answer different questions and the difference has already caused a
 * visible contradiction: the live briefing is recomputed from each pond's
 * latest reading, so it describes the pond NOW; the persisted stream is
 * notification history, and is empty for a pond that has drifted into a watch
 * band without anything being written. A screen reading only the persisted
 * one reported "2/2 good" while Today, which merged both, showed one of those
 * two ponds amber.
 *
 * Every screen that judges pond health must use this, so they cannot disagree.
 * Higher severity wins; counts add, because the same pond flagged by two
 * sources is two reasons to look at it.
 */
export const mergeBriefings = (
    live: BriefingItem[],
    persisted: BriefingItem[],
): BriefingItem[] => {
    const merged = new Map<string, BriefingItem>();
    for (const item of [...live, ...persisted]) {
        const key = item.pondId ?? `${item.source}:${item.topTitle}`;
        const existing = merged.get(key);
        if (!existing) {
            merged.set(key, item);
            continue;
        }
        const higher =
            SEVERITY_RANK_ALERT[item.topSeverity] > SEVERITY_RANK_ALERT[existing.topSeverity]
                ? item
                : existing;
        merged.set(key, { ...higher, alertCount: existing.alertCount + item.alertCount });
    }
    return Array.from(merged.values()).sort(
        (a, b) => SEVERITY_RANK_ALERT[b.topSeverity] - SEVERITY_RANK_ALERT[a.topSeverity],
    );
};

const SEVERITY_RANK_ALERT: Record<AlertSeverity, number> = {
    critical: 3,
    watch: 2,
    info: 1,
};

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
    freshness: PondFreshness;
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
    /** Ponds whose colour is only "fine" because nobody has logged them. */
    stale: number;
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
        stale: rows.filter((r) => r.health === 'stale').length,
        strip: sorted.map((r) => r.health),
    };
};

/**
 * Join ponds, their contexts and the briefing into the shape the screens
 * render. Takes the clock so the whole thing stays pure and testable.
 */
export const buildPondRows = (
    ponds: Pond[],
    contexts: PondContext[],
    briefing: BriefingItem[],
    now: Date = new Date(),
): PondWithHealth[] => {
    const severity = severityByPond(briefing);
    const reason = new Map(
        briefing.filter((b) => b.pondId).map((b) => [b.pondId as string, b.topTitle]),
    );
    const ctxById = new Map(contexts.map((c) => [c.pondId, c]));

    return ponds.map((pond) => {
        const context = ctxById.get(pond.id) ?? null;
        // No context at all is not evidence of freshness — treat it as unknown.
        const freshness: PondFreshness = context
            ? pondFreshness(context, now)
            : { state: 'noData', asOf: null, ageMs: null };
        const health = healthOf(pond, severity.get(pond.id), freshness.state);
        return {
            pond,
            health,
            // A pond that is fine has nothing to explain; showing the last
            // resolved alert there would read as a live problem.
            reason: health === 'critical' || health === 'watch' ? reason.get(pond.id) ?? null : null,
            context,
            freshness,
        };
    });
};
