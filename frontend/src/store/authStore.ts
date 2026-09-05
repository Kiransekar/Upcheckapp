import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { Session, User } from '@supabase/supabase-js';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import i18n from '../i18n';
import { authApi } from '../api/auth';
import { apiErrorMessage } from '../api/errors';
import { profilesApi } from '../api/profiles';
import { TruecallerAuth } from '../native/TruecallerAuth';
import { useSyncStore } from './syncStore';
import { useActiveFarmStore } from './activeFarmStore';
import { useNotificationStore } from './notificationStore';
import { useUploadStore } from './uploadStore';
import { clearCachedReads } from '../query/client';
import { capture, EVENTS, type AnalyticsProps } from '../features/analytics';

/**
 * HTTP failure → the analytics `reason` CATEGORY.
 *
 * Deliberately not the message: a backend message carries emails, ids and
 * whatever it chose to interpolate, and the Privacy Policy says none of that
 * reaches analytics. No response at all means the request never landed —
 * offline, DNS, timeout — which is 'network', not 'unknown'.
 */
const failureReason = (err: any): AnalyticsProps['reason'] => {
    const status = err?.response?.status;
    if (status == null) return 'network';
    if (status === 401) return 'auth';
    if (status === 403) return 'permission';
    if (status === 400 || status === 422) return 'validation';
    if (status === 409) return 'conflict';
    return 'unknown';
};

export type AuthStatus =
    | 'initializing'       // app just launched, checking stored session
    | 'unauthenticated'    // no session, show login screen
    | 'awaiting_verification' // signed up but email not confirmed
    | 'authenticated'      // fully logged in
    | 'refreshing';        // access token being refreshed

/**
 * What the person said they were here to do, on the register screen. This is a
 * FIRST-RUN ROUTING PREFERENCE, not an authorization claim: it decides which
 * onboarding step they land on and nothing else. Authority always comes from
 * the per-farm role in farm_members.
 */
export type SignupIntent = 'own_farm' | 'work_on_farm';

export interface AuthUser {
    id: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    provider: 'email' | 'google' | 'truecaller';
    emailVerified: boolean;
    // Chosen at sign-up. Owners are gated into first-run farm setup; workers go
    // straight to the dashboard. Read from Supabase user metadata.

}

interface AuthState {
    // ── Core State ──
    status: AuthStatus;
    user: AuthUser | null;
    session: Session | null;
    isLoading: boolean; // Per-request flag: an auth call is in flight (button spinners)

    // ── Startup only ──
    // True until initialize() has finished deciding whether there is a session.
    // NOTHING else may set it: it gates the whole navigator, so flipping it back
    // to true unmounts <Stack.Navigator> and destroys all navigation state. That
    // is exactly what `isLoading` used to do on every failed login — the user was
    // thrown back to the first onboarding screen instead of seeing the error.
    isBootstrapping: boolean;

    // ── Derived (computed from session) ──
    accessToken: string | null;
    isAuthenticated: boolean;

    // ── Persisted (via partialize) — refresh token restored on hydration ──
    refreshToken?: string | null;

    // ── Pending verification ──
    pendingVerificationEmail: string | null;

    // ── First-run owner farm setup ──
    // True after an owner signs up, until they create their first farm. Gates
    // the owner into the Create-Farm screen exactly once after registration.
    pendingFarmSetup: boolean;

    // ── First-run worker farm join ──
    // True after a worker signs up, until they join a farm (or explicitly skip).
    // Gates the worker into the Join-Farm screen exactly once after registration.
    pendingFarmJoin: boolean;

    // ── Error ──
    error: string | null;

    // ── Actions ──
    setSession: (session: Session) => void;
    setStatus: (status: AuthStatus) => void;
    setPendingVerification: (email: string) => void;
    clearPendingVerification: () => void;
    completeFarmSetup: () => void;
    persistOnboardingIntent: (intent: SignupIntent) => Promise<void>;
    clearOnboardingIntent: () => Promise<void>;
    restoreOnboardingIntent: () => Promise<void>;
    completeFarmJoin: () => void;
    setError: (error: string | null) => void;
    clearError: () => void;
    clearSession: () => void;
    hydrateFromSupabaseUser: (user: User, session: Session) => void;

