import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const ROW_HEIGHT = 124;
const ROW_COUNT = 5;

/**
 * Skeleton for the order-history list. Mirrors the loaded layout (icon +
 * id row, divider, status + total row) so the skeleton → success
 * transition doesn't jolt the user.
 *
 * Same pulse + native-driver pattern as `GarageSkeleton`.
 */
export default function OrderRowSkeleton({ count = ROW_COUNT }: { count?: number }) {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const baseColor = isDark ? tokens.gray200 : tokens.gray100;
  const highlightColor = isDark ? tokens.gray300 : tokens.gray200;

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });

  const cardShell = {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: isDark ? tokens.card : tokens.white,
  } as const;

  return (
    <AppView px="lg" gap="md">
      {Array.from({ length: count }).map((_, i) => (
        <Animated.View key={i} style={{ opacity, height: ROW_HEIGHT, padding: 16, ...cardShell }}>
          <AppView row align="center" justify="space-between">
            <AppView row align="center" gap="sm">
              <AppView
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 8,
                  backgroundColor: highlightColor,
                }}
              />
              <AppView gap="xs">
                <AppView
                  style={{
                    height: 12,
                    width: 96,
                    borderRadius: 6,
                    backgroundColor: highlightColor,
                  }}
                />
                <AppView
                  style={{ height: 10, width: 64, borderRadius: 6, backgroundColor: baseColor }}
                />
              </AppView>
            </AppView>
          </AppView>
          <AppView
            style={{
              height: 1,
              backgroundColor: tokens.divider,
              marginVertical: 12,
            }}
          />
          <AppView row align="center" justify="space-between">
            <AppView gap="xs">
              <AppView
                style={{ height: 10, width: 140, borderRadius: 6, backgroundColor: baseColor }}
              />
              <AppView
                style={{
                  height: 12,
                  width: 70,
                  borderRadius: 6,
                  backgroundColor: highlightColor,
                }}
              />
            </AppView>
            <AppView
              style={{ height: 14, width: 64, borderRadius: 6, backgroundColor: highlightColor }}
            />
          </AppView>
        </Animated.View>
      ))}
    </AppView>
  );
}
