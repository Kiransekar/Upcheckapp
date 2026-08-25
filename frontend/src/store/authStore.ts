import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { Session, User } from '@supabase/supabase-js';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authApi } from '../api/auth';
import { profilesApi } from '../api/profiles';
import { TruecallerAuth } from '../native/TruecallerAuth';
import { useSyncStore } from './syncStore';
import { useActiveFarmStore } from './activeFarmStore';
import { useNotificationStore } from './notificationStore';
import { useUploadStore } from './uploadStore';

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
    isLoading: boolean; // Retained for compatibility with existing UI

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
            // render lands them on the main app.
            completeFarmSetup: () => set({ pendingFarmSetup: false }),

            // Worker joined a farm (or skipped) — drop the gate so the next
            // render lands them on the main app.
            completeFarmJoin: () => set({ pendingFarmJoin: false }),

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
                    set({ status: 'unauthenticated', isLoading: false });
                    return;
                }

                try {
                    // Use refresh token to get new session
                    const { data } = await authApi.refresh(refreshToken);
                    if (data.session) {
                        get().setSession(data.session);
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
                    }
                    return { requires2FA: false };
                } catch (err: any) {
                    const message = err.response?.data?.message || err.message || 'Login failed';
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
                    } else {
                        set({ isLoading: false });
                    }
                    return { requires2FA: false };
                } catch (err: any) {
                    const message = err.response?.data?.message || err.message || 'Google sign in failed';
                    get().setError(message);
                    return { requires2FA: false };
                }
            },

            signup: async (email, password, firstName, lastName, intent) => {
                set({ isLoading: true, error: null });
                try {
                    const { data } = await authApi.signup({ email, password, firstName, lastName });
                    // Route the first run from the stated intent: someone who runs
                    // their own farm sets one up, someone joining an existing farm
                    // enters a code. Read by RootNavigator once authenticated. The
                    // intent is NOT sent to the server and grants nothing — either
                    // person can do either thing later.
                    set({
                        pendingFarmSetup: intent === 'own_farm',
                        pendingFarmJoin: intent === 'work_on_farm',
                    });
                    if (data.session) {
                        get().setSession(data.session);
                    } else {
                        get().setPendingVerification(email);
                    }
                } catch (err: any) {
                    const message = err.response?.data?.message || err.message || 'Registration failed';
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
                    const message = err.response?.data?.message || err.message || 'Failed to send reset email';
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
