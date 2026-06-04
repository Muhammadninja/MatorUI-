import { triggerHaptic, type HapticKind } from '@/utils/haptics';
import { useCallback, useRef } from 'react';
import type { GestureResponderEvent } from 'react-native';

export function useDebouncedPress({
  debounceMs,
  disabled,
  loading,
  haptics,
  onPress,
}: {
  debounceMs?: number;
  disabled?: boolean;
  loading?: boolean;
  haptics?: HapticKind;
  onPress?: (e: GestureResponderEvent) => void;
}) {
  const last = useRef(0);
  return useCallback(
    (e: GestureResponderEvent) => {
      if (disabled || loading) return;
      const now = Date.now();
      if (debounceMs && now - last.current < debounceMs) return;
      last.current = now;
      triggerHaptic(haptics ?? false);
      onPress?.(e);
    },
    [debounceMs, disabled, loading, haptics, onPress],
  );
}
