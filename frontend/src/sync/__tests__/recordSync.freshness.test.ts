/**
 * End-to-end-ish: the actual reported bug — "after logging a record the
 * previous screen still shows old data until a manual pull-to-refresh" —
 * closed for the case the farmer reported it against.
 *
 * Unlike recordSync.test.ts, this does NOT mock `api/client`: the real axios
 * instance and its response interceptor run, so this proves the interceptor
 * and `saveRecord()` actually compose end to end, not just that each piece
 * behaves correctly in isolation.
 */
jest.mock('expo-crypto', () => ({ randomUUID: () => 'fixed-uuid' }));

jest.mock('../../store/authStore', () => ({
    useAuthStore: {
        getState: () => ({ accessToken: 'a-token', session: null, refreshToken: null, user: { id: 'u1' } }),
    },
}));

jest.mock('../../i18n', () => ({
    __esModule: true,
    default: { t: (key: string) => key },
}));

jest.mock('../../utils/notifications', () => ({
    syncReminders: jest.fn().mockResolvedValue(undefined),
}));

import apiClient from '../../api/client';
import { queryClient, qk } from '../../query/client';
import { useSyncStore } from '../../store/syncStore';
import { saveRecord } from '../recordSync';

describe('saving a water-quality record closes the stale-pond-dashboard bug', () => {
    beforeEach(() => {
        useSyncStore.getState().clearQueue();
        useSyncStore.getState().setConnected(true);
        queryClient.clear();
        apiClient.defaults.adapter = (async (config: any) => ({
            data: { id: 'fixed-uuid' },
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
        })) as any;
    });

    it("marks the pond dashboard's cached read stale so it refetches on its own", async () => {
        queryClient.setQueryData(qk.pond('p1'), { pondId: 'p1', latestReading: 'old' });
        expect(queryClient.getQueryState(qk.pond('p1'))?.isInvalidated).toBeFalsy();

        await saveRecord({
            entity: 'water_quality',
            endpoint: '/water-quality',
            payload: { pondId: 'p1', ph: 7.8 },
        });

        expect(queryClient.getQueryState(qk.pond('p1'))?.isInvalidated).toBe(true);
    });
});
