import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en';
import hi from './locales/hi';
import ta from './locales/ta';
import te from './locales/te';
import bn from './locales/bn';
import or from './locales/or';
import { LANGUAGE_CODES } from './languages';

const LANGUAGE_KEY = '@upcheck_language';

// Each language aggregator is a namespaced object ({ common, auth, home, … })
// exposed as the single `translation` namespace, so callers use nested keys
// like t('auth.login') or t('common.save').
const resources = {
  en: { translation: en },
  hi: { translation: hi },
  ta: { translation: ta },
  te: { translation: te },
  bn: { translation: bn },
  or: { translation: or },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'en',
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    compatibilityJSON: 'v4',
  });

// Restore the persisted language preference (only if supported).
AsyncStorage.getItem(LANGUAGE_KEY)
  .then((lang) => {
    if (lang && LANGUAGE_CODES.includes(lang) && lang !== i18n.language) {
      i18n.changeLanguage(lang);
    }
  })
  .catch(() => {
    /* stay on default language */
  });

// Persist every language switch.
const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng, callback) => {
  const result = await originalChangeLanguage(lng, callback);
  if (lng) {
    AsyncStorage.setItem(LANGUAGE_KEY, lng).catch(() => {});
  }
  return result;
};

/**
 * Has this device ever chosen a language? The first-run flow opens on the
 * language screen (artboard 01) and must not reappear afterwards, and this
 * already-persisted preference is the only record that needs to exist — a
 * separate "seen it" flag would be a second source of truth for one fact.
 * Resolves false on a storage error, so a broken read shows the picker rather
 * than silently locking someone into the device locale.
 */
export const hasChosenLanguage = async (): Promise<boolean> => {
  try {
    const lang = await AsyncStorage.getItem(LANGUAGE_KEY);
    return !!lang && LANGUAGE_CODES.includes(lang);
  } catch {
    return false;
  }
};

export default i18n;
