import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { useColorScheme } from 'react-native';

import { darkTokens, lightTokens } from '@/themes';
import type { ThemeTokens } from '@/themes/types';

export type ThemeScheme = 'light' | 'dark';

type ThemeContextValue = {
  /** The scheme actually being rendered — always the device's own setting. */
  scheme: ThemeScheme;
  tokens: ThemeTokens;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Appearance always follows the OS — there is no in-app light/dark picker.
 * `scheme` lets tests and previews force an appearance without touching the
 * device setting; production call sites never pass it.
 */
export function ThemeProvider({ children, scheme }: PropsWithChildren<{ scheme?: ThemeScheme }>) {
  const deviceScheme = useColorScheme();
  const resolvedScheme: ThemeScheme = scheme ?? (deviceScheme === 'dark' ? 'dark' : 'light');

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme: resolvedScheme,
      tokens: resolvedScheme === 'dark' ? darkTokens : lightTokens,
    }),
    [resolvedScheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeContext(): ThemeContextValue {
  const context = useContext(ThemeContext);
  const deviceScheme = useColorScheme();
  const fallbackScheme: ThemeScheme = deviceScheme === 'dark' ? 'dark' : 'light';

  return (
    context ?? {
      scheme: fallbackScheme,
      tokens: fallbackScheme === 'dark' ? darkTokens : lightTokens,
    }
  );
}
