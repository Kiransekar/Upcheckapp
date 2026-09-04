import i18n from '../i18n';

/**
 * Date and time formatting for the app's CHOSEN language, not the device's.
 *
 * Two problems this fixes, both of which showed up as "the Simulations screen
 * errors in Tamil":
 *
 * 1. Every call site passed `undefined` as the locale, which means "use the
 *    device locale". React Native ships Hermes without an Intl polyfill here,
 *    and Hermes' built-in ICU data is not complete for every Indian locale — a
 *    `toLocaleDateString(undefined, { month: 'short' })` on a device set to
 *    Tamil can throw a RangeError and take the screen down with it. A screen
 *    must not be able to crash because of a phone's language setting.
 *
 * 2. It was the wrong locale anyway. Language is chosen inside the app
 *    (artboard 01, before anything else), so a farmer who picks Tamil on an
 *    English phone was reading Tamil labels next to English dates.
 *
 * Every formatter here falls back to a plain, locale-independent rendering if
 * Intl refuses. A slightly plainer date is always better than a blank screen.
 */

/** App language → BCP-47 tag. India is the only market at launch. */
const LOCALE_TAGS: Record<string, string> = {
    en: 'en-IN',
    hi: 'hi-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    bn: 'bn-IN',
    or: 'or-IN',
};

const currentTag = (): string => LOCALE_TAGS[i18n.language] ?? 'en-IN';

const MONTHS_FALLBACK = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const toDate = (value: string | number | Date): Date | null => {
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
};

/** "24 Aug" / "24 Aug 2026" — never throws. */
export const formatDate = (
    value: string | number | Date | null | undefined,
    options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
): string => {
    if (value == null) return '—';
    const d = toDate(value);
    if (!d) return '—';
    try {
        return d.toLocaleDateString(currentTag(), options);
    } catch {
        // Intl unavailable for this locale — plain, unambiguous, never localised.
        const day = d.getDate();
        const month = MONTHS_FALLBACK[d.getMonth()];
        return options.year ? `${day} ${month} ${d.getFullYear()}` : `${day} ${month}`;
    }
};

/** "05:48" — 24-hour, which is how a shift is written on a farm. Never throws. */
export const formatTime = (value: string | number | Date | null | undefined): string => {
    if (value == null) return '—';
    const d = toDate(value);
    if (!d) return '—';
    try {
        return d.toLocaleTimeString(currentTag(), {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    } catch {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
};

/** "Wed 25 Aug" — the day heading used by attendance history. Never throws. */
export const formatWeekday = (value: string | number | Date | null | undefined): string => {
    if (value == null) return '—';
    const d = toDate(value);
    if (!d) return '—';
    try {
        return d.toLocaleDateString(currentTag(), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
        });
    } catch {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `${days[d.getDay()]} ${d.getDate()} ${MONTHS_FALLBACK[d.getMonth()]}`;
    }
};

/** Grouped number for the chosen locale, e.g. 1,23,456 in en-IN. Never throws. */
export const formatNumber = (n: number): string => {
    try {
        return n.toLocaleString(currentTag());
    } catch {
        return String(Math.round(n));
    }
};

/**
 * "4 h" / "3 d" / "never" — how old a piece of data is, in the width of a chip.
 *
 * Floors rather than rounds: a reading 23.9 hours old is "23 h", not "1 d".
 * Rounding up would let a stale reading read fresher than it is, which is the
 * exact failure this whole feature exists to remove.
 *
 * A future timestamp clamps to "<1 h" rather than showing a negative age —
 * phone clocks drift and offline records carry client-minted times.
 */
export const formatAge = (
    value: string | number | Date | null | undefined,
    now: Date = new Date(),
): string => {
    if (value == null) return i18n.t('common.ageNever');
    const d = toDate(value);
    if (!d) return i18n.t('common.ageNever');

    const ms = Math.max(0, now.getTime() - d.getTime());
    const hours = Math.floor(ms / 3_600_000);
    if (hours < 1) return i18n.t('common.ageJustNow');
    if (hours < 24) return i18n.t('common.ageHours', { count: hours });
    return i18n.t('common.ageDays', { count: Math.floor(hours / 24) });
};
