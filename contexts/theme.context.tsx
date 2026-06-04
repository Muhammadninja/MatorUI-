import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';

import { darkTokens, lightTokens } from '@/themes';
import type { ThemeTokens } from '@/themes/types';

export type ThemeScheme = 'light' | 'dark';

type ThemeContextValue = {
  scheme: ThemeScheme;
  tokens: ThemeTokens;
  setScheme: (scheme: ThemeScheme) => void;
  toggleScheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children, scheme }: PropsWithChildren<{ scheme?: ThemeScheme }>) {
  const deviceScheme = useColorScheme();
  const [manualScheme, setManualScheme] = useState<ThemeScheme | undefined>(scheme);
  const resolvedScheme: ThemeScheme = manualScheme ?? (deviceScheme === 'dark' ? 'dark' : 'light');

  const setScheme = useCallback((nextScheme: ThemeScheme) => {
    setManualScheme(nextScheme);
  }, []);

  const toggleScheme = useCallback(() => {
    setManualScheme((currentScheme) => {
      const baseScheme = currentScheme ?? (deviceScheme === 'dark' ? 'dark' : 'light');
      return baseScheme === 'dark' ? 'light' : 'dark';
    });
  }, [deviceScheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme: resolvedScheme,
      tokens: resolvedScheme === 'dark' ? darkTokens : lightTokens,
      setScheme,
      toggleScheme,
    }),
    [resolvedScheme, setScheme, toggleScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  const deviceScheme = useColorScheme();
  const fallbackScheme: ThemeScheme = deviceScheme === 'dark' ? 'dark' : 'light';
  const fallbackSetScheme = () => undefined;
  const fallbackToggleScheme = () => undefined;

  return (
    context ?? {
      scheme: fallbackScheme,
      tokens: fallbackScheme === 'dark' ? darkTokens : lightTokens,
      setScheme: fallbackSetScheme,
      toggleScheme: fallbackToggleScheme,
    }
  );
}
