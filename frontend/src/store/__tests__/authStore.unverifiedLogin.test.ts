/**
 * An account that exists but has never confirmed its email must not become a
 * dead end.
 *
 * `pendingVerificationEmail` is what renders the "resend verification" banner on
 * LoginScreen, and it used to be set ONLY during signup. It does not survive the
 * app being closed — so a farmer who signed up, missed the email, and came back
 * the next day hit "email not confirmed" with no way to ask for another link.
 * Their account was unusable and unrecoverable from inside the app.
 *
 * These tests pin the recovery: a failed login that names email confirmation
 * re-arms the banner, and an ordinary wrong-password failure does not.
 */
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn().mockResolvedValue(null),
    setItemAsync: jest.fn().mockResolvedValue(undefined),
    deleteItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../native/TruecallerAuth', () => ({ TruecallerAuth: { clear: jest.fn() } }));
jest.mock('../../api/profiles', () => ({ profilesApi: {} }));
jest.mock('../../api/auth', () => ({
    authApi: { signin: jest.fn(), refresh: jest.fn(), signout: jest.fn() },
}));

import { authApi } from '../../api/auth';
import { useAuthStore } from '../authStore';

const mockedSignin = authApi.signin as jest.Mock;

/** An axios-shaped rejection carrying a server message. */
const serverError = (status: number, message: string) => ({
    response: { status, data: { message } },
});

describe('authStore.login — unverified email recovery', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        useAuthStore.setState({ pendingVerificationEmail: null, error: null });
    });

    it('re-arms the resend banner when the server says the email is not confirmed', async () => {
        mockedSignin.mockRejectedValue(serverError(400, 'Email not confirmed'));

        await expect(
            useAuthStore.getState().login('farmer@example.com', 'pw123456'),
        ).rejects.toThrow();

        // This is the whole fix: without it the banner never shows and the user
        // has no route back to a working account.
        expect(useAuthStore.getState().pendingVerificationEmail).toBe(
            'farmer@example.com',
        );
    });

    it('matches the wording variants Supabase uses', async () => {
        for (const message of [
            'Email not confirmed',
            'email not verified',
            'Please confirm your email address',
        ]) {
            useAuthStore.setState({ pendingVerificationEmail: null });
            mockedSignin.mockRejectedValue(serverError(400, message));

            await expect(
                useAuthStore.getState().login('farmer@example.com', 'pw123456'),
            ).rejects.toThrow();

            expect(useAuthStore.getState().pendingVerificationEmail).toBe(
                'farmer@example.com',
            );
        }
    });

    it('does NOT arm the banner for an ordinary bad-password failure', async () => {
        // Offering "resend verification" to someone who simply mistyped their
        // password would send them chasing an email that explains nothing.
        mockedSignin.mockRejectedValue(serverError(401, 'Invalid login credentials'));

        await expect(
            useAuthStore.getState().login('farmer@example.com', 'wrong'),
        ).rejects.toThrow();

        expect(useAuthStore.getState().pendingVerificationEmail).toBeNull();
    });
});
