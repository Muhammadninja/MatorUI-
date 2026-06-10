import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

import { RADIUS_MEDIA, RADIUS_PLACEHOLDER, RADIUS_SHEET } from './radii';

const CARD_HEIGHT = 240;
const SKELETON_COUNT = 4;

/**
 * Loading skeleton for the Top Featured 2-column grid. Renders four
 * compact card placeholders (48% width each — same as the real cards)
 * in a wrap row, matching how `SearchPartCard compact` lays out so the
 * loaded state replaces the skeleton without a layout jump.
 *
 * Same pulse + radius conventions as the catalogue skeleton.
 */
export default function SearchTopFeaturedSkeleton() {
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

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.55],
  });

  return (
    <AppView px={16}>
      <AppView row gap={12} justify="space-between" style={{ flexWrap: 'wrap' }}>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <Animated.View
            key={i}
            style={{
              opacity,
              width: '48%',
              height: CARD_HEIGHT,
              borderRadius: RADIUS_SHEET,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: isDark ? tokens.card : tokens.white,
              padding: 10,
              marginBottom: 12,
            }}
          >
            <AppView
              style={{
                height: 130,
                borderRadius: RADIUS_MEDIA,
                backgroundColor: highlightColor,
              }}
            />
            <AppView style={{ marginTop: 10, gap: 5 }}>
              <AppView
                style={{
                  height: 12,
                  width: '85%',
                  borderRadius: RADIUS_PLACEHOLDER,
                  backgroundColor: highlightColor,
                }}
              />
              <AppView
                style={{
                  height: 10,
                  width: '55%',
                  borderRadius: RADIUS_PLACEHOLDER,
                  backgroundColor: baseColor,
                }}
              />
            </AppView>
            <AppView style={{ marginTop: 10, gap: 6 }}>
              <AppView
                style={{
                  height: 14,
                  width: '40%',
                  borderRadius: RADIUS_PLACEHOLDER,
                  backgroundColor: highlightColor,
                }}
              />
              <AppView
                style={{
                  height: 24,
                  width: '100%',
                  borderRadius: RADIUS_PLACEHOLDER,
                  backgroundColor: baseColor,
                }}
              />
            </AppView>
          </Animated.View>
        ))}
      </AppView>
    </AppView>
  );
}
