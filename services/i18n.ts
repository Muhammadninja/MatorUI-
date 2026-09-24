// Hermes ships Intl without `Intl.PluralRules`, so i18next falls back to a
// dummy one/other rule: Russian `_few` / `_many` never resolve and every count
// but 1 silently falls through to English ("3 parts" under a Russian UI). The
// polyfill installs a CLDR-complete implementation (and no-ops on engines that
// already have a real one), so it MUST be imported before i18next initializes.
import 'intl-pluralrules';

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
 *
 * Pluralization is CLDR-driven (`compatibilityJSON: 'v4'`): Russian keys need
 * `_one` / `_few` / `_many` (+ `_other` for non-integer counts), English and
 * Uzbek need `_one` / `_other`. A missing form falls back to `FALLBACK_LANGUAGE`,
 * which surfaces as English text inside an otherwise translated screen.
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
} else {
  // Fast Refresh path.
  //
  // Editing a locale file re-evaluates THIS module with the new JSON, but the
  // i18next instance is a module singleton that survives the refresh — so the
  // guard above skips `init()` and the fresh resources are never installed.
  // The app keeps serving the bundle captured at startup, and any key added
  // since then renders as its raw id (`garage.emptyPickLead`) until the whole
  // process restarts.
  //
  // Push the new bundles in explicitly instead. `deep` merges so untouched
  // namespaces survive, `overwrite` lets an edited string actually replace the
  // old one. Production never reaches this branch: the module is evaluated
  // exactly once there.
  for (const [lng, translation] of [
    ['en', en],
    ['ru', ru],
    ['uz', uz],
  ] as const) {
    i18n.addResourceBundle(lng, 'translation', translation, true, true);
  }
}

/** Switch the active language. Safe to call before init completes. */
export function changeAppLanguage(code: LanguageCode): Promise<unknown> {
  return i18n.changeLanguage(code);
}

export default i18n;
