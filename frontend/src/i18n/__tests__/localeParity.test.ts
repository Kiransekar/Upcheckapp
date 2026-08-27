/**
 * Every locale must expose the same keys as English.
 *
 * The app crashed on the Simulations screen in Tamil. A missing key is not a
 * cosmetic problem here: screens index into nested namespaces
 * (`simulations.q.<scenario>.title`), so an absent PARENT object makes the
 * lookup read a property of undefined and takes the screen down — in one
 * language only, which is exactly the kind of thing that reaches a farmer
 * before it reaches a developer.
 *
 * This also guards the insertion tooling. Keys have been appended to these
 * files by script, and one such run put a block inside `hub.dailyFeed` instead
 * of the top-level `dailyFeed` because both exist at different depths. A
 * structural diff catches that class of mistake; a spot check does not.
 */
import en from '../locales/en';
import hi from '../locales/hi';
import ta from '../locales/ta';
import te from '../locales/te';
import bn from '../locales/bn';
import or from '../locales/or';

const LOCALES = { hi, ta, te, bn, or } as const;

/** Every leaf path in a nested translation object. */
const leafKeys = (obj: unknown, prefix = ''): string[] => {
    if (!obj || typeof obj !== 'object') return [prefix];
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
        const path = prefix ? `${prefix}.${k}` : k;
        return v && typeof v === 'object' && !Array.isArray(v) ? leafKeys(v, path) : [path];
    });
};

/**
 * i18next resolves `key_one` / `key_other` from a bare `key`, so a locale is
 * not required to carry the same plural suffixes English does.
 */
const stripPluralSuffix = (k: string) => k.replace(/_(one|other|two|few|many|zero)$/, '');

const englishKeys = new Set(leafKeys(en).map(stripPluralSuffix));

describe.each(Object.entries(LOCALES))('%s matches the English key set', (name, locale) => {
    const localeKeys = new Set(leafKeys(locale).map(stripPluralSuffix));

    it('is missing no key that English has', () => {
        const missing = [...englishKeys].filter((k) => !localeKeys.has(k));
        expect(missing).toEqual([]);
    });

    it('has no key English does not — usually a block inserted at the wrong depth', () => {
        const extra = [...localeKeys].filter((k) => !englishKeys.has(k));
        expect(extra).toEqual([]);
    });
});

describe('nested namespaces the screens index into are whole', () => {
    // These are read as `t(`simulations.q.${scenarioType}.title`)` and similar.
    // A missing intermediate object is a crash, not a fallback.
    const REQUIRED_BRANCHES: [string, string[]][] = [
        ['simulations.q', ['feed_change', 'price_change', 'stocking_density']],
    ];

    it.each(Object.entries(LOCALES))('%s has every simulation scenario branch', (name, locale) => {
        for (const [branch, children] of REQUIRED_BRANCHES) {
            const node = branch
                .split('.')
                .reduce<any>((acc, part) => (acc == null ? acc : acc[part]), locale);
            expect(node).toBeDefined();
            for (const child of children) {
                expect(node?.[child]?.title).toBeTruthy();
                expect(node?.[child]?.desc).toBeTruthy();
            }
        }
    });
});
