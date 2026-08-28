// #33 — after signing out and trying to log in again with Google, no account
// picker appeared; the app silently re-logged into the last account.
// useGoogleAuth already clears GoogleSignin's cached account before every
// signIn() attempt, but logout() itself never did — this locks in that
// logout() also forgets the cached Google account immediately, and that a
// GoogleSignin failure (nothing cached / native module unavailable) never
// blocks the rest of sign-out.
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('../../native/TruecallerAuth', () => ({ TruecallerAuth: { clear: jest.fn() } }));
jest.mock('../../api/profiles', () => ({ profilesApi: {} }));
jest.mock('../../api/auth', () => ({ authApi: { signout: jest.fn(async () => undefined) } }));
jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: { signOut: jest.fn(async () => undefined) },
}));

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { TruecallerAuth } from '../../native/TruecallerAuth';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../authStore';
import { queryClient } from '../../query/client';

describe('authStore.logout (#33)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('clears the cached Google account alongside Truecaller and the server session', async () => {
        await useAuthStore.getState().logout();

        expect(authApi.signout).toHaveBeenCalled();
        expect(TruecallerAuth.clear).toHaveBeenCalled();
        expect(GoogleSignin.signOut).toHaveBeenCalled();
    });

    // Shared-device leak: the persisted query cache (farms/ponds/home/briefing)
    // is rehydrated at cold start, so without this User B's first paint was
    // User A's farms. staleTime does not cover it — a refetch replaces the data
    // eventually, but never if B has no signal, and it is A's data either way.
    it('empties the cached reads so the next user cannot inherit them', async () => {
        queryClient.setQueryData(['farms'], [{ id: 'farm-a', name: "User A's farm" }]);
        queryClient.setQueryData(['home', 'all'], { contexts: [{ pondId: 'p1' }] });

        await useAuthStore.getState().logout();

        expect(queryClient.getQueryData(['farms'])).toBeUndefined();
        expect(queryClient.getQueryData(['home', 'all'])).toBeUndefined();
    });

    it('still clears the local session even if GoogleSignin.signOut() throws', async () => {
        (GoogleSignin.signOut as jest.Mock).mockRejectedValueOnce(new Error('nothing cached'));

        await useAuthStore.getState().logout();

        expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
});
