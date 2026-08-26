import type { PublicUser } from '../api/farmMembers';

/**
 * How a person is named anywhere their record is shown.
 *
 * Every screen that lists people was deriving this itself, and each one ended
 * at `userId.slice(0, 8)` when the user object was missing — which is how the
 * leave queue came to show a farmer a raw uuid fragment where a colleague's
 * name should be. One helper so the fallback chain is decided once.
 *
 * The last resort is a WORD, never an id. A truncated uuid is not a name, it
 * is a leak of an internal identifier into a farmer's screen, and it tells them
 * nothing about who is asking for leave.
 */
export const personName = (
    user: PublicUser | null | undefined,
    unknownLabel = 'Unknown',
): string => {
    if (!user) return unknownLabel;
    const full = [user.firstName, user.lastName]
        .map((p) => (typeof p === 'string' ? p.trim() : ''))
        .filter(Boolean)
        .join(' ');
    return full || user.username?.trim() || unknownLabel;
};

/** Initials for an avatar chip — "Ravi Kumar" → "RK". */
export const personInitials = (
    user: PublicUser | null | undefined,
    fallback = '?',
): string => {
    const name = personName(user, '');
    if (!name) return fallback;
    const words = name.split(/\s+/).filter(Boolean);
    return ((words[0]?.[0] ?? '') + (words[1]?.[0] ?? '')).toUpperCase() || fallback;
};
