/**
 * Only English ships on the startup path; the other five locales arrive via
 * import() when they are actually needed.
 *
 * The three things that can go wrong here all reach a farmer directly:
 * a stored language that is not active by the time the first screen renders
 * (one frame of English, on a phone chosen in Tamil), a switch that repaints
 * before its strings land, and a chunk that fails to evaluate and leaves the
 * screen showing `home.title` instead of a sentence. One test each.
 */
const LANGUAGE_KEY = '@upcheck_language';

/**
 * Each case needs a FRESH module registry: src/i18n reads the stored language
 * once, at import time, and that is precisely the behaviour under test. A fresh
 * registry also hands the module its own copy of the AsyncStorage mock, so the
 * store is supplied here rather than shared — otherwise the test writes to one
 * device and the code reads from another.
 */
const freshI18n = (stored?: string, extraMocks?: () => void) => {
    const store: Record<string, string> = stored ? { [LANGUAGE_KEY]: stored } : {};
    let mod!: typeof import('../index');
    jest.isolateModules(() => {
        extraMocks?.();
        jest.doMock('@react-native-async-storage/async-storage', () => ({
            __esModule: true,
            default: {
                getItem: async (k: string) => store[k] ?? null,
                setItem: async (k: string, v: string) => { store[k] = v; },
            },
        }));
        mod = require('../index');
    });
    return { ...mod, store };
};

describe('lazy locale loading', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('boots with English only — no other locale is on the startup path', () => {
        const { default: i18n } = freshI18n();
        expect(i18n.hasResourceBundle('en', 'translation')).toBe(true);
        for (const lng of ['hi', 'ta', 'te', 'bn', 'or']) {
            expect(i18n.hasResourceBundle(lng, 'translation')).toBe(false);
        }
    });

    it('has the stored language loaded and active by the time the navigator stops waiting', async () => {
        const { default: i18n, hasChosenLanguage } = freshI18n('ta');

        // hasChosenLanguage() is the promise RootNavigator holds the splash on.
        expect(await hasChosenLanguage()).toBe(true);

        expect(i18n.language).toBe('ta');
        expect(i18n.hasResourceBundle('ta', 'translation')).toBe(true);
        // A real Tamil string, not the key and not the English one.
        expect(i18n.t('common.save')).not.toBe('common.save');
        expect(i18n.t('common.save')).not.toBe('Save');
    });

    it('loads the bundle before changeLanguage resolves, so nothing repaints untranslated', async () => {
        const { default: i18n, store } = freshI18n();
        expect(i18n.hasResourceBundle('bn', 'translation')).toBe(false);

        await i18n.changeLanguage('bn');

        expect(i18n.hasResourceBundle('bn', 'translation')).toBe(true);
        expect(i18n.t('common.save')).not.toBe('common.save');
        expect(store[LANGUAGE_KEY]).toBe('bn');
    });

    it('falls back to English, not to raw keys, when a locale chunk fails to load', async () => {
        // These bundles live in the JS bundle rather than on the network, so a
        // rejection here is a bundler/runtime fault — rare, and silent damage
        // if unhandled, which is exactly why it is pinned.
        const { default: i18n } = freshI18n(undefined, () => {
            jest.doMock('../locales/or', () => {
                throw new Error('chunk failed to evaluate');
            });
        });

        await expect(i18n.changeLanguage('or')).resolves.toBeDefined();

        expect(i18n.hasResourceBundle('or', 'translation')).toBe(false);
        // fallbackLng: 'en' answers instead — English copy, never the key.
        expect(i18n.t('common.save')).toBe('Save');
    });
});
