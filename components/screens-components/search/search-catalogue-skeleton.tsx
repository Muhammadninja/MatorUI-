import { useEffect, useRef } from 'react';
import { Animated, Easing, ScrollView } from 'react-native';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

import { RADIUS_MEDIA, RADIUS_PLACEHOLDER, RADIUS_SHEET } from './radii';

const CARD_WIDTH = 280;
const CARD_HEIGHT = 280;
const SKELETON_COUNT = 3;

/**
 * Loading skeleton for the catalogue horizontal scroll. Mirrors
 * `SearchPartCard`'s geometry so the loaded state slots in without a
 * layout jump: outline card, top media area (image placeholder), body
 * with title / description / price line.
 *
 * Same pulse + radius conventions as `SearchResultSkeleton` — opacity
 * 1 → 0.55 → 1 on the native driver. Three cards visible by default;
 * the user can scroll horizontally to confirm motion.
 */
export default function SearchCatalogueSkeleton() {
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
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 20 }}
    >
      <AppView row gap={12}>
        {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
          <Animated.View
            key={i}
            style={{
              opacity,
              width: CARD_WIDTH,
              height: CARD_HEIGHT,
              borderRadius: RADIUS_SHEET,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: isDark ? tokens.card : tokens.white,
              padding: 12,
            }}
          >
            {/* Image placeholder */}
            <AppView
              style={{
                height: 160,
                borderRadius: RADIUS_MEDIA,
                backgroundColor: highlightColor,
              }}
            />
            {/* Title bars */}
            <AppView style={{ marginTop: 12, gap: 6 }}>
              <AppView
                style={{
                  height: 14,
                  width: '85%',
                  borderRadius: RADIUS_PLACEHOLDER,
                  backgroundColor: highlightColor,
                }}
              />
              <AppView
                style={{
                  height: 10,
                  width: '60%',
                  borderRadius: RADIUS_PLACEHOLDER,
                  backgroundColor: baseColor,
                }}
              />
            </AppView>
            {/* Price + button line */}
            <AppView
              row
              align="flex-end"
              style={{
                justifyContent: 'space-between',
                marginTop: 14,
                gap: 8,
              }}
            >
              <AppView
                style={{
                  height: 18,
                  width: '40%',
                  borderRadius: RADIUS_PLACEHOLDER,
                  backgroundColor: highlightColor,
                }}
              />
              <AppView
                style={{
                  height: 28,
                  width: 84,
                  borderRadius: RADIUS_PLACEHOLDER,
                  backgroundColor: baseColor,
                }}
              />
            </AppView>
          </Animated.View>
        ))}
      </AppView>
    </ScrollView>
  );
}
