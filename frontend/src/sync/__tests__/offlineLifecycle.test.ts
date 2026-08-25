// TEST-1 — end-to-end offline→online lifecycle: queue while offline, token
// expiry mid-offline, reconnect, drain, dedupe. This is the area with the most
// blockers (AUTH-1/SYNC-1/-2/-3/-4) and previously the least coverage.
jest.mock('expo-crypto', () => ({ randomUUID: () => 'op-uuid-1' }));
jest.mock('../../api/client', () => ({
    __esModule: true,
    default: { post: jest.fn(), request: jest.fn() },
}));
// authStore pulls in native/session modules that don't exist under jest;
// stub them so we can exercise the REAL useAuthStore (not a store mock) —
// this test needs saveRecord()/drainRecordQueue() to read the actual
// currently-logged-in user off the real store, the same as production.
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('../../native/TruecallerAuth', () => ({ TruecallerAuth: { clear: jest.fn() } }));
jest.mock('../../api/auth', () => ({ authApi: { refresh: jest.fn(), signout: jest.fn() } }));
jest.mock('../../api/profiles', () => ({ profilesApi: {} }));

import apiClient from '../../api/client';
import { useSyncStore } from '../../store/syncStore';
import { useAuthStore } from '../../store/authStore';
import { saveRecord, replayQueuedOp, drainRecordQueue } from '../recordSync';

const mockedPost = (apiClient as any).post as jest.Mock;
const mockedRequest = (apiClient as any).request as jest.Mock;

/** Simulate a farmer/worker being logged in on the shared device. */
const loginAs = (id: string) =>
    useAuthStore.setState({
        user: { id, email: `${id}@pond.in`, name: id, avatarUrl: null, provider: 'email', emailVerified: true },
        isAuthenticated: true,
        status: 'authenticated',
    } as any);

describe('offline→online record lifecycle (TEST-1)', () => {
    beforeEach(() => {
        useSyncStore.getState().clearQueue();
        useSyncStore.getState().setConnected(true);
        jest.clearAllMocks();
    });

    it('queues offline, survives an expired token on reconnect, then syncs once — no data loss, no duplicate', async () => {
        // 1. Offline: optimistic save → queued locally, nothing sent.
        useSyncStore.getState().setConnected(false);
        const r = await saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: { pondId: 'p1', quantityKg: 5 } });
        expect(r.queued).toBe(true);
        expect(useSyncStore.getState().queue).toHaveLength(1);

        // 2. Reconnect, but the access token expired while offline → first drain
        //    hits 401. The backlog must be PRESERVED (SYNC-1), not dropped.
        useSyncStore.getState().setConnected(true);
        mockedRequest.mockRejectedValueOnce({ response: { status: 401 } });
        await drainRecordQueue();
        expect(useSyncStore.getState().queue).toHaveLength(1);            // kept
        expect(useSyncStore.getState().failedOperations).toHaveLength(0); // not parked
        expect(useSyncStore.getState().queue[0].retryCount).toBe(1);

        // 3. Token refreshed; next drain succeeds → op removed.
        mockedRequest.mockResolvedValueOnce({ data: { id: 'op-uuid-1' } });
        useSyncStore.getState().setStatus('online');
        await drainRecordQueue();
        expect(useSyncStore.getState().queue).toHaveLength(0);
        expect(useSyncStore.getState().failedOperations).toHaveLength(0);

        // 4. A stray re-drain of the same op id is idempotent (server already has
        //    it → 409 → 'done'); nothing is re-queued or duplicated.
        const dup = { method: 'POST', endpoint: '/feed-records', payload: { id: 'op-uuid-1' } } as any;
        mockedRequest.mockRejectedValueOnce({ response: { status: 409 } });
        await expect(replayQueuedOp(dup)).resolves.toBe('done');
        expect(useSyncStore.getState().queue).toHaveLength(0);

        expect(mockedPost).not.toHaveBeenCalled(); // everything went through the drain path
    });

    it('shared-device + expired-token combo: worker A queues offline, phone is handed to worker B before reconnect, B\'s drain must not lose or mis-attribute A\'s record (SYNC-1 + SYNC-4 together)', async () => {
        // 1. Worker A is logged in on the shared phone and logs a reading with no signal.
        loginAs('worker-A');
        useSyncStore.getState().setConnected(false);
        const r = await saveRecord({ entity: 'water_quality', endpoint: '/water-quality', payload: { pondId: 'p1', ph: 7.9 } });
        expect(r.queued).toBe(true);
        expect(useSyncStore.getState().queue[0].userId).toBe('worker-A');

        // 2. Before signal returns, the phone is handed to worker B, who logs in.
        //    (authStore.logout()/login() never clears the sync queue — the design
        //    intent per SYNC-4 is per-op ownership filtering, not queue-wipe-on-logout.)
        loginAs('worker-B');
        useSyncStore.getState().setConnected(true);

        // 3. Signal returns while B is holding the phone. B's drain runs — A's
        //    queued op must be SKIPPED (not replayed under B's token, and not
        //    dropped/lost) even though a request would 401 anyway (A's token is
        //    stale). No network call should even be attempted for A's op.
        mockedRequest.mockRejectedValue({ response: { status: 401 } }); // would fire if wrongly attempted
        await drainRecordQueue();
        expect(mockedRequest).not.toHaveBeenCalled();                   // never attempted under B
        expect(useSyncStore.getState().queue).toHaveLength(1);          // A's record preserved
        expect(useSyncStore.getState().queue[0].userId).toBe('worker-A');
        expect(useSyncStore.getState().queue[0].retryCount).toBe(0);    // untouched, not burning A's retry budget
        expect(useSyncStore.getState().failedOperations).toHaveLength(0);

        // 4. Phone is handed back to A. A's own drain now runs, hits the classic
        //    "token expired while offline" 401 first — must still be preserved,
        //    not dropped, exactly as in the single-user case above.
        loginAs('worker-A');
        mockedRequest.mockRejectedValueOnce({ response: { status: 401 } });
        await drainRecordQueue();
        expect(useSyncStore.getState().queue).toHaveLength(1);
        expect(useSyncStore.getState().queue[0].retryCount).toBe(1);

        // 5. A's token refreshes; the next drain finally delivers A's original
        //    reading — under A's own request, correctly attributed.
        mockedRequest.mockResolvedValueOnce({ data: { id: expect.any(String) } });
        useSyncStore.getState().setStatus('online');
        await drainRecordQueue();
        expect(useSyncStore.getState().queue).toHaveLength(0);
        expect(useSyncStore.getState().failedOperations).toHaveLength(0);
        expect(mockedPost).not.toHaveBeenCalled(); // still only ever went through the queue/drain path
    });
});
