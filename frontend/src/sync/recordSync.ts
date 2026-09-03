import * as Crypto from 'expo-crypto';
import apiClient from '../api/client';
import { useSyncStore, type QueuedOperation, type DrainOutcome } from '../store/syncStore';
import { useAuthStore } from '../store/authStore';
import { invalidateForEntity, queryClient, qk } from '../query/client';
import type { TodaySnapshot } from '../api/todaySnapshot';
import { syncReminders } from '../utils/notifications';

/**
 * Shared offline-aware save path for operational records (feed, water quality,
 * sampling, mortality). Every record is stamped with a client-minted UUID so a
 * retry/replay is idempotent on the backend (accept-id + insert-or-ignore) —
 * a double-drain can never create a duplicate.
 *
 * Online  → POST immediately; on a *network* error, queue for later.
 * Offline → queue immediately and return optimistically ("saved, will sync").
 * A server rejection (4xx/5xx with a response) is a real error and is thrown.
 *
 * FRESHNESS-AFTER-YOUR-OWN-WRITE is enforced by the axios response
 * interceptor now (src/api/client.ts), which invalidates on every successful
 * write by matching the request URL — this function no longer calls
 * `invalidateForEntity()` itself on the success path; the interceptor already
 * saw the same POST and owns it. Do not add it back here — that would
 * invalidate the same keys twice for one save.
 *
 * NOTE for whoever adds the seventeenth endpoint: the backend's ValidationPipe
 * runs with `whitelist: true` (backend/src/main.ts), so a DTO that forgets to
 * declare `id` has the client-minted id SILENTLY STRIPPED — the idempotency
 * guard then has nothing to key on and every replay inserts a duplicate, with
 * no error anywhere. All sixteen current DTOs declare it. Check yours.
 */
export interface SaveRecordArgs {
    entity: string; // e.g. 'water_quality', 'feed', 'sampling', 'mortality'
    endpoint: string; // e.g. '/water-quality'
    payload: Record<string, unknown>; // record fields (id is added if absent)
}

export interface SaveRecordResult {
    id: string;
    queued: boolean; // true => stored locally, will sync on reconnect
    data?: any; // server response when sent immediately
}

/** axios surfaces network/timeout failures with no `response`. */
function isNetworkError(err: any): boolean {
    return !err?.response;
}

export async function saveRecord({ entity, endpoint, payload }: SaveRecordArgs): Promise<SaveRecordResult> {
    const id = (payload.id as string) || Crypto.randomUUID();
    const body = { ...payload, id };
    const sync = useSyncStore.getState();
    // Stamp the owning user so a shared-device replay only runs under this
    // account (SYNC-4).
    const userId = useAuthStore.getState().user?.id;

    const queue = () =>
        sync.enqueue({ type: 'CREATE', entity, endpoint, method: 'POST', payload: body, localId: id, userId });

    if (!sync.isConnected) {
        queue();
        return { id, queued: true };
    }

    try {
        const { data } = await apiClient.post(endpoint, body);
        // The server now has it. The response interceptor (api/client.ts) has
        // already invalidated every cached read this record moves — do not
        // call invalidateForEntity() here too, see the comment above.
        // Re-arm reminders from the contexts already sitting in the Today
        // screen's cache — best-effort, not awaited (a slow read must never
        // delay the save the farmer is waiting on) and never allowed to turn
        // a successful save into a queued/failed one if it throws. See
        // syncReminders in utils/notifications.ts.
        //
        // Deliberately NOT a call to alertCenterApi.today(): that endpoint
        // builds every pond's context server-side — the same expensive
        // composite read the Today screen exists to avoid paying for
        // repeatedly (see query/client.ts). Firing it on every save
        // reintroduced a full round trip of real server work per save on a
        // rural connection, just to hand fresh contexts to syncReminders.
        // If nothing is cached yet, the interceptor's invalidation above
        // already marked it stale, so the Today screen refetches on its own
        // and the next app-foreground re-arms from fresh data instead.
        try {
            const cached = queryClient.getQueryData<TodaySnapshot>([...qk.briefing(), 'home']);
            if (cached?.contexts?.length) {
                syncReminders(cached.contexts).catch(() => {
                    /* best-effort; the next foreground or save will retry */
                });
            }
        } catch {
            /* best-effort; see above */
        }
        return { id, queued: false, data };
    } catch (err) {
        if (isNetworkError(err)) {
            queue();
            return { id, queued: true };
        }
        throw err; // validation / permission / conflict the user must see
    }
}

/**
 * Replay one queued op and classify the result — the drain uses the outcome to
 * remove, retry, or park the op. Auth failures are NEVER treated as permanent:
 * losing the access token while offline must not discard the farmer's backlog
 * (SYNC-1). The apiClient interceptor refreshes on 401 and retries once; a
 * still-failing auth/permission error is retried up to the cap, then parked
 * visibly — never silently dropped.
 */
export async function replayQueuedOp(op: QueuedOperation): Promise<DrainOutcome> {
    try {
        await apiClient.request({ method: op.method, url: op.endpoint, data: op.payload });
        return 'done';
    } catch (err: any) {
        const status = err?.response?.status;
        if (!status) return 'retry';                    // network / timeout → transient
        if (status === 409) return 'done';              // idempotent duplicate the server already has
        if (status === 401 || status === 403) return 'retry'; // recoverable: refresh + retry, never drop
        if (status >= 500) return 'retry';              // server-side transient
        return 'failed';                                // 400/422/etc — permanent, park as visible
    }
}

/**
 * Flush pending writes — call on reconnect and on app start. Drains ops owned by
 * the current user (SYNC-4); in-queue transient failures are retried by the
 * drain itself. No-op when offline or the queue is empty.
 *
 * Anything that actually landed invalidates its cached reads, so the record the
 * farmer logged with no signal appears in its pond the moment it syncs — rather
 * than sitting invisible until they happen to pull-to-refresh.
 */
export async function drainRecordQueue(): Promise<void> {
    const sync = useSyncStore.getState();
    if (!sync.isConnected) return;
    const userId = useAuthStore.getState().user?.id;
    const syncedEntities = await sync.drainQueue(replayQueuedOp, userId);
    syncedEntities.forEach(invalidateForEntity);
}
