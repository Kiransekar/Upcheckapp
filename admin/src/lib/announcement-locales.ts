/**
 * Plain constants shared by the server-only API client (`announcements.ts`)
 * and the client-side form/preview (`announcement-form.tsx`). No
 * `server-only` here on purpose — this file carries no API key, just the
 * vocabulary, so the form component is allowed to import it.
 */

export type AnnouncementCategory = 'feature' | 'fix' | 'change';

/** Keep in step with backend/src/announcements/announcement-locale.ts. */
export const LOCALES = ['en', 'hi', 'bn', 'ta', 'te', 'or'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABEL: Record<Locale, string> = {
    en: 'English',
    hi: 'Hindi',
    bn: 'Bengali',
    ta: 'Tamil',
    te: 'Telugu',
    or: 'Odia',
};

export const CATEGORY_LABEL: Record<AnnouncementCategory, string> = {
    feature: 'New feature',
    fix: 'Bug fix',
    change: 'Change',
};
