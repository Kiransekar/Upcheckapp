import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Last-known-good GET responses, so the app stays readable with no signal.
 *
 * WHY THIS EXISTS AT THE HTTP LAYER
 *
 * Only 7 of ~96 screens read through TanStack Query; the other 89 fetch
 * straight into `useState` and therefore had NO cache of any kind. Turning off
 * the network made those screens render "Cannot reach the server" instantly,
 * even for data the farmer had just been looking at — the app was offline-first
 * on paper and online-only in practice.
 *
 * Migrating 89 screens is not a change anyone should make in one go. Caching at
 * the axios layer fixes all of them at once, and the migrated screens are
 * unaffected because their own cache answers first.
 *
 * RULES
 *
 * - GET only. A failed write must still fail — writes go through the offline
 *   queue in src/sync/, which is what guarantees they eventually land.
 * - Only NETWORK failures are served from here. A 4xx/5xx is the server
 *   answering, and replacing a real error with stale data would hide it.
 * - Per user. `clearCachedReads()` wipes this on sign-out; without that, the
 *   next user on a shared phone would read the previous one's responses.
 */
const PREFIX = 'upcheck-http-cache:';
const INDEX_KEY = 'upcheck-http-cache-index';

/**
 * How many responses to keep. Android's AsyncStorage is one ~6MB SQLite blob
 * and the ceiling cannot be raised over the air, so this is deliberately
 * bounded and the oldest entries are evicted first.
 */
const MAX_ENTRIES = 120;

/** Skip anything huge — one oversized response would crowd out dozens. */
const MAX_ENTRY_BYTES = 256 * 1024;

/** Older than this is not worth showing at all. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface CachedResponse {
    data: unknown;
    /** When this response actually came back, so screens can say how old it is. */
    at: number;
}

const keyFor = (url: string) => `${PREFIX}${url}`;

/** Oldest-first list of cached urls. Kept separately so eviction is one read. */
async function readIndex(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(INDEX_KEY);
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

export async function writeCached(url: string, data: unknown): Promise<void> {
    try {
        const body = JSON.stringify({ data, at: Date.now() } satisfies CachedResponse);
        if (body.length > MAX_ENTRY_BYTES) return;

        const index = await readIndex();
        const next = index.filter((u) => u !== url);
        next.push(url);

        // Evict oldest beyond the cap, so the cache cannot grow without bound.
        const evicted = next.splice(0, Math.max(0, next.length - MAX_ENTRIES));
        if (evicted.length) {
            await AsyncStorage.multiRemove(evicted.map(keyFor)).catch(() => undefined);
        }

        await AsyncStorage.setItem(keyFor(url), body);
        await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
    } catch {
        // A cache write must never break a request that already succeeded.
    }
}

export async function readCached(url: string): Promise<CachedResponse | null> {
    try {
        const raw = await AsyncStorage.getItem(keyFor(url));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as CachedResponse;
        if (!parsed || typeof parsed.at !== 'number') return null;
        if (Date.now() - parsed.at > MAX_AGE_MS) return null;
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Drop every cached response. Called from `clearCachedReads()` on sign-out —
 * this is a shared-device app, and these responses are the previous user's.
 */
export async function clearOfflineCache(): Promise<void> {
    try {
        const index = await readIndex();
        await AsyncStorage.multiRemove([...index.map(keyFor), INDEX_KEY]);
    } catch {
        // Best effort; a failure here must not block sign-out.
    }
}
