/**
 * The app's read cache.
 *
 * Until this existed nothing cached a GET, so "no signal" meant an error screen
 * on every screen — the farmer's own complaint. Every read now goes through
 * TanStack Query with an AsyncStorage-backed persister, so a cold start with no
 * bars paints the last-known data instead of a retry button.
 *
 * Three deliberate choices:
 *
 * 1. `networkMode: 'always'`. The default ('online') asks TanStack's
 *    `onlineManager`, which in React Native never sees a browser 'online' event
 *    and so reports online forever anyway — but worse, if it ever DID report
 *    offline the query would sit in `pending`/`paused` and a screen with no
 *    cache would show a skeleton that never resolves. We would rather the
 *    request go out, fail fast, and let the screen render cached-with-an-age or
 *    a real error. "Failed" must never look like "loading" or "empty".
 *
 * 2. Selective persistence. AsyncStorage on Android is one ~6MB SQLite blob and
 *    raising that ceiling needs a gradle property — i.e. a native rebuild, which
 *    this OTA-shipped app cannot do. So only the keys that make the first paint
 *    useful are written to disk (see PERSISTED_ROOTS); everything else is
 *    memory-only and simply refetches.
 *
 * 3. `gcTime` 24h so the persisted cache survives an app restart, `staleTime`
 *    30s so navigating back to a list within half a minute is instant rather
 *    than a spinner.
 */
import { AppState, type AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    QueryClient,
    focusManager,
    defaultShouldDehydrateQuery,
    type Query,
} from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { removeOldestQuery } from '@tanstack/query-persist-client-core';
import { clearOfflineCache } from '../api/offlineCache';

/** A persisted cache older than this is thrown away rather than shown. */
export const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/**
 * Query-key roots written to disk.
 *
 * Everything a farmer opens the app to see. Adding a root here costs Android
 * storage against a hard ~6MB ceiling we cannot raise over the air — weigh it,
 * though the persister now evicts oldest-first rather than failing the whole
 * write (see `retry` below).
 *
 * NOTE: this only covers the 7 screens that read through TanStack. The other
 * ~89 fetch straight into `useState`; their offline behaviour comes from the
 * HTTP-layer cache in src/api/offlineCache.ts instead.
 */
export const PERSISTED_ROOTS = new Set([
    'farms',
    'farm',
    'ponds',
    'pond',
    'home',
    'briefing',
    // Team and Money were memory-only, which meant they were the two screens
    // that ALWAYS showed an error with no signal — the app looked online-only
    // exactly where a farmer checks who is on duty and what was spent. The
    // storage argument for excluding them was never measured; both are lists
    // of small rows, far smaller than the pond contexts already persisted.
    'team',
    'money',
]);

/**
 * Query keys, one place.
 *
 * The first element is the "root" — both the persistence allow-list and the
 * post-write invalidation table below match on it, because TanStack matches
 * query keys by prefix.
 */
export const qk = {
    /** Every farm the user can see. */
    farms: () => ['farms'] as const,
    /** One farm's detail page (farm + its ponds + contexts). */
    farm: (farmId?: string) => ['farm', farmId] as const,
    /** Every pond the user can see. */
    ponds: () => ['ponds'] as const,
    /** One pond's dashboard (pond + cycle + context + its alert). */
    pond: (pondId?: string) => ['pond', pondId] as const,
    /** The Today screen's composite read. */
    home: (scopeFarmId?: string | null) => ['home', scopeFarmId ?? 'all'] as const,
    /** Cross-pond alerts + the good-day routine checklist. */
    briefing: () => ['briefing'] as const,
    /** Money tab, scoped to one farm or all of them. */
    money: (scope?: string) => ['money', scope ?? 'all'] as const,
    /** Team tab, scoped to one farm or all of them. */
    team: (scope?: string) => ['team', scope ?? 'all'] as const,
};

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            gcTime: CACHE_MAX_AGE_MS,
            // See (1) above — always attempt, never park in `paused`.
            networkMode: 'always',
            // React Navigation keeps screens mounted, so focus is the only
            // reliable "the farmer is looking at this again" signal. Wired to
            // AppState by `startFocusTracking()` below.
            refetchOnWindowFocus: true,
            refetchOnMount: true,
            refetchOnReconnect: true,
            // One retry, not three. On a dead connection three exponentially
            // backed-off attempts just delay the cached render by ~7s.
            retry: 1,
            retryDelay: 1_000,
        },
    },
});

export const persister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'upcheck-query-cache',
    // Batch the write; the default throttle already coalesces bursts.
    throttleTime: 2_000,
    /**
     * On a write failure — overwhelmingly the ~6MB Android AsyncStorage
     * ceiling we cannot raise over the air — drop the oldest query and try
     * again, repeatedly, instead of losing the entire cache.
     *
     * Without this, one oversized entry fails the write for EVERYTHING, so a
     * farmer with too much history offline gets no cache at all. Degrading to
     * "the most recent screens are cached" beats degrading to nothing. This is
     * TanStack's own retryer; do not hand-roll trimming here.
     */
    retry: removeOldestQuery,
});

