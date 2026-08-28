/**
 * Freshness after the farmer's OWN write.
 *
 * The farmer complained once that they had to pull-to-refresh after logging
 * data. The fix routes through `saveRecord()` — the single choke point all
 * sixteen log screens use — so every screen inherits it without being touched.
 * These tests lock that in from both directions: the immediate POST, and the
 * queued op that lands later during a drain.
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

    it('marks the pond, briefing and dashboard stale after an online POST', async () => {
        mockedPost.mockResolvedValue({ data: { id: 'fixed-uuid' } });

        await saveRecord({
            entity: 'water_quality',
            endpoint: '/water-quality',
            payload: { pondId: 'p1', ph: 7.8 },
        });

        const keys = invalidatedKeys(spy);
        expect(keys).toContain('["pond"]');
        expect(keys).toContain('["briefing"]');
        expect(keys).toContain('["home"]');
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
