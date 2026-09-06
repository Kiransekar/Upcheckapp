/**
 * W2 — the signup intent has to survive every sign-up route, not just email.
 *
 * `IntentScreen` is a full screen asking a real question: do you run your own
 * farm, or do you work on someone else's. The answer decides whether the next
 * step after creating an account is "set up your farm" or "enter a join code",
 * and it is persisted server-side so a reinstall resumes rather than re-asks.
 *
 * It reached `signup()` on the EMAIL path only. `googleLogin` never set either
 * gate and never persisted anything, and the Truecaller screens navigated with
 * no params at all — and Truecaller is described in RegisterScreen's own header
 * as "the only working phone-number sign-up route", i.e. the likely dominant
 * path for this audience. So for most farmers the screen was ceremony: the
 * answer was collected and thrown away.
 */
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('../../native/TruecallerAuth', () => ({ TruecallerAuth: { clear: jest.fn() } }));
jest.mock('../../api/auth', () => ({ authApi: { refresh: jest.fn(), googleOAuth: jest.fn() } }));

const mockSetMyPreferences = jest.fn(async () => ({ data: {} }));
jest.mock('../../api/profiles', () => ({
    profilesApi: {
        setMyPreferences: (...a: unknown[]) => mockSetMyPreferences(...(a as [])),
    },
}));

import { authApi } from '../../api/auth';
import { useAuthStore } from '../authStore';

const SESSION = {
    access_token: 'at',
    refresh_token: 'rt',
    user: { id: 'u1', email: 'ramu@pond.in', user_metadata: {}, app_metadata: {} },
} as any;

/** Let the fire-and-forget persist call settle. */
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({ pendingFarmSetup: false, pendingFarmJoin: false } as any);
});

describe('armSignupIntent', () => {
    it('routes an owner into farm setup and remembers it server-side', async () => {
        useAuthStore.getState().armSignupIntent('own_farm');
        await flush();

        const s = useAuthStore.getState();
        expect(s.pendingFarmSetup).toBe(true);
        expect(s.pendingFarmJoin).toBe(false);
        // The resume point that survives a reinstall or a second phone.
        expect(mockSetMyPreferences).toHaveBeenCalledWith({ onboardingIntent: 'own_farm' });
    });

    it('routes a worker into the join-code screen', async () => {
        useAuthStore.getState().armSignupIntent('work_on_farm');
        await flush();

        const s = useAuthStore.getState();
        expect(s.pendingFarmJoin).toBe(true);
        expect(s.pendingFarmSetup).toBe(false);
        expect(mockSetMyPreferences).toHaveBeenCalledWith({ onboardingIntent: 'work_on_farm' });
    });

    it('arms nothing, and remembers nothing, without an intent', async () => {
        useAuthStore.getState().armSignupIntent(undefined);
        await flush();

        const s = useAuthStore.getState();
        expect(s.pendingFarmSetup).toBe(false);
        expect(s.pendingFarmJoin).toBe(false);
        // A plain sign-IN must not write an onboarding resume point.
        expect(mockSetMyPreferences).not.toHaveBeenCalled();
    });
});

describe('googleLogin — the path that used to drop the answer', () => {
    beforeEach(() => {
        (authApi.googleOAuth as jest.Mock).mockResolvedValue({ data: { session: SESSION } });
    });

    it('routes a Google SIGN-UP by the intent the farmer chose', async () => {
        await useAuthStore.getState().googleLogin('id-token', 'signup', 'own_farm');
        await flush();

        expect(useAuthStore.getState().pendingFarmSetup).toBe(true);
        expect(mockSetMyPreferences).toHaveBeenCalledWith({ onboardingIntent: 'own_farm' });
    });

    it('leaves a returning farmer alone on a Google SIGN-IN', async () => {
        // A signed-in owner mid-setup keeps whatever gate they already had;
        // signing in is not an answer to the intent question.
        useAuthStore.setState({ pendingFarmSetup: true } as any);

        await useAuthStore.getState().googleLogin('id-token', 'signin');
        await flush();

        expect(useAuthStore.getState().pendingFarmSetup).toBe(true);
        expect(mockSetMyPreferences).not.toHaveBeenCalled();
    });
});
