import type { ColorName, FontFamilyName, TextVariant, WeightName } from '@/themes';
import React, { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { TEXT_DEFAULTS } from './tokens';

export type AppTextDefaults = {
  colorName?: ColorName;
  textVariant?: TextVariant;
  family?: FontFamilyName;
  weight?: WeightName;
  mutedOpacity?: number;
};

const AppTextDefaultsContext = createContext<AppTextDefaults | undefined>(undefined);

export function AppTextProvider({
  value,
  children,
}: PropsWithChildren<{ value?: AppTextDefaults }>) {
  // Memoize with granular dependencies to prevent re-renders when value object reference changes
  const memoizedValue = useMemo(
    () => value,
    [value?.colorName, value?.textVariant, value?.family, value?.weight, value?.mutedOpacity],
  );

  return (
    <AppTextDefaultsContext.Provider value={memoizedValue}>
      {children}
    </AppTextDefaultsContext.Provider>
  );
}

AppTextProvider.displayName = 'AppTextProvider';

export function useTextDefaults() {
  const ctx = useContext(AppTextDefaultsContext);
  return {
    colorName: ctx?.colorName ?? TEXT_DEFAULTS.colorName,
    textVariant: ctx?.textVariant ?? TEXT_DEFAULTS.textVariant,
    family: ctx?.family,
    weight: ctx?.weight,
    mutedOpacity: ctx?.mutedOpacity ?? TEXT_DEFAULTS.mutedOpacity,
  } as const;
}