    // ── API Actions ──
    initialize: () => Promise<void>;
    enterOfflineSession: () => void;
    recoverSession: () => Promise<void>;
    login: (email: string, password: string) => Promise<{ requires2FA: boolean; tempToken?: string }>;
    googleLogin: (idToken: string, intent?: 'signin' | 'signup') => Promise<{ requires2FA: boolean; tempToken?: string }>;
    signup: (email: string, password: string, firstName?: string, lastName?: string, intent?: SignupIntent) => Promise<void>;
    logout: () => Promise<void>;
    deleteAccount: (password?: string) => Promise<void>;
    forgotPassword: (email: string) => Promise<void>;
}

/**
 * Truecaller accounts have no real email. They are keyed on the verified phone
 * and given an internal `<digits>@truecaller.temp` login address, which must
 * never be shown to the user or treated as a contactable address.
 */
const TRUECALLER_INTERNAL_EMAIL = /@truecaller\.temp$/i;
export const isInternalEmail = (email?: string | null): boolean =>
    !!email && TRUECALLER_INTERNAL_EMAIL.test(email);

/**
 * Best display name available, without ever falling back to something that is
 * really a phone number.
 *
 * The old chain ended at `email.split('@')[0]`. For a Truecaller account that
 * local part IS the mobile number, so anyone who signed in with Truecaller saw
 * their own phone number as their name across the app.
 */
const displayNameOf = (user: User): string => {
    const meta: any = user.user_metadata ?? {};
    const fromParts = [meta.first_name, meta.last_name]
        .map((p: unknown) => (typeof p === 'string' ? p.trim() : ''))
        .filter(Boolean)
        .join(' ');

    return (
        meta.full_name ||
        meta.name ||
        fromParts ||
        // Only a REAL email may seed a name; the internal one would render the
        // phone number.
        (!isInternalEmail(user.email) ? user.email?.split('@')[0] : '') ||
        'You'
    );
};

const mapSupabaseUser = (user: User): AuthUser => ({
    id: user.id,
    // Keep the internal address out of the UI entirely — screens read this
    // field directly to show "your email".
    email: isInternalEmail(user.email) ? '' : user.email!,
    name: displayNameOf(user),
    avatarUrl:
        user.user_metadata?.avatar_url ||
        user.user_metadata?.picture ||
        null,
    provider: (user.app_metadata?.provider as 'email' | 'google' | 'truecaller') || 'email',
    emailVerified: !!user.email_confirmed_at,
});

