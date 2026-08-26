import apiClient from './client';

export interface Profile {
    id: string;
    email?: string;
    username?: string;
    fullName?: string;
    avatarUrl?: string;
    website?: string;
    languagePreference: string;
    createdAt?: string;
    updatedAt: string;
}

/**
 * Compat layer for screens still using firstName/lastName/phone.
 * The backend stores `fullName` as a single field — split on space.
 */
export interface ProfileCompat extends Profile {
    firstName?: string;
    lastName?: string;
    phone?: string;
}

export interface UpdateProfileDto {
    email?: string;
    username?: string;
    fullName?: string;
    avatarUrl?: string;
    website?: string;
    languagePreference?: string;
}

/** Compat DTO that accepts firstName/lastName and maps to fullName */ 
export interface CompatUpdateProfileDto {
    email?: string;
    username?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    website?: string;
    languagePreference?: string;
    phone?: string;
}

export interface PublicProfile {
    id: string;
    username?: string;
    fullName?: string;
    avatarUrl?: string;
    website?: string;
}

function toCompat(p: Profile): ProfileCompat {
    const parts = (p.fullName || '').split(' ');
    return {
        ...p,
        firstName: parts[0] || undefined,
        lastName: parts.slice(1).join(' ') || undefined,
    };
}

function compatToUpdateDto(data: CompatUpdateProfileDto): UpdateProfileDto {
    const { firstName, lastName, phone: _phone, ...rest } = data;
    const fullName = [firstName, lastName].filter(Boolean).join(' ') || undefined;
    return { ...rest, fullName };
}

export const profilesApi = {
    getMine: () =>
        apiClient.get<Profile>('/profiles/me').then(res => ({ ...res, data: toCompat(res.data) })),

    getById: (id: string) =>
        apiClient.get<Profile>(`/profiles/${id}`).then(res => ({ ...res, data: toCompat(res.data) })),

    update: (id: string, data: CompatUpdateProfileDto) =>
        apiClient.patch<Profile>(`/profiles/${id}`, compatToUpdateDto(data)).then(res => ({ ...res, data: toCompat(res.data) })),

    // Password is required server-side for email/password accounts (strict
    // re-auth before this irreversible action); omitted for OAuth/phone
    // accounts, which have no password to verify.
    deleteMe: (password?: string) =>
        apiClient.delete('/profiles/me', password ? { data: { password } } : undefined),

    checkUsername: (username: string) =>
        apiClient.get<{ available: boolean }>(`/profiles/check-username/${username}`),

    getPublicProfile: (username: string) =>
        apiClient.get<PublicProfile>(`/profiles/public/${username}`),

    inviteFriend: (toEmail: string) =>
        apiClient.post<{ success: boolean }>('/profiles/invite', { toEmail }),

    /**
     * The caller's own onboarding preferences, stored on the `users` row in the
     * app's Postgres (Supabase-hosted) — not on the device, and not in Supabase
     * Auth `user_metadata`, which is client-mutable.
     */
    getMyPreferences: () =>
        apiClient.get<UserPreferences>('/profiles/me/preferences'),

    setMyPreferences: (patch: UserPreferences) =>
        apiClient.patch<UserPreferences>('/profiles/me/preferences', patch),
};

/** Server-persisted, per-user preferences. Routes first-run; grants nothing. */
export interface UserPreferences {
    onboardingIntent?: 'own_farm' | 'work_on_farm';
}
