/**
 * Every t('…') key used in the app must exist in English.
 *
 * localeParity.test.ts compares the six locales AGAINST EACH OTHER, so it is
 * blind to a key that is missing from all of them equally — and that is
 * precisely what shipped: MemberDetailScreen called `members.transferCta`,
 * `members.transferTitle`, `members.transferConfirm` and `members.transferError`,
 * none of which existed in any locale. Parity passed. The farmer saw the raw
 * string `members.transferCta` rendered as the label of the button that hands
 * their farm to someone else.
 *
 * There is no fallback to rescue this: src/i18n/index.ts sets `fallbackLng: 'en'`,
 * so a key absent from English resolves to the key itself, in every language.
 *
 * Only STATIC keys are checkable. `t(\`ponds.${kind}\`)` is skipped by design —
 * this guards the common case cheaply rather than trying to be a type system.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import en from '../locales/en';

const SRC = join(__dirname, '..', '..');

/**
 * Ratchet, not a target. Lower it when keys get translated; never raise it.
 * ponytail: a flat count, not a named allowlist — cheap, and it still stops
 * the number growing. Swap for an explicit list if the backlog is ever
 * worked down deliberately rather than opportunistically.
 */
const KNOWN_DEFAULTED_BACKLOG = 63;

/** Every .ts/.tsx file under src/, excluding tests and the locale bundles. */
const sourceFiles = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
            // `i18n/` is the machinery itself — its comments quote example
            // keys (`t('auth.login')`), which are documentation, not lookups.
            if (['__tests__', 'node_modules', 'locales', 'i18n'].includes(name)) return [];
            return sourceFiles(full);
        }
        return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });

/**
 * Static single-quoted or double-quoted first argument to t(…) / i18n.t(…),
 * plus whatever follows it, so we can tell the two failure modes apart.
 * A backtick argument is a template literal — dynamic, deliberately not matched.
 *
 * i18next accepts a DEFAULT VALUE two ways, and both count:
 *   t('common.savedOffline', 'Saved — will sync when online')
 *   t('logs.feedingTray_tray', { n, defaultValue: `Tray ${n}` })
 * A key missing from `en` but carrying a default still renders that English
 * default. That is a localisation hole — a Hindi-speaking farmer reads English
 * — but it is not the same defect as rendering the raw key, so the two are
 * counted separately and only the raw-key case fails the build.
 */
const T_CALL = /\bt\(\s*(['"])([A-Za-z0-9_.]+)\1\s*(,[\s\S]{0,160})?/g;

/** Does the text following the key supply a default value? */
const hasDefault = (rest: string | undefined): boolean =>
    !!rest && (/^,\s*['"`]/.test(rest) || /^,\s*\{[\s\S]*?defaultValue/.test(rest));

/** True if the dotted path resolves to anything in the English bundle. */
const resolves = (key: string): boolean => {
    // i18next serves `key_one`/`key_other` from a bare `key`, and vice versa.
    const candidates = [key, `${key}_one`, `${key}_other`];
    return candidates.some((candidate) =>
        candidate.split('.').reduce<unknown>(
            (node, part) =>
                node && typeof node === 'object'
                    ? (node as Record<string, unknown>)[part]
                    : undefined,
            en,
        ) !== undefined,
    );
};

describe('t() keys used in source', () => {
    /** Missing from `en` AND with no default — renders the raw key. A bug. */
    const rawKeyOnScreen: string[] = [];
    /** Missing from `en` but defaulted — renders English in every language. */
    const englishOnlyFallback = new Set<string>();

    for (const file of sourceFiles(SRC)) {
        const text = readFileSync(file, 'utf8');
        for (const [, , key, rest] of text.matchAll(T_CALL)) {
            // A bare word with no dot is almost always a local helper called
            // `t`, not a translation lookup.
            if (!key.includes('.')) continue;
            if (resolves(key)) continue;
            if (hasDefault(rest)) englishOnlyFallback.add(key);
            else rawKeyOnScreen.push(`${key}  (${file.slice(SRC.length + 1)})`);
        }
    }

    it('never renders a raw key — the key exists in en, or carries a default', () => {
        expect([...new Set(rawKeyOnScreen)].sort()).toEqual([]);
    });

    /**
     * These resolve to their English default in Hindi, Bengali, Tamil, Telugu
     * and Odia alike. Untranslated, but not broken — tracked so the number
     * cannot quietly grow while nobody is looking.
     */
    it('has no MORE untranslated-but-defaulted keys than the known backlog', () => {
        expect(englishOnlyFallback.size).toBeLessThanOrEqual(KNOWN_DEFAULTED_BACKLOG);
    });
});
