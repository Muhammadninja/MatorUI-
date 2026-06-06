import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/**
 * Shimmer placeholder that matches the geometry of `SearchResultRow`
 * (thumbnail + title bar + description bar + price bar + chevron slot).
 * Use multiple instances stacked for a believable "results are coming"
 * effect — most search-result UIs render 4-6 skeleton rows.
 */
export default function SearchResultSkeleton() {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';

  const baseColor = isDark ? tokens.gray200 : tokens.gray100;
  const highlightColor = isDark ? tokens.gray300 : tokens.gray200;

  // Pulse the row opacity 1 → 0.55 → 1 with a slow ease so the skeleton
  // feels "alive" without being distracting. useNativeDriver keeps the
  // animation off the JS thread.
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
    return () => {
      loop.stop();
    };
  }, [pulse]);

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.55],
  });

  return (
    <Animated.View
      style={{
        opacity,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: isDark ? tokens.border : tokens.gray100,
        backgroundColor: isDark ? tokens.card : tokens.white,
        paddingHorizontal: 12,
        paddingVertical: 12,
      }}
    >
      <AppView row gap={12} align="flex-start">
        {/* Large square thumbnail (Amazon-style) */}
        <AppView
          style={{
            width: 100,
            height: 100,
            borderRadius: 10,
            backgroundColor: highlightColor,
          }}
        />

        {/* Right column — title, rating, price, delivery */}
        <AppView gap={8} style={{ flex: 1, paddingTop: 4 }}>
          {/* Title (2 lines) */}
          <AppView gap={6}>
            <AppView
              style={{ height: 11, width: '88%', borderRadius: 5, backgroundColor: highlightColor }}
            />
            <AppView
              style={{ height: 11, width: '55%', borderRadius: 5, backgroundColor: highlightColor }}
            />
          </AppView>

          {/* Rating row */}
          <AppView
            style={{ height: 9, width: '40%', borderRadius: 5, backgroundColor: baseColor }}
          />

          {/* Price */}
          <AppView
            style={{ height: 16, width: '32%', borderRadius: 5, backgroundColor: highlightColor }}
          />

          {/* Delivery + status line */}
          <AppView
            style={{ height: 8, width: '60%', borderRadius: 4, backgroundColor: baseColor }}
          />
        </AppView>
      </AppView>
    </Animated.View>
  );
}
