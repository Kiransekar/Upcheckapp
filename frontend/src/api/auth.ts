import apiClient from './client';


export interface SignupPayload {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
    username?: string;
    /**
     * The farmer's UI language, stored in Supabase user_metadata so the auth
     * EMAIL templates can branch on it. Supabase has one template per email
     * type with no locale switching, so without this every farmer gets English.
     */
    language?: string;
}

export interface SigninPayload {
    email: string;
    password: string;
}

export interface AuthSession {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
    expires_in: number;
    token_type: 'bearer';
    user: any;
}

export interface AuthResponse {
    message: string;
    user: any;
    session: AuthSession | null;
    // Present when the account has TOTP 2FA enabled: the session is withheld
    // until a code is verified via twoFactor.login(tempToken, code).
    requires2FA?: boolean;
    tempToken?: string;
}

export interface TwoFactorSetup {
    secret: string;
    otpauthUrl: string;
    qrCodeDataUrl: string;
}

export const authApi = {
    signup: (payload: SignupPayload) =>
        apiClient.post<AuthResponse>('/auth/supabase/signup', payload),

    signin: (payload: SigninPayload) =>
        apiClient.post<AuthResponse>('/auth/supabase/signin', payload),

    signout: () =>
        apiClient.post('/auth/supabase/signout'),

    googleOAuth: (idToken: string, intent?: 'signin' | 'signup') =>
        apiClient.post<AuthResponse>('/auth/supabase/oauth/google', { idToken, intent }),

    refresh: (refreshToken: string) =>
        apiClient.post<AuthResponse>('/auth/supabase/refresh', { refreshToken }),

    getCurrentUser: () =>
        apiClient.get('/auth/supabase/me'),

    forgotPassword: (email: string) =>
        apiClient.post('/auth/supabase/forgot-password', { email }),

    // AUTH-2: after a password reset the client holds a live recovery session.
    // This asks the backend whether 2FA gates entry; if so it returns a
    // tempToken to complete via twoFactor.login (same as the login path).
    reset2faCheck: (accessToken: string, refreshToken: string) =>
        apiClient.post<{ requires2FA: boolean; tempToken?: string }>(
            '/auth/supabase/reset-2fa-check',
            { accessToken, refreshToken },
        ),

    updatePassword: (newPassword: string) =>
        apiClient.post('/auth/supabase/update-password', { newPassword }),

    resendVerification: (email: string) =>
        apiClient.post('/auth/supabase/resend-verification', { email }),

    // Truecaller OAuth 2.0 One-Tap exchange (current flow). The backend
    // completes the PKCE token exchange and userinfo lookup, then mints a
    // session — identity is never trusted from the client.
    truecallerExchange: (payload: {
        authorizationCode: string;
        codeVerifier: string;
        state?: string;
    }) => apiClient.post<AuthResponse>('/auth/supabase/oauth/truecaller/exchange', payload),

    // Truecaller missed-call / OTP (non-Truecaller-user) sign-in. The native
    // SDK verifies the phone via a drop-call / IM-OTP and hands back an opaque
    // accessToken; the backend re-validates that token server-to-server
    // (phone is the verified identity) before minting a session. firstName /
    // lastName are the user-entered display name (the token carries no name).
    truecallerMissedCall: (payload: {
        accessToken: string;
        phoneNumber: string;
        firstName: string;
        lastName?: string;
    }) => apiClient.post<AuthResponse>('/auth/supabase/oauth/truecaller', payload),

    // Link a Truecaller-verified phone to the CURRENT (authenticated) account.
    // Safe cross-provider linking: the verified phone is the identity; a phone
    // already owned by another account returns 409.
    truecallerLinkExchange: (payload: {
        authorizationCode: string;
        codeVerifier: string;
        state?: string;
    }) =>
        apiClient.post<{ linked: boolean; phoneNumber: string }>(
            '/auth/supabase/link/truecaller/exchange',
            payload,
        ),

    truecallerLinkMissedCall: (payload: {
        accessToken: string;
        phoneNumber: string;
        firstName: string;
        lastName?: string;
    }) =>
        apiClient.post<{ linked: boolean; phoneNumber: string }>(
            '/auth/supabase/link/truecaller',
            payload,
        ),

    // ── Passwordless email OTP login ──
    loginOtpRequest: (email: string) =>
        apiClient.post('/auth/supabase/login-otp/request', { email }),

    loginOtpVerify: (email: string, otp: string) =>
        apiClient.post<AuthResponse>('/auth/supabase/login-otp/verify', { email, otp }),

    // ── TOTP two-factor authentication ──
    twoFactor: {
        setup: () => apiClient.post<TwoFactorSetup>('/auth/supabase/2fa/setup'),
        enable: (token: string) => apiClient.post<{ enabled: true; backupCodes: string[] }>('/auth/supabase/2fa/enable', { token }),
        disable: (token: string) => apiClient.post<{ enabled: false }>('/auth/supabase/2fa/disable', { token }),
        status: () => apiClient.get<{ enabled: boolean }>('/auth/supabase/2fa/status'),
        regenerateBackupCodes: (token: string) =>
            apiClient.post<{ backupCodes: string[] }>('/auth/supabase/2fa/backup-codes/regenerate', { token }),
        login: (tempToken: string, token: string) =>
            apiClient.post<AuthResponse>('/auth/supabase/2fa/login', { tempToken, token }),
    },
};
