import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import { changeAppLanguage, SUPPORTED_LANGUAGES } from '@/services/i18n';
import {
  loadLanguage,
  saveLanguage,
  type LanguageCode,
} from '@/services/language-storage';

export type { LanguageCode };

/**
 * Best-effort device-locale guess, constrained to a language we ship.
 * Uses Hermes' built-in `Intl` (no native module) so it works in the current
 * dev client without a rebuild. Falls back to the default if Intl is
 * unavailable or the device language isn't one we support.
 */
function detectDeviceLanguage(): LanguageCode {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale; // e.g. "ru-RU"
    const tag = locale?.split('-')[0]?.toLowerCase();
    if (tag && (SUPPORTED_LANGUAGES as string[]).includes(tag)) {
      return tag as LanguageCode;
    }
  } catch {
    // Intl missing/disabled — fall through to the default.
  }
  return DEFAULT_LANGUAGE;
}

export type LanguageOption = {
  code: LanguageCode;
  /** Native rendering of the language name (own script). */
  nativeName: string;
  /** Latin name for the row subtitle. */
  englishName: string;
  /** Country flag emoji rendered in the picker icon medallion. */
  flag: string;
};

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', nativeName: 'English', englishName: 'English', flag: '🇬🇧' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', flag: '🇷🇺' },
  { code: 'uz', nativeName: 'Oʻzbekcha', englishName: 'Uzbek', flag: '🇺🇿' },
];

type LanguageContextValue = {
  language: LanguageCode;
  /** Native label of the current language, ready for UI rendering. */
  languageLabel: string;
  /** True once we've finished reading the persisted choice on first
   *  mount. Splash gating waits on this so we don't flash a wrong UI. */
  isHydrated: boolean;
  /** True once the user has actively picked a language at least once.
   *  Drives the splash-to-language-picker redirect. */
  hasChosen: boolean;
  /** Update the language. Persists to disk in the background. */
  setLanguage: (code: LanguageCode) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);

const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<LanguageCode>(DEFAULT_LANGUAGE);
  const [hasChosen, setHasChosen] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLanguage()
      .then((stored) => {
        if (cancelled) return;
        if (stored) {
          setLanguageState(stored);
          setHasChosen(true);
          void changeAppLanguage(stored);
        } else {
          // No saved choice yet — preview the device language in the UI
          // (still not "chosen", so onboarding picker is shown).
          const guess = detectDeviceLanguage();
          setLanguageState(guess);
          void changeAppLanguage(guess);
        }
      })
      .catch((err) => {
        // Storage read failed — fall back to the default language so the
        // splash still hides and the app boots instead of hanging forever.
        if (__DEV__) {
          console.warn('[language] failed to load persisted language', err);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setIsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (code: LanguageCode) => {
    setLanguageState(code);
    setHasChosen(true);
    await changeAppLanguage(code);
    await saveLanguage(code);
  }, []);

  const languageLabel = useMemo(
    () => LANGUAGE_OPTIONS.find((o) => o.code === language)?.nativeName ?? 'English',
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      languageLabel,
      isHydrated,
      hasChosen,
      setLanguage,
    }),
    [language, languageLabel, isHydrated, hasChosen, setLanguage],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguageContext() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguageContext must be used within a LanguageProvider');
  }
  return context;
}
