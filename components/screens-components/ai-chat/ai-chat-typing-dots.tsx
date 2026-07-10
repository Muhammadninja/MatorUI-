import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Three-dot typing indicator. Used inside an assistant bubble while the
 * streaming response is in flight. The dots cycle through opacity with a
 * 200ms offset so the row reads as a wave, not a flicker.
 */
export default function AiChatTypingDots() {
  const { tokens } = useThemeContext();
  const dot1 = useRef(new Animated.Value(0.3)).current;
  const dot2 = useRef(new Animated.Value(0.3)).current;
  const dot3 = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    function loop(value: Animated.Value, delay: number) {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(value, {
            toValue: 1,
            duration: 320,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.3,
            duration: 320,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
      );
    }
    const a = loop(dot1, 0);
    const b = loop(dot2, 200);
    const c = loop(dot3, 400);
    a.start();
    b.start();
    c.start();
    return () => {
      a.stop();
      b.stop();
      c.stop();
    };
  }, [dot1, dot2, dot3]);

  const dotStyle = {
    width: 6,
    height: 6,
    borderRadius: 999,
    backgroundColor: tokens.gray400,
  };

  return (
    <AppView row align="center" gap="xs" style={{ paddingVertical: 4 }}>
      <Animated.View style={[dotStyle, { opacity: dot1 }]} />
      <Animated.View style={[dotStyle, { opacity: dot2 }]} />
      <Animated.View style={[dotStyle, { opacity: dot3 }]} />
    </AppView>
  );
}
