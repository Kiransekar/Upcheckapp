import apiClient from './client';

/** Keep in step with backend/src/announcements/announcement-locale.ts. */
export type AnnouncementCategory = 'feature' | 'fix' | 'change';

export interface AnnouncementTranslation {
    title: string;
    body: string;
}

export interface Announcement {
    id: string;
    key: string;
    category: AnnouncementCategory;
    priority: number;
    publishedAt: string;
    /** Resolved for the locale requested in the query — English if absent. */
    title: string;
    body: string;
    /**
     * Every locale the admin filled in, keyed by locale code. `en` is always
     * present (it's the fallback). This is what lets the in-card language
     * switcher change the displayed text with no extra network round trip —
     * look up `translations[locale] ?? translations.en`.
     */
    translations: Record<string, AnnouncementTranslation>;
}

export const announcementsApi = {
    /** Published, undismissed announcements for the caller, in the given locale. */
    getAll: (locale: string) =>
        apiClient.get<Announcement[]>('/announcements', { params: { locale } }),

    /** Idempotent — safe to fire-and-forget and safe to retry. */
    dismiss: (id: string) => apiClient.post(`/announcements/${id}/dismiss`),
};
