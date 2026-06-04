import { useAppButtonDefaults } from '@/contexts/app-button.context';
import { useMemo } from 'react';
import type { AppButtonProps } from './app-button';

export function useButtonDefaults(props: AppButtonProps) {
  const defaults = useAppButtonDefaults();
  return useMemo(() => {
    return {
      effectiveDebounce: props.debounceMs ?? defaults?.debounceMs,
      effectiveAnimatedPress: props.enableAnimatedPress ?? defaults?.enableAnimatedPress ?? false,
      effectivePressedScale: props.pressedScale ?? defaults?.pressedScale ?? 0.98,
      effectivePressedOverlay: props.enablePressedOverlay ?? defaults?.enablePressedOverlay ?? true,
      effectiveRipple: props.enableRipple ?? defaults?.enableRipple ?? true,
      effectiveLoadingDelay: props.loadingDelayMs ?? defaults?.loadingDelayMs ?? 0,
    } as const;
  }, [
    defaults,
    props.debounceMs,
    props.enableAnimatedPress,
    props.pressedScale,
    props.enablePressedOverlay,
    props.enableRipple,
    props.loadingDelayMs,
  ]);
}
