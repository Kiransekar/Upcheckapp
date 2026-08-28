jest.mock('expo-crypto', () => ({ randomUUID: () => 'fixed-uuid' }));
jest.mock('../../api/client', () => ({
    __esModule: true,
    default: { post: jest.fn(), request: jest.fn() },
}));

import apiClient from '../../api/client';
import { useSyncStore, RETRY_COUNT_INTERVAL_MS } from '../../store/syncStore';
import { saveRecord, replayQueuedOp } from '../recordSync';

const mockedPost = apiClient.post as jest.Mock;
const mockedRequest = (apiClient as any).request as jest.Mock;

describe('recordSync.saveRecord', () => {
    beforeEach(() => {
        useSyncStore.getState().clearQueue();
        useSyncStore.getState().setConnected(true);
        jest.clearAllMocks();
    });

    it('POSTs immediately when online and stamps a client id', async () => {
        mockedPost.mockResolvedValue({ data: { id: 'fixed-uuid' } });

        const r = await saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: { pondId: 'p1', quantityKg: 5 } });

        expect(r.queued).toBe(false);
        expect(r.id).toBe('fixed-uuid');
        expect(mockedPost).toHaveBeenCalledWith('/feed-records', { pondId: 'p1', quantityKg: 5, id: 'fixed-uuid' });
        expect(useSyncStore.getState().queue).toHaveLength(0);
    });

    it('queues immediately when offline (optimistic save)', async () => {
        useSyncStore.getState().setConnected(false);

        const r = await saveRecord({ entity: 'water_quality', endpoint: '/water-quality', payload: { pondId: 'p1', ph: 7.8 } });

        expect(r.queued).toBe(true);
        expect(mockedPost).not.toHaveBeenCalled();
        expect(useSyncStore.getState().queue).toHaveLength(1);
        expect(useSyncStore.getState().queue[0].payload).toMatchObject({ id: 'fixed-uuid', ph: 7.8 });
    });

    it('queues on a network error (no response)', async () => {
        mockedPost.mockRejectedValue({ message: 'Network Error' }); // axios: no `response`

        const r = await saveRecord({ entity: 'sampling', endpoint: '/sampling', payload: { pondId: 'p1', mbwG: 12 } });

        expect(r.queued).toBe(true);
        expect(useSyncStore.getState().queue).toHaveLength(1);
    });

    it('throws (does not queue) on a server rejection', async () => {
        mockedPost.mockRejectedValue({ response: { status: 400, data: {} } });

        await expect(
            saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: { pondId: 'p1' } }),
        ).rejects.toBeDefined();
        expect(useSyncStore.getState().queue).toHaveLength(0);
    });
});

describe('recordSync.replayQueuedOp classifies outcomes (SYNC-1)', () => {
    const op = { method: 'POST', endpoint: '/feed-records', payload: { id: 'x' } } as any;

    beforeEach(() => jest.clearAllMocks());

    it("returns 'done' on success", async () => {
        mockedRequest.mockResolvedValue({ data: {} });
        await expect(replayQueuedOp(op)).resolves.toBe('done');
    });

    it("returns 'done' on 409 (idempotent duplicate already stored)", async () => {
        mockedRequest.mockRejectedValue({ response: { status: 409 } });
        await expect(replayQueuedOp(op)).resolves.toBe('done');
    });

    it("NEVER drops on 401 — returns 'retry' so the backlog is preserved", async () => {
        mockedRequest.mockRejectedValue({ response: { status: 401 } });
        await expect(replayQueuedOp(op)).resolves.toBe('retry');
    });

    it("NEVER drops on 403 — returns 'retry'", async () => {
        mockedRequest.mockRejectedValue({ response: { status: 403 } });
        await expect(replayQueuedOp(op)).resolves.toBe('retry');
    });

    it("returns 'failed' (park, not drop) on a 422 permanent rejection", async () => {
        mockedRequest.mockRejectedValue({ response: { status: 422 } });
        await expect(replayQueuedOp(op)).resolves.toBe('failed');
    });

    it("returns 'retry' on a 5xx", async () => {
        mockedRequest.mockRejectedValue({ response: { status: 500 } });
        await expect(replayQueuedOp(op)).resolves.toBe('retry');
    });

    it("returns 'retry' on a network error (no response)", async () => {
        mockedRequest.mockRejectedValue({ message: 'Network Error' });
        await expect(replayQueuedOp(op)).resolves.toBe('retry');
    });
});

