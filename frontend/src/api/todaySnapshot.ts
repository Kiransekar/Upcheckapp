import { alertCenterApi, type BriefingItem } from './alertCenter';
import { pondContextApi, type PondContext } from './pondContext';
import { mergeBriefings } from '../utils/pondHealth';

/**
 * Everything Today needs about ponds and alerts, in as few requests as the
 * deployed backend allows.
 *
 * The fast path is `GET /alert-center/today`, which computes each active pond's
 * context ONCE and returns the contexts alongside the alerts derived from them.
 * The screen used to call `live-briefing` (which computed those contexts and
 * discarded them) and then `pond-context?farmId=` per farm (which computed the
 * same contexts again) — measured at 54 database queries for a three-pond owner
 * and 79 for a worker, against a five-connection pool. One call is 25 and 31.
 *
 * THE FALLBACK IS THE POINT. The app ships as an OTA update and the backend
 * deploys separately, so for some window a phone will be running this code
 * against an API that has never heard of `/today`. Without the fallback that
 * window is a blank home screen. With it, the screen is merely as slow as it
 * was yesterday, which nobody notices. Delete the fallback only once no build
 * in the wild predates the endpoint.
 */

export interface TodaySnapshot {
    contexts: PondContext[];
    /** Live and persisted already merged — see mergeBriefings. */
    briefing: BriefingItem[];
}

/** A 404/501 means "this backend is older than this app", not "no data". */
const isMissingEndpoint = (err: any): boolean => {
    const status = err?.response?.status;
    return status === 404 || status === 501;
};

export const fetchTodaySnapshot = async (
    farmIds: string[],
): Promise<TodaySnapshot> => {
    // The persisted stream is a separate, cheap read either way: it lists
    // unread alerts and computes no contexts.
    const persisted = alertCenterApi
        .briefing()
        .then((r) => r.data)
        .catch(() => [] as BriefingItem[]);

    try {
        const [fast, persistedItems] = await Promise.all([
            alertCenterApi.today().then((r) => r.data),
            persisted,
        ]);
        return {
            contexts: fast.contexts ?? [],
            briefing: mergeBriefings(fast.briefing ?? [], persistedItems),
        };
    } catch (err) {
        if (!isMissingEndpoint(err)) throw err;

        // Older backend: the two-call shape this replaced.
        //
        // A farm that FAILS must not quietly contribute zero — the figures
        // built from these contexts sit under a header that says "All farms",
        // so a sum missing one farm of three is a wrong number presented as a
        // complete one. Any failure and the whole snapshot fails, which the
        // caller renders as absent rather than as a confident total.
        const [live, persistedItems, perFarm] = await Promise.all([
            alertCenterApi.liveBriefing().then((r) => r.data).catch(() => [] as BriefingItem[]),
            persisted,
            Promise.all(
                farmIds.map((id) =>
                    pondContextApi.forFarm(id).then((r) => r.data).catch(() => null),
                ),
            ),
        ]);
        if (perFarm.some((c) => c === null)) {
            throw new Error('todaySnapshot: a farm could not be read');
        }
        return {
            contexts: (perFarm as NonNullable<(typeof perFarm)[number]>[]).flat(),
            briefing: mergeBriefings(live, persistedItems),
        };
    }
};
