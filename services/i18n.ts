import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';

import type { LanguageCode } from '@/services/language-storage';

/**
 * Central i18next instance. Resource files live in `@/locales/*.json` and
 * are the single source of truth for every user-facing string — they are
 * also what the TMS (Tolgee/Crowdin) pushes to and pulls from.
 *
 * The active language is owned by `language.context.tsx`; it calls
 * `changeAppLanguage()` on hydration and on every user switch. We init
 * synchronously (resources are bundled, no network) so the first render
 * already has strings.
 */

export const SUPPORTED_LANGUAGES: LanguageCode[] = ['en', 'ru', 'uz'];
export const FALLBACK_LANGUAGE: LanguageCode = 'en';

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      uz: { translation: uz },
    },
    lng: FALLBACK_LANGUAGE,
    fallbackLng: FALLBACK_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,
    // React already escapes on render — double-escaping would corrupt
    // interpolated values (e.g. names with quotes).
    interpolation: { escapeValue: false },
    returnNull: false,
    compatibilityJSON: 'v4',
    // Resources are bundled, so init is synchronous and `ready` is true on
    // first render. Disabling suspense removes any window where a component
    // could render the raw key while waiting on an (already-complete) init.
    react: { useSuspense: false },
  });
}

/** Switch the active language. Safe to call before init completes. */
export function changeAppLanguage(code: LanguageCode): Promise<unknown> {
  return i18n.changeLanguage(code);
}

export default i18n;
