jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('../../native/TruecallerAuth', () => ({ TruecallerAuth: { clear: jest.fn() } }));
jest.mock('../../api/profiles', () => ({ profilesApi: {} }));
jest.mock('../../api/auth', () => ({ authApi: { signup: jest.fn() } }));

import { authApi } from '../../api/auth';
import { useAuthStore } from '../authStore';

const mockedSignup = authApi.signup as jest.Mock;

describe('authStore.signup — first-run gating follows the stated intent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthStore.setState({ pendingFarmSetup: false, pendingFarmJoin: false } as any);
    });

    it('routes "I run my own farm" into farm setup, not farm join', async () => {
        mockedSignup.mockResolvedValue({ data: { session: { access_token: 't', user: { email: 'a@b.com' } } } });

        await useAuthStore.getState().signup('a@b.com', 'pw', 'A', 'B', 'own_farm');

        const s = useAuthStore.getState();
        expect(s.pendingFarmSetup).toBe(true);
        expect(s.pendingFarmJoin).toBe(false);
    });

    it('routes "I work on someone else\'s farm" into farm join, not farm setup', async () => {
        mockedSignup.mockResolvedValue({ data: { session: { access_token: 't', user: { email: 'a@b.com' } } } });

        await useAuthStore.getState().signup('a@b.com', 'pw', 'A', 'B', 'work_on_farm');

        const s = useAuthStore.getState();
        expect(s.pendingFarmSetup).toBe(false);
        expect(s.pendingFarmJoin).toBe(true);
    });

    it('completeFarmJoin drops the join gate', () => {
        useAuthStore.setState({ pendingFarmJoin: true } as any);
        useAuthStore.getState().completeFarmJoin();
        expect(useAuthStore.getState().pendingFarmJoin).toBe(false);
    });
});
