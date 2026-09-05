/**
 * The one place the "what's new" vocabulary is written down — mirrors
 * `feedback-status.ts` for the same reason: one source of truth the DTOs,
 * the service and (via its own copy, since it's a separate deploy) the admin
 * dashboard all read from.
 */

/**
 * Six locales the app ships. `en` is mandatory on every announcement — it is
 * stored on the announcement row itself, not the translation sidecar — and
 * every other locale falls back to it when a translation is missing rather
 * than showing an empty card. Keep this list in step with the frontend's
 * i18n locales and `admin/src/lib/announcements.ts`.
 */
export const ANNOUNCEMENT_LOCALES = ['en', 'hi', 'bn', 'ta', 'te', 'or'] as const;
export type AnnouncementLocale = (typeof ANNOUNCEMENT_LOCALES)[number];

/** Locales that live in the translation sidecar. English lives on the row. */
export const TRANSLATABLE_LOCALES = ANNOUNCEMENT_LOCALES.filter(
  (l) => l !== 'en',
) as Exclude<AnnouncementLocale, 'en'>[];

/**
 * What kind of change this is, per the owner's own words: "a feature is
 * launched, or a bug is fixed or something is moved". Three broad buckets,
 * not a taxonomy — this is a badge on a card, not a ticket system.
 */
export const ANNOUNCEMENT_CATEGORIES = ['feature', 'fix', 'change'] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];
