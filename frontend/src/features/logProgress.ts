import type { PondContext } from '../api/pondContext';

/**
 * What the farmer has and has not done, derived from data the app already
 * fetches.
 *
 * This module is the ONLY definition of "done". The reminders, the Today
 * progress card and the farm/pond hints all read it, so they cannot drift apart
 * and tell the farmer three different things — the failure mode QA BUG-019 is
 * an instance of elsewhere in this codebase.
 *
 * Pure by design: no React, no stores, no network. Every rule below is
 * unit-testable without a device.
 */
export type Slot = 'morning' | 'afternoon' | 'evening';

/** Half-open windows [fromHour, toHour) covering the whole day. */
export const SLOT_BOUNDS: Record<Slot, { fromHour: number; toHour: number }> = {
    morning: { fromHour: 0, toHour: 12 },
    afternoon: { fromHour: 12, toHour: 17 },
    evening: { fromHour: 17, toHour: 24 },
};

export const slotAt = (date: Date): Slot => {
    const h = date.getHours();
    if (h < SLOT_BOUNDS.morning.toHour) return 'morning';
    if (h < SLOT_BOUNDS.afternoon.toHour) return 'afternoon';
    return 'evening';
};

/** Start and end of `slot` on the calendar day of `now`. */
const slotWindow = (slot: Slot, now: Date): { from: Date; to: Date } => {
    const { fromHour, toHour } = SLOT_BOUNDS[slot];
    const from = new Date(now);
    from.setHours(fromHour, 0, 0, 0);
    const to = new Date(now);
    to.setHours(0, 0, 0, 0);
    to.setHours(toHour, 0, 0, 0);
    return { from, to };
};

const within = (iso: string | null | undefined, from: Date, to: Date): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= from.getTime() && t < to.getTime();
};

/** Has this pond's water quality been logged in `slot` today? */
export const pondSlotDone = (ctx: PondContext, slot: Slot, now: Date): boolean => {
    const { from, to } = slotWindow(slot, now);
    return within(ctx.waterQuality?.recordedAt, from, to);
};

/** Has this pond been fed in `slot` today? */
export const pondFedThisSession = (ctx: PondContext, slot: Slot, now: Date): boolean => {
    const { from, to } = slotWindow(slot, now);
    return within(ctx.lastFeedAt, from, to);
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Chemistry is a weekly cadence, not a daily one, so this asks "within the last
 * seven days" rather than "in a window today".
 */
export const chemistryDone = (ctx: PondContext, now: Date): boolean => {
    const asOf = ctx.waterQuality?.chemistryAsOf;
    if (!asOf) return false;
    const t = new Date(asOf).getTime();
    return Number.isFinite(t) && now.getTime() - t < WEEK_MS;
};

export interface Progress {
    overall: { done: number; total: number };
    byFarm: Record<string, { done: number; total: number }>;
    byPond: Record<string, boolean>;
}

/**
 * Progress for the CURRENT slot. A slot counts as complete only when every
 * active pond has been logged (decision D6) — one outstanding pond keeps the
 * bar short, which is the whole point of showing it.
 */
export const progressFor = (contexts: PondContext[], now: Date): Progress => {
    const slot = slotAt(now);
    const byFarm: Progress['byFarm'] = {};
    const byPond: Progress['byPond'] = {};
    let done = 0;

    for (const ctx of contexts) {
        const ok = pondSlotDone(ctx, slot, now);
        byPond[ctx.pondId] = ok;
        if (ok) done += 1;
        const farm = (byFarm[ctx.farmId] ??= { done: 0, total: 0 });
        farm.total += 1;
        if (ok) farm.done += 1;
    }

    return { overall: { done, total: contexts.length }, byFarm, byPond };
};
