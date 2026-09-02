/**
 * What a FAILED TOKEN REFRESH is allowed to do to the farmer's session.
 *
 * The interceptor used to call `clearSession()` for any refresh failure at all,
 * which meant walking out of coverage logged the farmer out and — because
 * `clearSession()` calls `clearCachedReads()` — wiped every cached read at the
 * exact moment there was no signal to log back in with.
 *
 * `restoreSession()` in authStore already drew this distinction on the
 * cold-start path; these lock it in for the interceptor too.
 */
import axios, { AxiosError } from 'axios';

const mockClearSession = jest.fn();
const mockEnterOfflineSession = jest.fn();
const mockSetSession = jest.fn();

jest.mock('../../store/authStore', () => ({
    useAuthStore: {
        getState: () => ({
            accessToken: 'an-expired-access-token',
            session: null,
            refreshToken: 'a-stored-refresh-token',
            clearSession: mockClearSession,
            enterOfflineSession: mockEnterOfflineSession,
            setSession: mockSetSession,
        }),
    },
}));

jest.mock('../../i18n', () => ({
    __esModule: true,
    default: { t: (key: string) => key },
}));

import apiClient from '../client';

/**
 * Make every apiClient request come back as a real HTTP 401.
 *
 * A custom adapter owns settling its own result — axios does not apply
 * `validateStatus` to whatever an adapter resolves with — so a 401 has to be
 * REJECTED here, or the interceptor's error handler never runs at all.
 */
const respondWith401 = () => {
    apiClient.defaults.adapter = (async (config: any) => {
        const err = new Error('Request failed with status code 401') as AxiosError;
        (err as any).isAxiosError = true;
        (err as any).config = config;
        (err as any).response = {
            data: { message: 'jwt expired' },
            status: 401,
            statusText: 'Unauthorized',
            headers: {},
            config,
        };
        throw err;
    }) as any;
};

/** An axios error with NO response — what a dead connection produces. */
const networkError = () => {
    const err = new Error('Network Error') as AxiosError;
    (err as any).isAxiosError = true;
    err.response = undefined;
    return err;
};

/** An axios error carrying a real server status. */
const httpError = (status: number) => {
    const err = new Error(`Request failed with status code ${status}`) as AxiosError;
    (err as any).isAxiosError = true;
    (err as any).response = { status, data: {} };
    return err;
};

describe('apiClient — refresh failure must not end the session by itself', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        respondWith401();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('keeps the farmer signed in when the refresh dies with no response', async () => {
        jest.spyOn(axios, 'post').mockRejectedValue(networkError());

        await expect(apiClient.get('/farms')).rejects.toBeTruthy();

        // The whole point: no signal is not proof the session is gone.
        expect(mockClearSession).not.toHaveBeenCalled();
        expect(mockEnterOfflineSession).toHaveBeenCalled();
    });

    it('keeps the farmer signed in when the refresh fails with a 5xx', async () => {
        jest.spyOn(axios, 'post').mockRejectedValue(httpError(503));

        await expect(apiClient.get('/farms')).rejects.toBeTruthy();

        expect(mockClearSession).not.toHaveBeenCalled();
        expect(mockEnterOfflineSession).toHaveBeenCalled();
    });

    // The other half of the contract — a genuinely revoked refresh token still
    // has to log the farmer out, or this "fix" would be a security hole.
    it.each([401, 403])(
        'still logs out when the server rejects the refresh token (%i)',
        async (status) => {
            jest.spyOn(axios, 'post').mockRejectedValue(httpError(status));

            await expect(apiClient.get('/farms')).rejects.toBeTruthy();

            expect(mockClearSession).toHaveBeenCalled();
            expect(mockEnterOfflineSession).not.toHaveBeenCalled();
        },
    );

    it('does not touch the session at all when the refresh succeeds', async () => {
        jest.spyOn(axios, 'post').mockResolvedValue({
            data: { session: { access_token: 'a-fresh-token', refresh_token: 'r' } },
        } as any);

        // The retry re-enters the adapter, which still answers 401, so the call
        // rejects — what matters here is that the session was renewed, not cleared.
        await expect(apiClient.get('/farms')).rejects.toBeTruthy();

        expect(mockSetSession).toHaveBeenCalled();
        expect(mockClearSession).not.toHaveBeenCalled();
        expect(mockEnterOfflineSession).not.toHaveBeenCalled();
    });
});
