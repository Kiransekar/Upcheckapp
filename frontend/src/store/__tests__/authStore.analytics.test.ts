// Analytics wiring for the auth lifecycle, per the Privacy Policy's section 6
// promise that analytics receives no farm records, money or harvest values —
// so every assertion here is also an assertion about WHAT is not sent: a
// method, a reason CATEGORY, and nothing else.
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('../../native/TruecallerAuth', () => ({ TruecallerAuth: { clear: jest.fn() } }));
jest.mock('../../api/profiles', () => ({
    profilesApi: {
        deleteMe: jest.fn(async () => undefined),
        setMyPreferences: jest.fn(async () => undefined),
    },
}));
jest.mock('../../api/auth', () => ({
    authApi: {
        signup: jest.fn(),
        signin: jest.fn(),
        googleOAuth: jest.fn(),
        signout: jest.fn(async () => undefined),
    },
}));
jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: { signOut: jest.fn(async () => undefined) },
}));
// The real EVENTS/sizeBand (a closed union — a typo'd event name must fail the
// build, not the assertion), with only the sink swapped for a spy.
jest.mock('../../features/analytics', () => ({
    ...jest.requireActual('../../features/analytics'),
    capture: jest.fn(),
}));

import { authApi } from '../../api/auth';
import { profilesApi } from '../../api/profiles';
import { TruecallerAuth } from '../../native/TruecallerAuth';
import { capture, EVENTS } from '../../features/analytics';
import { useAuthStore } from '../authStore';

const captured = capture as jest.Mock;
const session = { access_token: 't', refresh_token: 'r', user: { id: 'u1', email: 'a@b.com' } };

/** An axios-shaped rejection, which is what failureReason() reads. */
const httpError = (status: number) => Object.assign(new Error('nope'), { response: { status } });

beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
        pendingFarmSetup: false,
        pendingFarmJoin: false,
        isAuthenticated: false,
        user: null,
    } as any);
});

describe('signup', () => {
    it('reports an email signup as SIGNUP_COMPLETED with the method and nothing else', async () => {
        (authApi.signup as jest.Mock).mockResolvedValue({ data: { session } });

        await useAuthStore.getState().signup('a@b.com', 'pw', 'A', 'B', 'own_farm');

        expect(captured).toHaveBeenCalledWith(EVENTS.SIGNUP_COMPLETED, { method: 'email' });
        // No email, no name, no intent — the props object is exactly one key.
        const props = captured.mock.calls.find((c) => c[0] === EVENTS.SIGNUP_COMPLETED)![1];
        expect(Object.keys(props)).toEqual(['method']);
    });

    it('still reports the signup when the session is withheld pending verification', async () => {
        (authApi.signup as jest.Mock).mockResolvedValue({ data: { session: null } });

        await useAuthStore.getState().signup('a@b.com', 'pw');

        expect(captured).toHaveBeenCalledWith(EVENTS.SIGNUP_COMPLETED, { method: 'email' });
    });

    it('reports a Google account creation as SIGNUP_COMPLETED, not a login', async () => {
        (authApi.googleOAuth as jest.Mock).mockResolvedValue({ data: { session } });

        await useAuthStore.getState().googleLogin('id-token', 'signup');

        expect(captured).toHaveBeenCalledWith(EVENTS.SIGNUP_COMPLETED, { method: 'google' });
        expect(captured).not.toHaveBeenCalledWith(EVENTS.LOGIN_COMPLETED, expect.anything());
    });

    it('reports a Google sign-IN as a login, not a signup', async () => {
        (authApi.googleOAuth as jest.Mock).mockResolvedValue({ data: { session } });

        await useAuthStore.getState().googleLogin('id-token', 'signin');

        expect(captured).toHaveBeenCalledWith(EVENTS.LOGIN_COMPLETED, { method: 'google' });
        expect(captured).not.toHaveBeenCalledWith(EVENTS.SIGNUP_COMPLETED, expect.anything());
    });

    it('does not report a login that is still waiting on a 2FA code', async () => {
        (authApi.signin as jest.Mock).mockResolvedValue({
            data: { requires2FA: true, tempToken: 'tmp' },
        });

        await useAuthStore.getState().login('a@b.com', 'pw');

        expect(captured).not.toHaveBeenCalled();
    });
});

