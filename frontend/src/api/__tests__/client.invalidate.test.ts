/**
 * FRESHNESS AFTER YOUR OWN WRITE — the choke point.
 *
 * Twelve direct edit/delete call sites (CreateFarmScreen, InventoryDetailScreen,
 * every log screen's edit path, CreatePondScreen, ProfileScreen,
 * SimulationListScreen, …) used to bypass invalidation entirely: only
 * `saveRecord()`'s success path called `invalidateForEntity()`, so any of
 * those 12 writes left the screen a farmer navigated back to showing stale
 * data until a manual pull-to-refresh.
 *
 * The fix moves invalidation into the response interceptor itself, so EVERY
 * successful write is covered, not just the ones that remembered to ask.
 * These tests pin the interceptor's contract directly, independent of which
 * screen or helper made the request.
 */
import { queryClient } from '../../query/client';

jest.mock('../../store/authStore', () => ({
    useAuthStore: {
        getState: () => ({ accessToken: 'a-token', session: null, refreshToken: null }),
    },
}));

jest.mock('../../i18n', () => ({
    __esModule: true,
    default: { t: (key: string) => key },
}));

import apiClient from '../client';

/** Every request succeeds with `data`, echoing the request config back. */
const respondOk = (data: any = {}) => {
    apiClient.defaults.adapter = (async (config: any) => ({
        data,
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
    })) as any;
};

/** Every request fails with a real server status (not a network error). */
const respondFail = (status: number) => {
    apiClient.defaults.adapter = (async (config: any) => {
        const err = new Error(`Request failed with status code ${status}`) as any;
        err.isAxiosError = true;
        err.config = config;
        err.response = { status, data: {}, statusText: '', headers: {}, config };
        throw err;
    }) as any;
};

describe('apiClient response interceptor — invalidates on write, at one choke point', () => {
    let invalidateSpy: jest.SpyInstance;

    beforeEach(() => {
        invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined as any);
    });

    afterEach(() => {
        invalidateSpy.mockRestore();
        jest.restoreAllMocks();
    });

    it('invalidates the mapped keys on a successful write to a mapped path', async () => {
        respondOk({ id: 'wq-1' });

        await apiClient.put('/water-quality/wq-1', { ph: 7.6 });

        expect(invalidateSpy).toHaveBeenCalled();
        const invalidatedRoots = invalidateSpy.mock.calls.map((call) => call[0].queryKey[0]);
        expect(invalidatedRoots).toEqual(
            expect.arrayContaining(['pond', 'briefing', 'home', 'farms', 'farm']),
        );
    });

    it('does not invalidate on a GET, mapped or not', async () => {
        respondOk([]);

        await apiClient.get('/water-quality');

        expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('invalidates nothing for an unmapped path — silence is correct, not a bug', async () => {
        respondOk({ id: 'inv-1' });

        await apiClient.post('/inventory', { name: 'Feed bags' });

        expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('never invalidates on an /auth/ endpoint, even a successful write', async () => {
        respondOk({ session: { access_token: 't' } });

        await apiClient.post('/auth/supabase/signout');

        expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('invalidates nothing when the write fails', async () => {
        respondFail(400);

        await expect(apiClient.put('/water-quality/wq-1', { ph: 99 })).rejects.toBeTruthy();

        expect(invalidateSpy).not.toHaveBeenCalled();
    });

    it('covers a previously-bypassed direct write path (pond edit, e.g. CreatePondScreen)', async () => {
        respondOk({ id: 'pond-1' });

        await apiClient.patch('/ponds/pond-1', { name: 'Renamed' });

        expect(invalidateSpy).toHaveBeenCalled();
        const invalidatedRoots = invalidateSpy.mock.calls.map((call) => call[0].queryKey[0]);
        expect(invalidatedRoots).toEqual(expect.arrayContaining(['pond', 'ponds', 'farm', 'farms']));
    });
});
