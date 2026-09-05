/**
 * A failed login must not throw the farmer back to the start of onboarding.
 *
 * RootNavigator holds a full-screen spinner while the app is still deciding
 * whether there is a session. That spinner replaces <Stack.Navigator> entirely,
 * so whatever flag gates it also destroys every bit of navigation state when it
 * flips. It used to be `isLoading` — the same flag every auth request sets while
 * in flight. So: type a wrong password → isLoading true (navigator unmounts) →
 * error → isLoading false (navigator remounts at initialRouteName, i.e.
 * 'Language'). The error was rendered on a screen the user was no longer on.
 *
 * `isBootstrapping` is now the only gate, and only initialize() may clear it.
 * These tests pin that no auth request ever raises it again.
 */
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../native/TruecallerAuth', () => ({ TruecallerAuth: { clear: jest.fn() } }));
jest.mock('../../api/profiles', () => ({ profilesApi: {} }));
jest.mock('../../api/auth', () => ({
    authApi: {
        signin: jest.fn(),
        signup: jest.fn(),
        googleOAuth: jest.fn(),
        forgotPassword: jest.fn(),
        refresh: jest.fn(),
        signout: jest.fn(),
    },
}));

import { authApi } from '../../api/auth';
import { useAuthStore } from '../authStore';

const serverError = (status: number, message: string) => ({
    response: { status, data: { message } },
});

/** Every value isBootstrapping took while `run` was executing. */
const recordGate = async (run: () => Promise<unknown>): Promise<boolean[]> => {
    const seen: boolean[] = [useAuthStore.getState().isBootstrapping];
    const unsub = useAuthStore.subscribe((s) => seen.push(s.isBootstrapping));
    try {
        await run().catch(() => undefined);
    } finally {
        unsub();
    }
    return seen;
};

describe('authStore — the navigator gate survives failed auth requests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Post-startup state: initialize() has already run.
        useAuthStore.setState({
            isBootstrapping: false,
            isLoading: false,
            error: null,
            pendingVerificationEmail: null,
        });
    });

    it('stays down across a failed login', async () => {
        (authApi.signin as jest.Mock).mockRejectedValue(
            serverError(401, 'Invalid login credentials'),
        );

        const seen = await recordGate(() =>
            useAuthStore.getState().login('farmer@example.com', 'wrong'),
        );

        expect(seen).not.toContain(true);
        expect(useAuthStore.getState().isBootstrapping).toBe(false);
        // The error the screen renders is still there — we only moved the gate.
        expect(useAuthStore.getState().error).toBeTruthy();
        // ...and the per-request spinner flag still does its job.
        expect(useAuthStore.getState().isLoading).toBe(false);
    });

    it('stays down across a failed signup', async () => {
        (authApi.signup as jest.Mock).mockRejectedValue(
            serverError(409, 'Email already registered'),
        );

        const seen = await recordGate(() =>
            useAuthStore.getState().signup('farmer@example.com', 'pw123456'),
        );

        expect(seen).not.toContain(true);
        expect(useAuthStore.getState().isBootstrapping).toBe(false);
    });

    it('stays down across a failed Google sign-in', async () => {
        (authApi.googleOAuth as jest.Mock).mockRejectedValue(
            serverError(500, 'Google sign in failed'),
        );

        const seen = await recordGate(() =>
            useAuthStore.getState().googleLogin('id-token'),
        );

        expect(seen).not.toContain(true);
        expect(useAuthStore.getState().isBootstrapping).toBe(false);
    });

    it('stays down across a failed forgot-password', async () => {
        (authApi.forgotPassword as jest.Mock).mockRejectedValue(
            serverError(429, 'Too many requests'),
        );

        const seen = await recordGate(() =>
            useAuthStore.getState().forgotPassword('farmer@example.com'),
        );

        expect(seen).not.toContain(true);
        expect(useAuthStore.getState().isBootstrapping).toBe(false);
    });

    it('stays down when login stops at the 2FA challenge', async () => {
        (authApi.signin as jest.Mock).mockResolvedValue({
            data: { requires2FA: true, tempToken: 'tmp' },
        });

        const seen = await recordGate(() =>
            useAuthStore.getState().login('farmer@example.com', 'pw123456'),
        );

        expect(seen).not.toContain(true);
    });

    it('is up before initialize() and down exactly once after', async () => {
        useAuthStore.setState({ isBootstrapping: true, refreshToken: null } as any);
        expect(useAuthStore.getState().isBootstrapping).toBe(true);

        await useAuthStore.getState().initialize();

        expect(useAuthStore.getState().isBootstrapping).toBe(false);
    });
});