/** Only the allow-listed roots reach disk — see PERSISTED_ROOTS. */
export const shouldDehydrateQuery = (query: Query): boolean =>
    defaultShouldDehydrateQuery(query) && PERSISTED_ROOTS.has(String(query.queryKey[0]));

export const persistOptions = {
    persister,
    maxAge: CACHE_MAX_AGE_MS,
    dehydrateOptions: { shouldDehydrateQuery },
};

/**
 * Wire TanStack's focusManager to React Native's AppState, so coming back from
 * the launcher refetches what is on screen. Returns an unsubscribe.
 */
export const startFocusTracking = (): (() => void) => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
        focusManager.setFocused(state === 'active');
    });
    return () => sub.remove();
};

/**
 * Which cached reads a freshly-saved record of each entity can change.
 *
 * This table is the whole reason freshness-after-your-own-write is guaranteed
 * without touching any of the sixteen log screens: they all save through
 * `saveRecord()`, which already knows the `entity`, so the invalidation happens
 * once at that choke point. Add a row when a new offline-queued entity appears.
 *
 * Keys are matched by PREFIX, so `['pond']` invalidates every pond dashboard.
 * That is intentionally blunt: a log against one pond moves that farm's
 * roll-ups and the cross-pond briefing too, and only ACTIVE queries actually
 * refetch — the rest are just marked stale for their next mount.
 */
const ENTITY_QUERY_KEYS: Record<string, readonly (readonly string[])[]> = {
    water_quality: [['pond'], ['briefing'], ['home'], ['farms'], ['farm']],
    feed: [['pond'], ['briefing'], ['home'], ['farms'], ['farm'], ['money']],
    sampling: [['pond'], ['briefing'], ['home'], ['farms'], ['farm']],
    mortality: [['pond'], ['briefing'], ['home'], ['farms'], ['farm']],
    harvest: [['pond'], ['briefing'], ['home'], ['farms'], ['farm'], ['money']],
    treatment: [['pond'], ['briefing'], ['home'], ['money']],
    chemical: [['pond'], ['briefing'], ['home'], ['money']],
    disease: [['pond'], ['briefing'], ['home']],
    plankton: [['pond'], ['home']],
    microbiology: [['pond'], ['home']],
    measurement: [['pond'], ['home']],
    feeding_tray_check: [['pond'], ['briefing'], ['home']],
    attendance: [['team'], ['home']],
    leave_request: [['team'], ['home']],
};

/** Anything not in the table above still moves the pond and the dashboard. */
const DEFAULT_QUERY_KEYS: readonly (readonly string[])[] = [['pond'], ['briefing'], ['home']];

/**
 * Mark everything a save of `entity` could have changed as stale.
 *
 * Called from `saveRecord()` after a successful POST and from the drain after
 * an op lands, which is what stops the farmer having to pull-to-refresh their
 * own reading back into view.
 */
/**
 * Drop every cached read, in memory AND on disk.
 *
 * Called from `clearSession()`, which is the same choke point that already
 * clears active-farm, notifications and pending uploads for one reason: this is
 * a SHARED-DEVICE app. Without this, the persisted roots (farms, ponds, home,
 * briefing) survive a logout and are rehydrated at the next cold start, so User
 * B's first paint is User A's farms, biomass and alerts. `staleTime` does not
 * save us — a refetch replaces that data eventually, but "eventually" is never
 * if B has no signal, and the stale render is A's private data either way.
 *
 * `invalidateForEntity` is deliberately NOT enough here: invalidation marks
 * data stale but keeps serving it while refetching. On a user switch the old
 * data must be gone, not merely stale.
 *
 * Only reached when the user is genuinely gone — explicit logout, account
 * deletion, or a refresh token the server rejected. A transient/offline refresh
 * failure calls `enterOfflineSession()` instead (AUTH-1), so a farmer with no
 * bars keeps their cache.
 */
export const clearCachedReads = (): void => {
    // Order matters: empty the cache first so any throttled write that lands
    // after `removeClient()` writes emptiness rather than resurrecting the
    // previous user's data.
    queryClient.clear();
    void persister.removeClient();
    // The HTTP-layer cache holds the same user's responses for the ~89 screens
    // that never went through TanStack. Leaving it behind would recreate the
    // shared-device leak this function exists to close.
    void clearOfflineCache();
};

export const invalidateForEntity = (entity: string): void => {
    const keys = ENTITY_QUERY_KEYS[entity] ?? DEFAULT_QUERY_KEYS;
    for (const key of keys) {
        // Fire-and-forget: a refetch failure is the screen's problem to render,
        // not this function's to await.
        void queryClient.invalidateQueries({ queryKey: [...key] });
    }
};
