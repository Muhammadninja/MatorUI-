import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

import { RADIUS_MEDIA, RADIUS_PLACEHOLDER, RADIUS_SHEET, RADIUS_TAG } from './radii';

const THUMB_WIDTH = 104;
const THUMB_HEIGHT = 104;
const ROW_GAP = 12;

/**
 * Shimmer placeholder that mirrors the geometry of `SearchResultRow`:
 * white list row, 104×104 thumbnail with rounded corners, text column with the signal tag above the title, the
 * price line, and the delivery line + AddToCartButton placeholder pinned
 * bottom-right. No rating line — the real row hides its rating when the
 * server hasn't supplied `result.rating`, so the skeleton must match.
 *
 * Pulses opacity 1 → 0.55 → 1 on the native driver. Render multiple
 * stacked instances for a believable "results are coming" effect.
 */
export default function SearchResultSkeleton() {
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
    <Animated.View
      style={{
        opacity,
        backgroundColor: tokens.card,
        // The loaded result's card shape: inset, bordered, rounded.
        marginHorizontal: 16,
        marginBottom: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: RADIUS_SHEET,
      }}
    >
      <AppView row gap={ROW_GAP} align="stretch">
        <AppView
          style={{
            width: THUMB_WIDTH,
            minWidth: THUMB_WIDTH,
            maxWidth: THUMB_WIDTH,
            flexBasis: THUMB_WIDTH,
            flexGrow: 0,
            flexShrink: 0,
            alignSelf: 'flex-start',
            height: THUMB_HEIGHT,
            borderRadius: RADIUS_MEDIA,
            backgroundColor: highlightColor,
          }}
        />

        {/* Text column matches search-result-row.tsx: flex: 1,
         *  paddingBottom: 8, internal gap from the rendered children. */}
        <AppView gap={8} style={{ flex: 1, paddingBottom: 8 }}>
          {/* Signal tag, then the title — the order the loaded row uses. */}
          <AppView gap={6}>
            <AppView
              style={{
                height: 18,
                width: 96,
                borderRadius: RADIUS_TAG,
                backgroundColor: baseColor,
              }}
            />
            <AppView
              style={{
                height: 17,
                width: '92%',
                borderRadius: RADIUS_PLACEHOLDER,
                backgroundColor: highlightColor,
              }}
            />
            <AppView
              style={{
                height: 17,
                width: '58%',
                borderRadius: RADIUS_PLACEHOLDER,
                backgroundColor: highlightColor,
              }}
            />
          </AppView>

          {/* Price line — the signal tag moved up to the title, so this is
           *  the price alone, at its larger size. */}
          <AppView row align="flex-end" style={{ gap: 8, marginTop: 4 }}>
            <AppView
              style={{
                height: 26,
                width: '46%',
                borderRadius: RADIUS_PLACEHOLDER,
                backgroundColor: highlightColor,
              }}
            />
          </AppView>

          {/* Delivery row + AddToCartButton placeholder (32px circle) pinned
           *  bottom-right to mirror the real row's right-side action axis. */}
          <AppView row align="flex-end" style={{ gap: 8 }}>
            <AppView
              style={{
                flex: 1,
                height: 10,
                borderRadius: RADIUS_PLACEHOLDER,
                backgroundColor: baseColor,
                maxWidth: '60%',
              }}
            />
            <AppView style={{ flex: 1 }} />
            <AppView
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: highlightColor,
                marginRight: 8,
              }}
            />
          </AppView>
        </AppView>
      </AppView>
    </Animated.View>
  );
}
