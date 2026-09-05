import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en';
import { LANGUAGE_CODES } from './languages';

const LANGUAGE_KEY = '@upcheck_language';

// Only English is bundled eagerly. The other five locales are ~1.7 MB of the
// JS bundle between the launcher tap and the first pixel, and a farmer uses
// exactly one of them — so they are `import()`ed on demand and handed to
// i18next with addResourceBundle. English stays eager because `fallbackLng`
// resolves against whatever is loaded: it is both the default and the safety
// net, and a net that has to be fetched is not a net.
//
// Each language aggregator is a namespaced object ({ common, auth, home, … })
// exposed as the single `translation` namespace, so callers use nested keys
// like t('auth.login') or t('common.save').
i18n
  .use(initReactI18next)
  .init({
    resources: { en: { translation: en } },
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });

// require() inside a function body, not import(): Metro keeps the module in the
// bundle either way but only evaluates it when the call runs, which is the
// whole point — and unlike import(), it also works under jest-expo, which
// leaves import() native and therefore always-rejecting. Literal paths, not a
// computed one; a bundler can only see a dependency it can read.
const LOADERS: Record<string, () => { default: object }> = {
  hi: () => require('./locales/hi'),
  ta: () => require('./locales/ta'),
  te: () => require('./locales/te'),
  bn: () => require('./locales/bn'),
  or: () => require('./locales/or'),
};

/**
 * Make `lng` renderable. Resolves once its strings are in i18next — or, if the
 * chunk fails to evaluate, resolves anyway with the bundle still absent, which
 * leaves `fallbackLng: 'en'` to answer every key. That is the whole failure
 * story: English copy, never raw `home.title` on a farmer's screen.
 */
export const loadLocale = async (lng?: string | null): Promise<void> => {
  const load = lng ? LOADERS[lng] : undefined;
  if (!load || i18n.hasResourceBundle(lng!, 'translation')) return;
  try {
    i18n.addResourceBundle(lng!, 'translation', load().default, true, true);
  } catch {
    /* fall through to English via fallbackLng */
  }
};

// Persist every language switch — and load the strings BEFORE switching, so no
// screen re-renders against a language whose bundle has not arrived yet.
const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng, callback) => {
  await loadLocale(lng);
  const result = await originalChangeLanguage(lng, callback);
  if (lng) {
    AsyncStorage.setItem(LANGUAGE_KEY, lng).catch(() => {});
  }
  return result;
};

// Restore the persisted language preference (only if supported). Kept as a
// module-level promise so hasChosenLanguage() — which the navigator already
// awaits before it renders anything — can wait on it, rather than adding a
// second place for the app to block on startup.
const restored = AsyncStorage.getItem(LANGUAGE_KEY)
  .then((lang) => {
    if (lang && LANGUAGE_CODES.includes(lang) && lang !== i18n.language) {
      return i18n.changeLanguage(lang);
    }
  })
  .catch(() => {
    /* stay on default language */
  });

/**
 * Has this device ever chosen a language? The first-run flow opens on the
 * language screen (artboard 01) and must not reappear afterwards, and this
 * already-persisted preference is the only record that needs to exist — a
 * separate "seen it" flag would be a second source of truth for one fact.
 * Resolves false on a storage error, so a broken read shows the picker rather
 * than silently locking someone into the device locale.
 *
 * It also resolves only once the stored language's strings are loaded. The
 * navigator holds the splash on this promise already, and that is the single
 * gate a farmer who chose Tamil needs: no frame of English before it opens.
 */
export const hasChosenLanguage = async (): Promise<boolean> => {
  await restored;
  try {
    const lang = await AsyncStorage.getItem(LANGUAGE_KEY);
    return !!lang && LANGUAGE_CODES.includes(lang);
  } catch {
    return false;
  }
};

export default i18n;
