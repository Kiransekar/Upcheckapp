// #33 — no account picker appeared after logout; the app silently re-logged
// into the last Google account. This locks in that signInWithGoogle() always
// clears the native SDK's cached account (GoogleSignin.signOut()) BEFORE
// calling signIn() — that's what forces the picker to reappear — and that a
// signOut() failure (nothing was cached) never blocks the sign-in attempt.
// Also covers #30: the intent argument must reach authStore.googleLogin so
// the backend can gate Sign-In-only auto-provisioning.
jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: {
        configure: jest.fn(),
        hasPlayServices: jest.fn(async () => true),
        signIn: jest.fn(),
        signOut: jest.fn(async () => undefined),
    },
    isSuccessResponse: jest.fn(() => true),
    isErrorWithCode: jest.fn(() => false),
    statusCodes: {
        SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
        IN_PROGRESS: 'IN_PROGRESS',
        PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
    },
}));
jest.mock('expo-constants', () => ({
    __esModule: true,
    default: { expoConfig: { extra: { googleClientIdWeb: 'web-client-id' } } },
}));

const mockGoogleLogin = jest.fn(async () => ({ requires2FA: false }));
const mockSetError = jest.fn();
jest.mock('../../store/authStore', () => ({
    useAuthStore: Object.assign(
        jest.fn(() => ({ googleLogin: mockGoogleLogin, isLoading: false })),
        { getState: jest.fn(() => ({ setError: mockSetError })) },
    ),
}));

import { renderHook } from '@testing-library/react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { useGoogleAuth } from '../useGoogleAuth';

describe('useGoogleAuth.signInWithGoogle (#33 / #30)', () => {
    beforeEach(() => jest.clearAllMocks());

    it('clears the cached Google account before signing in, so the picker reappears', async () => {
        const callOrder: string[] = [];
        (GoogleSignin.signOut as jest.Mock).mockImplementation(async () => {
            callOrder.push('signOut');
        });
        (GoogleSignin.signIn as jest.Mock).mockImplementation(async () => {
            callOrder.push('signIn');
            return { type: 'success', data: { idToken: 'id-token-1' } };
        });

        const { result } = renderHook(() => useGoogleAuth());
        await result.current.signInWithGoogle('signin');

        expect(callOrder).toEqual(['signOut', 'signIn']);
    });

    it('still attempts sign-in if signOut() throws (nothing was cached)', async () => {
        (GoogleSignin.signOut as jest.Mock).mockRejectedValue(new Error('nothing cached'));
        (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
            type: 'success',
            data: { idToken: 'id-token-2' },
        });

        const { result } = renderHook(() => useGoogleAuth());
        await result.current.signInWithGoogle('signin');

        expect(GoogleSignin.signIn).toHaveBeenCalled();
        // Asserted on the args that carry meaning rather than on the exact
        // arity — a third, optional argument was added later and pinning the
        // shape made a purely additive change look like a regression.
        const [token, oauthIntent] = mockGoogleLogin.mock.calls[0] as unknown[];
        expect(token).toBe('id-token-2');
        expect(oauthIntent).toBe('signin');
    });

    it('forwards "signup" intent from the Create Account screen', async () => {
        (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
            type: 'success',
            data: { idToken: 'id-token-3' },
        });

        const { result } = renderHook(() => useGoogleAuth());
        await result.current.signInWithGoogle('signup');

        const [token, oauthIntent] = mockGoogleLogin.mock.calls[0] as unknown[];
        expect(token).toBe('id-token-3');
        expect(oauthIntent).toBe('signup');
    });

    /**
     * W2. `IntentScreen` is a whole screen asking a real question, and its
     * answer used to reach `signup()` on the EMAIL path only — Google dropped
     * it entirely, so an owner who signed up with Google was never routed into
     * farm setup and the server-side resume point that survives a reinstall was
     * never armed.
     *
     * Two DIFFERENT intents travel together here, with confusingly similar
     * names: the OAuth intent ('signup') decides whether the backend may
     * provision an unknown email; the signup intent ('own_farm') decides which
     * screen comes next. Both must arrive.
     */
    it('forwards the first-run intent from IntentScreen alongside the OAuth intent', async () => {
        (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
            type: 'success',
            data: { idToken: 'id-token-4' },
        });

        const { result } = renderHook(() => useGoogleAuth());
        await result.current.signInWithGoogle('signup', 'own_farm');

        expect(mockGoogleLogin).toHaveBeenCalledWith('id-token-4', 'signup', 'own_farm');
    });

    it('sends no first-run intent when the flow did not start at Register', async () => {
        (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
            type: 'success',
            data: { idToken: 'id-token-5' },
        });

        const { result } = renderHook(() => useGoogleAuth());
        // Signing IN. A returning owner must not be dragged back through
        // first-run farm setup.
        await result.current.signInWithGoogle('signin');

        expect((mockGoogleLogin.mock.calls[0] as unknown[])[2]).toBeUndefined();
    });
});
