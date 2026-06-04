import { useCallback, useRef } from 'react';
import { Animated, type ViewStyle } from 'react-native';

export function usePressAnimation({
  enabled,
  pressedScale = 0.98,
}: {
  enabled?: boolean;
  pressedScale?: number;
}) {
  const scale = useRef(new Animated.Value(1)).current;
  const onPressIn = useCallback(() => {
    if (!enabled) return;
    Animated.spring(scale, {
      toValue: pressedScale,
      useNativeDriver: true,
      speed: 24,
      bounciness: 0,
    }).start();
  }, [enabled, pressedScale, scale]);
  const onPressOut = useCallback(() => {
    if (!enabled) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 24, bounciness: 0 }).start();
  }, [enabled, scale]);

  const animatedContainerStyle = enabled ? ({ transform: [{ scale }] } as ViewStyle) : undefined;
  return { animatedContainerStyle, onPressIn, onPressOut };
}