describe('syncStore.drainQueue behaviour', () => {
    beforeEach(() => {
        useSyncStore.getState().clearQueue();
        useSyncStore.getState().setConnected(true);
        jest.clearAllMocks();
    });

    const enqueue = (over: Partial<{ userId: string }> = {}) =>
        useSyncStore.getState().enqueue({
            type: 'CREATE', entity: 'feed', endpoint: '/feed-records', method: 'POST', payload: { id: 'x' }, ...over,
        } as any);

    it('a 401 during drain preserves the queue (nothing lost)', async () => {
        enqueue();
        await useSyncStore.getState().drainQueue(async () => 'retry');
        expect(useSyncStore.getState().queue).toHaveLength(1);          // kept
        expect(useSyncStore.getState().failedOperations).toHaveLength(0);
        expect(useSyncStore.getState().queue[0].retryCount).toBe(1);    // counted
    });

    it('a 422 parks the op as visible-failed, never dropped', async () => {
        enqueue();
        await useSyncStore.getState().drainQueue(async () => 'failed');
        expect(useSyncStore.getState().queue).toHaveLength(0);
        expect(useSyncStore.getState().failedOperations).toHaveLength(1);
    });

    it('caps retries — a poison op is parked after MAX_SYNC_RETRIES of SPACED attempts (SYNC-3)', async () => {
        enqueue();
        const realNow = Date.now;
        let clock = realNow();
        jest.spyOn(Date, 'now').mockImplementation(() => clock);
        try {
            for (let i = 0; i < 10; i++) {
                useSyncStore.getState().setStatus('online');
                await useSyncStore.getState().drainQueue(async () => 'retry');
                clock += RETRY_COUNT_INTERVAL_MS; // a genuinely separate attempt
            }
        } finally {
            (Date.now as jest.Mock).mockRestore();
        }
        expect(useSyncStore.getState().queue).toHaveLength(0);          // no infinite ping-pong
        expect(useSyncStore.getState().failedOperations).toHaveLength(1); // parked, visible
    });

    // The bug this guards: NetInfo fires a drain on every cell handoff, so a
    // Render cold start serving 502s across five handoffs used to park a
    // perfectly valid record as "needs attention" — which reads to the farmer
    // as THEIR data being wrong.
    it('a burst of reconnect-driven drains does NOT spend the retry budget', async () => {
        enqueue();
        for (let i = 0; i < 10; i++) {
            useSyncStore.getState().setStatus('online');
            await useSyncStore.getState().drainQueue(async () => 'retry');
        }
        expect(useSyncStore.getState().failedOperations).toHaveLength(0); // still trusted
        expect(useSyncStore.getState().queue).toHaveLength(1);
        expect(useSyncStore.getState().queue[0].retryCount).toBe(1);     // one counted attempt
    });

    it('reports the entities that actually landed, so caches can be invalidated', async () => {
        enqueue();
        const synced = await useSyncStore.getState().drainQueue(async () => 'done');
        expect(synced).toEqual(['feed']);
    });

    it('reports nothing when an op only failed', async () => {
        enqueue();
        const synced = await useSyncStore.getState().drainQueue(async () => 'failed');
        expect(synced).toEqual([]);
    });

    it('only replays ops owned by the current user (SYNC-4)', async () => {
        enqueue({ userId: 'userA' });
        const handled: string[] = [];
        await useSyncStore.getState().drainQueue(async (o) => { handled.push(o.userId!); return 'done'; }, 'userB');
        expect(handled).toHaveLength(0);                                // A's op not replayed under B
        expect(useSyncStore.getState().queue).toHaveLength(1);          // still A's, untouched
    });
});
