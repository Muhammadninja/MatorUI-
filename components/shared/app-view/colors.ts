import { useThemeContext } from '@/contexts/theme.context';
import type { ColorName } from '@/themes';
import { useMemo } from 'react';

/**
 * Resolve background color with precedence:
 * 1) Explicit per-theme color (light/dark)
 * 2) Theme token via colorName
 * 3) undefined (no background)
 */
export function useResolvedBackgroundColor(params: {
  lightColor?: string;
  darkColor?: string;
  colorName?: ColorName;
}) {
  const { scheme, tokens } = useThemeContext();
  const { lightColor, darkColor, colorName } = params;
  return useMemo(() => {
    const explicit = scheme === 'light' ? lightColor : darkColor;
    if (explicit) return explicit;
    if (colorName) return tokens[colorName];
    return undefined;
  }, [scheme, lightColor, darkColor, colorName, tokens]);
}

/**
 * Resolve a tokenized color by name for current scheme, or undefined.
 */
export function useColorToken(name?: ColorName) {
  const { tokens } = useThemeContext();
  return useMemo(() => (name ? tokens[name] : undefined), [name, tokens]);
}
