import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  loadThemePreference,
  saveThemePreference,
  type ThemePreference,
} from '@/services/theme-storage';
import { darkTokens, lightTokens } from '@/themes';
import type { ThemeTokens } from '@/themes/types';

export type ThemeScheme = 'light' | 'dark';
export type { ThemePreference };

type ThemeContextValue = {
  /** The scheme actually being rendered (device scheme when preference is 'system'). */
  scheme: ThemeScheme;
  tokens: ThemeTokens;
  /** What the user picked. 'system' = follow the phone. */
  preference: ThemePreference;
  /** True once the persisted choice has been read from disk. */
  isHydrated: boolean;
  /** Pick an appearance. Persists locally (AsyncStorage) in the background. */
  setPreference: (preference: ThemePreference) => void;
  setScheme: (scheme: ThemeScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children, scheme }: PropsWithChildren<{ scheme?: ThemeScheme }>) {
  const deviceScheme = useColorScheme();
  // An explicit `scheme` prop (tests, previews) forces the appearance and
  // opts out of the persisted choice.
  const [preference, setPreferenceState] = useState<ThemePreference>(scheme ?? 'system');
  const [isHydrated, setIsHydrated] = useState(false);

  // Read the stored pick once at boot. Purely local — no account, token or
  // network involved — so guests keep their theme across restarts too.
  useEffect(() => {
    if (scheme) {
      setIsHydrated(true);
      return;
    }
    let cancelled = false;
    loadThemePreference()
      .then((stored) => {
        if (cancelled || !stored) return;
        setPreferenceState(stored);
      })
      .catch((err) => {
        // Storage read failed — stay on 'system' rather than blocking boot.
        if (__DEV__) {
          console.warn('[theme] failed to load persisted theme preference', err);
        }
      })
      .finally(() => {
        if (cancelled) return;
        setIsHydrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [scheme]);

  const resolvedScheme: ThemeScheme =
    preference === 'system' ? (deviceScheme === 'dark' ? 'dark' : 'light') : preference;

  const setPreference = useCallback((nextPreference: ThemePreference) => {
    setPreferenceState(nextPreference);
    void saveThemePreference(nextPreference);
  }, []);

  const setScheme = useCallback(
    (nextScheme: ThemeScheme) => {
      setPreference(nextScheme);
    },
    [setPreference],
  );

  const toggleScheme = useCallback(() => {
    setPreference(resolvedScheme === 'dark' ? 'light' : 'dark');
  }, [resolvedScheme, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme: resolvedScheme,
      tokens: resolvedScheme === 'dark' ? darkTokens : lightTokens,
      preference,
      isHydrated,
      setPreference,
      setScheme,
      toggleScheme,
    }),
    [resolvedScheme, preference, isHydrated, setPreference, setScheme, toggleScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  const deviceScheme = useColorScheme();
  const fallbackScheme: ThemeScheme = deviceScheme === 'dark' ? 'dark' : 'light';
  const noop = () => undefined;

  return (
    context ?? {
      scheme: fallbackScheme,
      tokens: fallbackScheme === 'dark' ? darkTokens : lightTokens,
      preference: 'system',
      isHydrated: false,
      setPreference: noop,
      setScheme: noop,
      toggleScheme: noop,
    }
  );
}
