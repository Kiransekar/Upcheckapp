/**
 * The refresh token must SURVIVE going offline.
 *
 * `partialize` used to write `refreshToken: state.session?.refresh_token`,
 * re-deriving it on every single state write. `enterOfflineSession()` sets
 * `session: null` — so the one code path built to keep a farmer signed in
 * through a network blip was itself wiping the token out of SecureStore. The
 * next cold start found nothing to restore and dropped them on the login
 * screen. That is the reported "app logs me out on network errors and phone
 * restarts", and it needed no revoked token and no server involvement at all.
 *
 * These tests read what actually reaches storage, not what is in memory —
 * memory was never the broken half.
 */
const mockSetItem = jest.fn(async () => undefined);

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async () => null),
    // Deferred call, and `mock`-prefixed, because babel-plugin-jest-hoist
    // lifts this factory above the const above it.
    setItemAsync: (...args: unknown[]) => mockSetItem(...(args as [])),
    deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('../../native/TruecallerAuth', () => ({ TruecallerAuth: { clear: jest.fn() } }));
jest.mock('../../api/profiles', () => ({ profilesApi: {} }));
jest.mock('../../api/auth', () => ({ authApi: { refresh: jest.fn() } }));

import { useAuthStore } from '../authStore';

const SESSION = {
    access_token: 'at-1',
    refresh_token: 'rt-1',
    user: { id: 'user-1', email: 'ramu@pond.in', user_metadata: {}, app_metadata: {} },
} as any;

/** What the LAST write to SecureStore says the refresh token is. */
const persistedRefreshToken = (): string | null | undefined => {
    const calls = mockSetItem.mock.calls as unknown as [string, string][];
    const last = calls[calls.length - 1];
    if (!last) return undefined;
    return JSON.parse(last[1])?.state?.refreshToken;
};

/** Let zustand's persist middleware flush its write. */
const flush = () => new Promise((r) => setImmediate(r));

describe('authStore — refresh token persistence', () => {
    beforeEach(() => {
        mockSetItem.mockClear();
        useAuthStore.getState().setSession(SESSION);
    });

    it('persists the refresh token when a session is set', async () => {
        await flush();
        expect(persistedRefreshToken()).toBe('rt-1');
    });

    it('KEEPS the persisted refresh token when the app drops to an offline session', async () => {
        useAuthStore.setState({ userId: 'user-1', userEmail: 'ramu@pond.in' } as any);

        useAuthStore.getState().enterOfflineSession();
        await flush();

        // In memory the session is gone — that is the point of an offline
        // session. On disk the refresh token must still be there, or the next
        // launch has nothing to sign back in with.
        expect(useAuthStore.getState().session).toBeNull();
        expect(persistedRefreshToken()).toBe('rt-1');
        expect(useAuthStore.getState().refreshToken).toBe('rt-1');
    });

    it('keeps the newest token across a rotation, never regressing to a spent one', async () => {
        useAuthStore.getState().setSession({ ...SESSION, refresh_token: 'rt-2' });
        await flush();
        expect(persistedRefreshToken()).toBe('rt-2');

        // A session object that carries no refresh token must not blank it.
        useAuthStore.getState().setSession({ ...SESSION, refresh_token: undefined });
        await flush();
        expect(persistedRefreshToken()).toBe('rt-2');
    });

    it('drops the token only on a real logout', async () => {
        useAuthStore.getState().clearSession();
        await flush();
        expect(persistedRefreshToken()).toBeNull();
    });
});
