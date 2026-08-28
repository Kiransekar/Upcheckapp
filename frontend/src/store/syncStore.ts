import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dependency-free id for queued operations (no crypto polyfill needed — these
// ids are local queue keys, not security-sensitive).
const uuidv4 = (): string =>
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export type SyncStatus = 'online' | 'offline' | 'syncing';

// A transiently-failing op is retried at most this many times before it is
// parked in failedOperations (terminal, surfaced to the user). Without a cap a
// poison op ping-pongs between queues forever (SYNC-3).
export const MAX_SYNC_RETRIES = 5;

/**
 * A failed attempt only COUNTS against the cap above once this long has passed
 * since the last counted one.
 *
 * The budget used to burn per drain, and NetInfo fires a drain on every cell
 * handoff — so a farmer walking between two towers while the Render free-tier
 * backend cold-starts could park five perfectly valid records as "needs
 * attention" inside a minute. To the farmer that reads as THEIR data being
 * wrong. Counting spaced attempts instead means the cap still catches a
 * genuinely poisonous op (five failures over ~an hour of connectivity) without
 * ever punishing a flaky commute.
 */
export const RETRY_COUNT_INTERVAL_MS = 15 * 60 * 1000;

/**
 * Pause between ops in a drain. Twenty queued records used to hit a
 * cold-starting Render as fast as the radio allowed, against a 5-connection
 * pool. Nobody is watching a background drain, so a few seconds of politeness
 * costs the farmer nothing and costs the backend a lot less.
 */
export const DRAIN_OP_DELAY_MS = 250;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export type QueuedOperation = {
    id: string;
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    entity: string;
    endpoint: string;
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    payload: Record<string, unknown>;
    localId?: string;
    // Owning user at enqueue time. Queued ops must only replay under the same
    // account (SYNC-4) — on a shared device, user A's records must never sync
    // under user B's token (mis-attribution) or get dropped as 403.
    userId?: string;
    retryCount: number;
    createdAt: string;
    /**
     * When this op last had a failure COUNTED against its retry budget (not
     * when it was last attempted). See RETRY_COUNT_INTERVAL_MS — the gap is
     * what stops a burst of reconnects from eating the budget.
     */
    retryCountedAt?: string;
};

/**
 * Handler outcome for one queued op:
 *  - 'done'   → succeeded (or an idempotent duplicate the server already has) → remove.
 *  - 'retry'  → transient failure (network, 5xx, or auth to be refreshed) → keep and retry;
 *               after MAX_SYNC_RETRIES it is parked as terminal-failed.
 *  - 'failed' → permanent rejection (e.g. 400/422) → park immediately, never silently drop.
 */
export type DrainOutcome = 'done' | 'retry' | 'failed';

/** Handler signature for drainQueue — receives each op, returns its outcome. */
export type DrainHandler = (op: QueuedOperation) => Promise<DrainOutcome>;

interface SyncState {
    status: SyncStatus;
    /** True when the device has an active internet connection. */
    isConnected: boolean;
    queue: QueuedOperation[];
    lastSyncedAt: string | null;
    failedOperations: QueuedOperation[];

    /** Update connectivity flag and derive status (offline / online). */
    setConnected: (connected: boolean) => void;
    setStatus: (status: SyncStatus) => void;
    enqueue: (operation: Omit<QueuedOperation, 'id' | 'retryCount' | 'createdAt'>) => void;
    dequeue: (id: string) => void;
    markFailed: (id: string) => void;
    incrementRetry: (id: string) => void;
    retryFailed: () => void;
    clearQueue: () => void;
    setLastSyncedAt: (time: string) => void;
    /**
     * Process queued operations through `handler` in order. 'done' ops are
     * removed; 'retry' ops stay (parked as failed once they exceed
     * MAX_SYNC_RETRIES); 'failed' ops are parked immediately. When `currentUserId`
     * is given, only ops owned by that user (or legacy ops with no owner) replay.
     * No-ops when offline or already syncing.
     *
     * Returns the DISTINCT entities that actually landed this drain. Nothing
     * used to observe a successful drain at all — `lastSyncedAt` was written
     * and no screen read it — so a record synced in the background stayed
     * invisible until the farmer pulled to refresh. The caller uses this to
     * invalidate the affected reads.
     */
    drainQueue: (handler: DrainHandler, currentUserId?: string) => Promise<string[]>;
}

export const useSyncStore = create<SyncState>()(
    persist(
        (set, get) => ({
            status: 'online',
            isConnected: true,
            queue: [],
            lastSyncedAt: null,
            failedOperations: [],

            setConnected: (connected) =>
                set((state) => ({
                    isConnected: connected,
                    // Only switch between online/offline; preserve 'syncing' if in-flight.
                    status: state.status === 'syncing'
                        ? state.status
                        : connected ? 'online' : 'offline',
                })),

            setStatus: (status) => set({ status }),

            enqueue: (operation) => {
                const newOp: QueuedOperation = {
                    ...operation,
                    id: uuidv4(),
                    retryCount: 0,
                    createdAt: new Date().toISOString(),
                };
                set((state) => ({ queue: [...state.queue, newOp] }));
            },

            dequeue: (id) =>
                set((state) => ({ queue: state.queue.filter((op) => op.id !== id) })),

            markFailed: (id) => {
                const op = get().queue.find((o) => o.id === id);
                if (!op) return;
                set((state) => ({
                    queue: state.queue.filter((o) => o.id !== id),
                    failedOperations: [...state.failedOperations, { ...op, retryCount: op.retryCount + 1 }],
                }));
            },

            incrementRetry: (id) =>
                set((state) => ({
                    queue: state.queue.map((o) =>
                        o.id === id
                            ? { ...o, retryCount: o.retryCount + 1, retryCountedAt: new Date().toISOString() }
                            : o,
                    ),
                })),

            // User-initiated "retry all" — move parked ops back into the queue with
            // a fresh retry budget. Not called automatically (that was the SYNC-3
            // infinite loop); the drain retries in-queue ops on its own.
            retryFailed: () =>
                set((state) => ({
                    queue: [
                        ...state.queue,
                        ...state.failedOperations.map((o) => ({
                            ...o,
                            retryCount: 0,
                            retryCountedAt: undefined,
                        })),
                    ],
                    failedOperations: [],
                })),

            clearQueue: () => set({ queue: [], failedOperations: [] }),

            setLastSyncedAt: (time) => set({ lastSyncedAt: time }),

            drainQueue: async (handler, currentUserId) => {
                const state = get();
                if (!state.isConnected || state.status === 'syncing') return [];
                if (state.queue.length === 0) return [];

                const synced = new Set<string>();
                set({ status: 'syncing' });
                // Snapshot the queue so concurrent enqueues during drain are safe.
                // Only replay ops owned by the active user (SYNC-4); legacy ops with
                // no recorded owner are treated as the current user's.
                const opsToProcess = get().queue.filter(
                    (op) => !currentUserId || !op.userId || op.userId === currentUserId,
                );

                for (let i = 0; i < opsToProcess.length; i++) {
                    const op = opsToProcess[i];
                    // Space the ops out — see DRAIN_OP_DELAY_MS. Between, not
                    // before, so a single queued record still syncs instantly.
                    if (i > 0) await sleep(DRAIN_OP_DELAY_MS);

                    let outcome: DrainOutcome;
                    try {
                        outcome = await handler(op);
                    } catch {
                        outcome = 'retry'; // unexpected throw is transient, never a silent drop
                    }

                    if (outcome === 'done') {
                        synced.add(op.entity);
                        get().dequeue(op.id);
                    } else if (outcome === 'failed') {
                        get().markFailed(op.id); // permanent → park as visible, never drop
                    } else {
                        // Transient failure. A pure connectivity drop (the device went
                        // offline mid-drain) must NOT consume any op's retry budget —
                        // otherwise a perfectly good op is parked as failed after a few
                        // offline cycles. Stop draining here; the remaining ops (and this
                        // one) replay on reconnect with their budget intact.
                        // ponytail: isConnected is the only connectivity signal in-store;
                        // if NetInfo hasn't fired yet a server-side 5xx still counts. Fine —
                        // the cap is meant to catch persistent server rejects, not outages.
                        if (!get().isConnected) break;
                        // Keep retrying until the cap, then park it — but only
                        // count a failure that is genuinely SPACED from the last
                        // counted one (RETRY_COUNT_INTERVAL_MS). A burst of
                        // reconnect-triggered drains against a cold-starting
                        // backend must not spend the budget of a valid record.
                        const cur = get().queue.find((o) => o.id === op.id);
                        if (!cur) continue;
                        const lastCounted = cur.retryCountedAt ? Date.parse(cur.retryCountedAt) : null;
                        const counts =
                            lastCounted == null ||
                            Number.isNaN(lastCounted) ||
                            Date.now() - lastCounted >= RETRY_COUNT_INTERVAL_MS;
                        if (!counts) continue;

                        if (cur.retryCount + 1 >= MAX_SYNC_RETRIES) {
                            get().markFailed(op.id);
                        } else {
                            get().incrementRetry(op.id);
                        }
                    }
                }

                const nowConnected = get().isConnected;
                set({
                    status: nowConnected ? 'online' : 'offline',
                    lastSyncedAt: new Date().toISOString(),
                });
                return [...synced];
            },
        }),
        {
            name: 'sync-queue-storage',
            storage: createJSONStorage(() => AsyncStorage),
            // isConnected is runtime state — don't rehydrate a stale value;
            // it will be set correctly once NetInfo fires on mount.
            partialize: (state) => ({
                queue: state.queue,
                failedOperations: state.failedOperations,
                lastSyncedAt: state.lastSyncedAt,
            }),
        }
    )
);
