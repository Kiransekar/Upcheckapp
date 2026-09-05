/**
 * Freshness after the farmer's OWN write.
 *
 * The farmer complained once that they had to pull-to-refresh after logging
 * data. The immediate-POST path is now covered by the axios response
 * interceptor (src/api/client.ts), which invalidates on every successful
 * write regardless of which screen or helper made the request — see
 * src/api/__tests__/client.invalidate.test.ts (the interceptor's contract)
 * and src/sync/__tests__/recordSync.freshness.test.ts (this exact scenario,
 * end to end with the real apiClient). `saveRecord()` no longer invalidates
 * on that path itself — see the comment on it — so this file, with
 * `api/client` mocked out, cannot observe that call any more; that's
 * intentional, not a regression.
 *
 * What THIS file still owns: the queued-op path. A write made offline must
 * invalidate nothing until it actually lands (the interceptor never even ran,
 * because no request went out), and `drainRecordQueue()` invalidates once it
 * does — that call is still its own, direct, not the interceptor's, because a
 * drain issues its request through `apiClient.request()` with a mocked
 * `apiClient` here too.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => 'fixed-uuid' }));
jest.mock('../../api/client', () => ({
    __esModule: true,
    default: { post: jest.fn(), request: jest.fn() },
}));

import apiClient from '../../api/client';
import { useSyncStore } from '../../store/syncStore';
import { saveRecord, drainRecordQueue } from '../recordSync';
import { queryClient } from '../../query/client';

const mockedPost = apiClient.post as jest.Mock;
const mockedRequest = (apiClient as any).request as jest.Mock;

/** The query keys marked stale by the call under test. */
const invalidatedKeys = (spy: jest.SpyInstance): string[] =>
    spy.mock.calls.map((call) => JSON.stringify((call[0] as any).queryKey));

describe('a successful write invalidates the reads it could have changed', () => {
    let spy: jest.SpyInstance;

    beforeEach(() => {
        useSyncStore.getState().clearQueue();
        useSyncStore.getState().setConnected(true);
        jest.clearAllMocks();
        spy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
    });

    afterEach(() => spy.mockRestore());

    it('does not invalidate directly on an online POST any more — the interceptor owns that now', async () => {
        mockedPost.mockResolvedValue({ data: { id: 'fixed-uuid' } });

        await saveRecord({
            entity: 'water_quality',
            endpoint: '/water-quality',
            payload: { pondId: 'p1', ph: 7.8 },
        });

        // With `api/client` mocked here, the real response interceptor never
        // runs — this pins that saveRecord() itself no longer duplicates its
        // work. The actual invalidation is proven end to end in
        // recordSync.freshness.test.ts, against the real apiClient.
        expect(spy).not.toHaveBeenCalled();
    });

    it('invalidates nothing when the write only got queued — the server has not got it', async () => {
        useSyncStore.getState().setConnected(false);

        await saveRecord({
            entity: 'mortality',
            endpoint: '/mortality',
            payload: { pondId: 'p1', quantity: 12 },
        });

        expect(spy).not.toHaveBeenCalled();
    });

    it('invalidates once a queued op finally lands in a drain', async () => {
        useSyncStore.getState().setConnected(false);
        await saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: { pondId: 'p1' } });
        expect(spy).not.toHaveBeenCalled();

        useSyncStore.getState().setConnected(true);
        mockedRequest.mockResolvedValue({ data: {} });
        await drainRecordQueue();

        const keys = invalidatedKeys(spy);
        expect(keys).toContain('["pond"]');
        expect(keys).toContain('["money"]'); // a feed record is a cost
    });

    it('invalidates nothing when the drain delivered nothing', async () => {
        useSyncStore.getState().setConnected(false);
        await saveRecord({ entity: 'feed', endpoint: '/feed-records', payload: { pondId: 'p1' } });
        spy.mockClear();

        useSyncStore.getState().setConnected(true);
        mockedRequest.mockRejectedValue({ response: { status: 500 } });
        await drainRecordQueue();

        expect(spy).not.toHaveBeenCalled();
    });
});
