import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';

export type AppButtonDefaults = {
  debounceMs?: number;
  enableAnimatedPress?: boolean;
  pressedScale?: number;
  enablePressedOverlay?: boolean;
  enableRipple?: boolean;
  loadingDelayMs?: number;
};

const AppButtonDefaultsContext = createContext<AppButtonDefaults | undefined>(undefined);

export function AppButtonDefaultsProvider({
  children,
  value,
}: PropsWithChildren<{ value?: AppButtonDefaults }>) {
  const memoizedValue = useMemo(
    () => value,
    [
      value?.debounceMs,
      value?.enableAnimatedPress,
      value?.pressedScale,
      value?.enablePressedOverlay,
      value?.enableRipple,
      value?.loadingDelayMs,
    ],
  );

  return (
    <AppButtonDefaultsContext.Provider value={memoizedValue}>
      {children}
    </AppButtonDefaultsContext.Provider>
  );
}

export function useAppButtonDefaults() {
  return useContext(AppButtonDefaultsContext);
}