describe('login failures map to a reason CATEGORY, never a message', () => {
    it.each([
        [401, 'auth'],
        [403, 'permission'],
        [422, 'validation'],
        [400, 'validation'],
        [409, 'conflict'],
        [500, 'unknown'],
    ])('maps HTTP %i to %s', async (status, reason) => {
        (authApi.signin as jest.Mock).mockRejectedValue(httpError(status as number));

        await expect(useAuthStore.getState().login('a@b.com', 'pw')).rejects.toThrow();

        expect(captured).toHaveBeenCalledWith(EVENTS.LOGIN_FAILED, { method: 'email', reason });
    });

    it('maps a request that never got a response to network', async () => {
        (authApi.signin as jest.Mock).mockRejectedValue(new Error('Network Error'));

        await expect(useAuthStore.getState().login('a@b.com', 'pw')).rejects.toThrow();

        expect(captured).toHaveBeenCalledWith(EVENTS.LOGIN_FAILED, {
            method: 'email',
            reason: 'network',
        });
    });

    it('never lets the server message reach analytics', async () => {
        const leaky = Object.assign(new Error('No user found for farmer@example.com (id 7f3a)'), {
            response: { status: 401, data: { message: 'No user found for farmer@example.com' } },
        });
        (authApi.signin as jest.Mock).mockRejectedValue(leaky);

        await expect(useAuthStore.getState().login('a@b.com', 'pw')).rejects.toThrow();

        const props = captured.mock.calls.find((c) => c[0] === EVENTS.LOGIN_FAILED)![1];
        expect(JSON.stringify(props)).not.toMatch(/example\.com|7f3a/);
        expect(props.reason).toBe('auth');
    });
});

describe('ONBOARDING_COMPLETED fires once, on the gate actually dropping', () => {
    it('fires when an owner finishes first-run farm setup', () => {
        useAuthStore.setState({ pendingFarmSetup: true } as any);

        useAuthStore.getState().completeFarmSetup();

        expect(captured).toHaveBeenCalledWith(EVENTS.ONBOARDING_COMPLETED);
    });

    it('fires when a worker finishes first-run farm join', () => {
        useAuthStore.setState({ pendingFarmJoin: true } as any);

        useAuthStore.getState().completeFarmJoin();

        expect(captured).toHaveBeenCalledWith(EVENTS.ONBOARDING_COMPLETED);
    });

    // Several screens call completeFarmSetup() whether or not the gate is up
    // (CreateFarmScreen's skip, the pond-names step). Twice would double-count
    // every activation funnel this event anchors.
    it('does not fire a second time when the gate is already down', () => {
        useAuthStore.setState({ pendingFarmSetup: true } as any);

        useAuthStore.getState().completeFarmSetup();
        useAuthStore.getState().completeFarmSetup();

        expect(captured.mock.calls.filter((c) => c[0] === EVENTS.ONBOARDING_COMPLETED)).toHaveLength(1);
    });
});

describe('ACCOUNT_DELETED goes out BEFORE the session is torn down', () => {
    beforeEach(() => {
        useAuthStore.setState({
            isAuthenticated: true,
            user: { id: 'u1', email: 'a@b.com' } as any,
            status: 'authenticated',
        } as any);
    });

    // The whole risk of this event: clearSession() flips isAuthenticated, which
    // makes App.tsx identify a null user, which calls PostHog reset() and drops
    // the queue with the person id. Fired after that, the one event that
    // measures churn is either discarded or attributed to a stranger.
    //
    // So this asserts the STATE AT CAPTURE TIME, not merely that capture ran:
    // move the call below get().clearSession() and this fails.
    it('is captured while the session is still live', async () => {
        let authenticatedAtCapture: boolean | null = null;
        captured.mockImplementation((event: string) => {
            if (event === EVENTS.ACCOUNT_DELETED) {
                authenticatedAtCapture = useAuthStore.getState().isAuthenticated;
            }
        });

        await useAuthStore.getState().deleteAccount('pw');

        expect(captured).toHaveBeenCalledWith(EVENTS.ACCOUNT_DELETED);
        expect(authenticatedAtCapture).toBe(true);
        // ...and the teardown did still happen.
        expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });

    it('is captured before the Truecaller session is cleared', async () => {
        await useAuthStore.getState().deleteAccount('pw');

        const clearOrder = (TruecallerAuth.clear as jest.Mock).mock.invocationCallOrder[0];
        const captureOrder = captured.mock.invocationCallOrder[0];
        expect(captureOrder).toBeLessThan(clearOrder);
    });

    // A churn event for an account that is still there would be worse than no
    // event: it is a metric that reads as a departure that never happened.
    it('is not captured when the server refuses the deletion', async () => {
        (profilesApi.deleteMe as jest.Mock).mockRejectedValueOnce(httpError(403));

        await expect(useAuthStore.getState().deleteAccount('wrong')).rejects.toThrow();

        expect(captured).not.toHaveBeenCalledWith(EVENTS.ACCOUNT_DELETED);
        expect(useAuthStore.getState().isAuthenticated).toBe(true);
    });
});