export const useAuthStore = create<AuthState>()(
    persist(
        (set, get) => ({
            // Initial state
            status: 'initializing',
            isLoading: true,
            isBootstrapping: true,
            user: null,
            session: null,
            accessToken: null,
            isAuthenticated: false,
            pendingVerificationEmail: null,
            pendingFarmSetup: false,
            pendingFarmJoin: false,
            error: null,

            setSession: (session) =>
                set({
                    session,
                    accessToken: session.access_token,
                    user: mapSupabaseUser(session.user),
                    isAuthenticated: true,
                    status: 'authenticated',
                    error: null,
                    isLoading: false,
                }),

            setStatus: (status) => set({ status }),

            setPendingVerification: (email) =>
                set({
                    pendingVerificationEmail: email,
                    status: 'awaiting_verification',
                    isLoading: false,
                }),

            clearPendingVerification: () =>
                set({ pendingVerificationEmail: null }),

            // Owner finished first-run farm creation — drop the gate so the next
            // render lands them on the main app, and clear the stored intent so a
            // reinstall does not send them back through setup they have done.
            completeFarmSetup: () => {
                // Fire on the TRANSITION only. Four screens call this (create,
                // skip, the pond-names step, the gate) and some call it whether
                // or not the gate is up; keyed on the flag actually dropping,
                // one farmer finishing onboarding is one event.
                if (get().pendingFarmSetup) capture(EVENTS.ONBOARDING_COMPLETED);
                set({ pendingFarmSetup: false });
                void get().clearOnboardingIntent();
            },

            // Worker joined a farm (or skipped) — drop the gate so the next
            // render lands them on the main app.
            completeFarmJoin: () => {
                // Same transition rule as completeFarmSetup.
                if (get().pendingFarmJoin) capture(EVENTS.ONBOARDING_COMPLETED);
                set({ pendingFarmJoin: false });
                void get().clearOnboardingIntent();
            },

            /**
             * Remember, server-side, which first-run path this account is on.
             *
             * Device storage cannot answer this after a reinstall or on a second
             * phone, which is the case that matters: a farmer part-way through
             * setup should not be asked what they came here to do a second time.
             *
             * Stored on the `users` row in the app's own Postgres. NOT in
             * Supabase Auth `user_metadata` — that is client-mutable, and it is
             * where `accountType` lived when it was (wrongly) an authorization
             * input. This value grants nothing.
             */
            persistOnboardingIntent: async (intent: SignupIntent) => {
                try {
                    await profilesApi.setMyPreferences({ onboardingIntent: intent });
                } catch {
                    // Best-effort. Losing the resume point is a small annoyance;
                    // failing signup or farm creation over it would not be.
                }
            },

            clearOnboardingIntent: async () => {
                try {
                    await profilesApi.setMyPreferences({ onboardingIntent: undefined });
                } catch {
                    // Same: never let bookkeeping fail the action that succeeded.
                }
            },

            /**
             * Re-derive the first-run gates from the server after a session is
             * restored on a device that has never seen this account.
             *
             * Only ever turns a gate ON when the server still holds an intent —
             * an intent is cleared once acted on, so a farmer who already made
             * their farm cannot be trapped back in setup.
             */
            restoreOnboardingIntent: async () => {
                // A device that already knows where it is does not need asking.
                if (get().pendingFarmSetup || get().pendingFarmJoin) return;
                try {
                    const { data } = await profilesApi.getMyPreferences();
                    if (data?.onboardingIntent === 'own_farm') {
                        set({ pendingFarmSetup: true });
                    } else if (data?.onboardingIntent === 'work_on_farm') {
                        set({ pendingFarmJoin: true });
                    }
                } catch {
                    // Offline or unreachable — leave the gates as they are.
                }
            },

            setError: (error) => set({ error, isLoading: false }),
            clearError: () => set({ error: null }),

            clearSession: () => {
                // Drop the previous user's in-memory context so a second user on a
                // shared device never inherits User A's state: farm/pond/cycle
                // (HomeScreen), notifications + unread counts, and pending photo
                // uploads (which would otherwise replay under User B's token).
                useActiveFarmStore.getState().clearAll();
                useNotificationStore.getState().clearAll();
                useUploadStore.getState().reset();
                // The cached READS are the biggest store of User A's data and
                // the only one that survives a cold start on disk — without
                // this, User B's first paint is A's farms, ponds and alerts.
                clearCachedReads();
                set({
                    session: null,
                    accessToken: null,
                    user: null,
                    isAuthenticated: false,
                    status: 'unauthenticated',
                    pendingVerificationEmail: null,
                    pendingFarmSetup: false,
                    pendingFarmJoin: false,
                    error: null,
                    isLoading: false,
                });
            },

            hydrateFromSupabaseUser: (user, session) =>
                set({
                    session,
                    accessToken: session.access_token,
                    user: mapSupabaseUser(user),
                    isAuthenticated: true,
                    status: 'authenticated',
                    isLoading: false,
                }),

            initialize: async () => {
                const state = get();
                // Check if we have a refresh token stored
                const refreshToken = state.refreshToken;

                if (!refreshToken) {
                    set({ status: 'unauthenticated', isLoading: false, isBootstrapping: false });
                    return;
                }

                try {
                    // Use refresh token to get new session
                    const { data } = await authApi.refresh(refreshToken);
                    if (data.session) {
                        get().setSession(data.session);
                        // A device that has never seen this account has no local
                        // memory of where onboarding got to; the server does.
                        void get().restoreOnboardingIntent();
                        return; // Successfully restored session
                    }
                    // 2xx with no session → nothing to restore.
                    get().clearSession();
                } catch (err: any) {
                    const status = err?.response?.status;
                    // A real auth rejection (revoked/expired token) → log out.
                    if (status === 401 || status === 403) {
                        get().clearSession();
                        return;
                    }
                    // Transient/offline failure (no response, timeout, 5xx): do NOT
                    // log the farmer out (AUTH-1). Restore a minimal offline session
                    // from the persisted identity so the app is usable against cached
                    // data; recoverSession() re-attempts a real refresh on reconnect.
                    get().enterOfflineSession();
                } finally {
                    // Whatever we decided, startup is over — set exactly once.
                    set({ isBootstrapping: false });
                }
            },

            // Rebuild a usable-but-tokenless authenticated state from the persisted
            // identity (userId/userEmail) after a transient refresh failure at
            // launch. No access token yet — API calls will 401 and lazily refresh
            // (client.ts) or recoverSession() restores a real session on reconnect.
            enterOfflineSession: () => {
                const persisted = get() as unknown as { userId?: string; userEmail?: string };
                if (!persisted.userId) {
                    // No cached identity to fall back on — show login.
                    set({ status: 'unauthenticated', isLoading: false });
                    return;
                }
                set({
                    user: {
                        id: persisted.userId,
                        // Same rule as mapSupabaseUser: the internal
                        // `<digits>@truecaller.temp` address is not an email
                        // and its local part is not a name — it is the user's
                        // phone number, which is what used to be rendered here
                        // on every offline rehydrate.
                        email: isInternalEmail(persisted.userEmail)
                            ? ''
                            : persisted.userEmail ?? '',
                        name:
                            persisted.userEmail &&
                            !isInternalEmail(persisted.userEmail)
                                ? persisted.userEmail.split('@')[0]
                                : 'You',
                        avatarUrl: null,
                        provider: 'email',
                        emailVerified: true,
                    },
                    session: null,
                    accessToken: null,
                    isAuthenticated: true,
                    status: 'authenticated',
                    error: null,
                    isLoading: false,
                });
            },

            // Proactively restore a real session on reconnect when we're in the
            // offline-authenticated state (authenticated but no access token). A
            // genuine 401/403 here means the token was revoked → log out.
            recoverSession: async () => {
                const s = get();
                if (s.accessToken || !s.isAuthenticated) return; // already have a token / not logged in
                const refreshToken = s.refreshToken;
                if (!refreshToken) return;
                try {
                    const { data } = await authApi.refresh(refreshToken);
                    if (data.session) get().setSession(data.session);
                } catch (err: any) {
                    const status = err?.response?.status;
                    if (status === 401 || status === 403) get().clearSession();
                    // else stay offline-authenticated and try again next reconnect
                }
            },

            login: async (email, password) => {
                set({ isLoading: true, error: null });
                try {
                    const { data } = await authApi.signin({ email, password });
                    if (data.requires2FA) {
                        // Session is withheld until a TOTP code is verified.
                        set({ isLoading: false });
                        return { requires2FA: true, tempToken: data.tempToken };
                    }
                    if (data.session) {
                        get().setSession(data.session);
                        capture(EVENTS.LOGIN_COMPLETED, { method: 'email' });
                    }
                    return { requires2FA: false };
                } catch (err: any) {
                    capture(EVENTS.LOGIN_FAILED, { method: 'email', reason: failureReason(err) });
                    const message = apiErrorMessage(err, err.message || 'Login failed');
                    // An unverified account is a DEAD END unless we re-arm the
                    // resend banner. `pendingVerificationEmail` was only ever set
                    // during signup, and it does not survive leaving the app — so
                    // someone who closed the app before clicking the link came
                    // back, got "email not confirmed", and had no way to ask for
                    // another one. Their account was unusable and unrecoverable
                    // from inside the app.
                    if (/email\s*not\s*confirmed|not\s*verified|confirm.*email/i.test(message)) {
                        get().setPendingVerification(email);
                    }
                    get().setError(message);
                    throw new Error(message);
                }
            },

            googleLogin: async (idToken: string, intent?: 'signin' | 'signup') => {
                set({ isLoading: true, error: null });
                try {
                    const { data } = await authApi.googleOAuth(idToken, intent);
                    if (data.requires2FA && data.tempToken) {
                        // 2FA enabled: session withheld until a TOTP code is
                        // verified. Surfaced so the caller can show the challenge.
                        set({ isLoading: false });
                        return { requires2FA: true, tempToken: data.tempToken };
                    }
                    if (data.session) {
                        get().setSession(data.session);
                        // The backend REJECTS an unknown email when intent is
                        // 'signin' (supabase-auth.service.signInWithIdToken), so
                        // an account can only be provisioned on the 'signup'
                        // path — that is the closest signal to "created" the
                        // response carries.
                        // ponytail: intent, not a server "isNewUser" flag, so
                        // an existing account tapping Create Account counts as a
                        // signup. Return the flag from the backend if the split
                        // ever has to be exact.
                        capture(
                            intent === 'signin' ? EVENTS.LOGIN_COMPLETED : EVENTS.SIGNUP_COMPLETED,
                            { method: 'google' },
                        );
                    } else {
                        set({ isLoading: false });
                    }
                    return { requires2FA: false };
                } catch (err: any) {
                    capture(EVENTS.LOGIN_FAILED, { method: 'google', reason: failureReason(err) });
                    const message = apiErrorMessage(err, err.message || 'Google sign in failed');
                    get().setError(message);
                    return { requires2FA: false };
                }
            },

            signup: async (email, password, firstName, lastName, intent) => {
                set({ isLoading: true, error: null });
                try {
                    // i18n.language is the live UI language; it decides which language the
                    // verification and password-reset emails arrive in, and it is
                    // the only chance to record it — Supabase reads user_metadata
                    // written at signup.
                    const { data } = await authApi.signup({ email, password, firstName, lastName, language: i18n.language });
                    // The account exists from here whether or not a session came
                    // back — an unconfirmed email withholds the session, it does
                    // not withhold the account.
                    capture(EVENTS.SIGNUP_COMPLETED, { method: 'email' });
                    // Route the first run from the stated intent: someone who runs
                    // their own farm sets one up, someone joining an existing farm
                    // enters a code. Read by RootNavigator once authenticated. The
                    // intent grants NOTHING — either person can do either thing
                    // later; it only decides which screen comes next.
                    set({
                        pendingFarmSetup: intent === 'own_farm',
                        pendingFarmJoin: intent === 'work_on_farm',
                    });
                    // Persist it server-side so a reinstall, or signing in on a
                    // second phone mid-setup, resumes here instead of asking
                    // again. Fire-and-forget: failing to remember which screen
                    // to open next must not fail the signup that just succeeded.
                    if (intent) {
                        void get().persistOnboardingIntent(intent);
                    }
                    if (data.session) {
                        get().setSession(data.session);
                    } else {
                        get().setPendingVerification(email);
                    }
                } catch (err: any) {
                    const message = apiErrorMessage(err, err.message || 'Registration failed');
                    get().setError(message);
                    throw new Error(message);
                }
            },

            logout: async () => {
                try {
                    await authApi.signout();
                } catch {
                    // Ignore signout error
                }
                // Forget the cached Truecaller session so the next sign-in
                // re-prompts the bottom-sheet consent (Requirements 14.1, 14.2).
                // Safe to invoke unconditionally — the JS wrapper is a no-op
                // when the native module is unavailable (e.g. iOS).
                try {
                    TruecallerAuth.clear();
                } catch {
                    // Ignore Truecaller clear errors — sign-out must still proceed
                }
                // Also forget the cached Google account on logout (belt-and-
                // suspenders alongside the same signOut() call useGoogleAuth
                // makes before every signIn() attempt) — clears it immediately
                // rather than waiting for the next Google sign-in attempt, and
                // is a no-op if nothing was cached or Google Sign-In isn't
                // configured on this build.
                try {
                    await GoogleSignin.signOut();
                } catch {
                    // Ignore — nothing was cached, or the native module isn't configured
                }
                get().clearSession();
            },

            deleteAccount: async (password?: string) => {
                // Permanently removes the account + owned data server-side, then
                // clears the local session (returns the user to the sign-in stack).
                // Password is re-verified server-side for email/password accounts.
                await profilesApi.deleteMe(password);
                // BEFORE the teardown below, and it has to stay there.
                // clearSession() flips isAuthenticated, which runs App.tsx's
                // identify effect with a null id — that calls client.reset(),
                // which drops the queued batch along with the person id. An
                // ACCOUNT_DELETED captured after that point is either discarded
                // or attributed to a fresh anonymous stranger, so the one event
                // that measures churn would never arrive. Captured here it is
                // already in the queue, under the right person, before anything
                // is torn down. After deleteMe resolves, so a failed deletion
                // does not report a churn that did not happen.
                capture(EVENTS.ACCOUNT_DELETED);
                try {
                    TruecallerAuth.clear();
                } catch {
                    // ignore
                }
                get().clearSession();
            },

            forgotPassword: async (email) => {
                set({ isLoading: true, error: null });
                try {
                    await authApi.forgotPassword(email);
                    set({ isLoading: false });
                } catch (err: any) {
                    const message = apiErrorMessage(err, err.message || 'Failed to send reset email');
                    get().setError(message);
                    throw new Error(message);
                }
            },
        }),
        {
            name: 'upcheck-auth',
            storage: createJSONStorage(() => ({
                getItem: (key) => SecureStore.getItemAsync(key),
                setItem: (key, value) => SecureStore.setItemAsync(key, value),
                removeItem: (key) => SecureStore.deleteItemAsync(key),
            })),
            // Only persist minimal data to avoid SecureStore size limit (2048 bytes)
            // Store: refresh_token for session restoration, user.id/email for quick access
            // Do NOT persist full session object or user metadata
            partialize: (state) => ({
                refreshToken: state.session?.refresh_token,
                userId: state.user?.id,
                userEmail: state.user?.email,
                pendingVerificationEmail: state.pendingVerificationEmail,
                pendingFarmSetup: state.pendingFarmSetup,
                pendingFarmJoin: state.pendingFarmJoin,
            }),
        }
    )
);
