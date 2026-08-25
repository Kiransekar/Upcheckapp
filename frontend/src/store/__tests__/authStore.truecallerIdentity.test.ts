// Truecaller accounts are keyed on the verified phone and given an internal
// `<digits>@truecaller.temp` login address. The display-name chain used to end
// at `email.split('@')[0]`, so for those accounts the app rendered the user's
// own MOBILE NUMBER as their name — and showed the internal address as their
// email.
jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(async () => null),
    setItemAsync: jest.fn(async () => undefined),
    deleteItemAsync: jest.fn(async () => undefined),
}));
jest.mock('../../native/TruecallerAuth', () => ({ TruecallerAuth: { clear: jest.fn() } }));
jest.mock('../../api/profiles', () => ({ profilesApi: {} }));
jest.mock('../../api/auth', () => ({ authApi: {} }));

import { isInternalEmail, useAuthStore } from '../authStore';

const PHONE = '919876543210';
const INTERNAL = `${PHONE}@truecaller.temp`;

const supabaseUser = (over: any = {}): any => ({
    id: 'u1',
    email: INTERNAL,
    email_confirmed_at: null,
    app_metadata: { provider: 'truecaller' },
    user_metadata: {},
    ...over,
});

/** Drive a Supabase user through the store's real mapping. */
const mapped = (u: any) => {
    useAuthStore.getState().setSession({
        access_token: 'tok',
        refresh_token: 'r',
        user: u,
    } as any);
    return useAuthStore.getState().user!;
};

describe('isInternalEmail', () => {
    it('recognises the phone-derived Truecaller address', () => {
        expect(isInternalEmail(INTERNAL)).toBe(true);
        expect(isInternalEmail('919876543210@TRUECALLER.TEMP')).toBe(true);
    });

    it('leaves real addresses alone', () => {
        expect(isInternalEmail('aarav@example.com')).toBe(false);
        expect(isInternalEmail(null)).toBe(false);
        expect(isInternalEmail(undefined)).toBe(false);
    });
});

describe('a Truecaller user is never shown their phone number as a name', () => {
    it('uses full_name when the backend wrote one', () => {
        const u = mapped(supabaseUser({ user_metadata: { full_name: 'Aarav Sharma' } }));
        expect(u.name).toBe('Aarav Sharma');
    });

    it('falls back to first + last name for accounts created before full_name', () => {
        const u = mapped(
            supabaseUser({ user_metadata: { first_name: 'Aarav', last_name: 'Sharma' } }),
        );
        expect(u.name).toBe('Aarav Sharma');
    });

    it('uses the first name alone when there is no last name', () => {
        const u = mapped(supabaseUser({ user_metadata: { first_name: 'Aarav' } }));
        expect(u.name).toBe('Aarav');
    });

    it('NEVER renders the phone number, even with no name metadata at all', () => {
        const u = mapped(supabaseUser());
        expect(u.name).not.toContain(PHONE);
        expect(u.name).toBe('You');
    });

    it('hides the internal address rather than showing it as an email', () => {
        const u = mapped(supabaseUser());
        expect(u.email).toBe('');
    });
});

describe('email/password users are unaffected', () => {
    it('still derives a name from a real email local part', () => {
        const u = mapped(
            supabaseUser({
                email: 'aarav@example.com',
                app_metadata: { provider: 'email' },
            }),
        );
        expect(u.name).toBe('aarav');
        expect(u.email).toBe('aarav@example.com');
    });

    it('still prefers full_name over the email local part', () => {
        const u = mapped(
            supabaseUser({
                email: 'aarav@example.com',
                app_metadata: { provider: 'email' },
                user_metadata: { full_name: 'Aarav Sharma' },
            }),
        );
        expect(u.name).toBe('Aarav Sharma');
    });
});
