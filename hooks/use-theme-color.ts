import { useMemo } from 'react';

import { useThemeContext } from '@/contexts/theme.context';
import type { ColorName } from '@/themes';

export function useThemeColor(props: { light?: string; dark?: string }, colorName: ColorName) {
  const { scheme, tokens } = useThemeContext();

  return useMemo(() => {
    const explicit = scheme === 'light' ? props.light : props.dark;
    return explicit ?? tokens[colorName];
  }, [colorName, props.dark, props.light, scheme, tokens]);
}
