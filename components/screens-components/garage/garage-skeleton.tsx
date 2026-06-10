import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { RADIUS_MEDIA, RADIUS_PLACEHOLDER, RADIUS_SHEET } from '@/components/screens-components/search/radii';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const PRIMARY_CARD_HEIGHT = 320;
const SECONDARY_TILE_HEIGHT = 96;
const SECONDARY_COUNT = 2;

/**
 * Loading shimmer for the garage screen. Mirrors the loaded layout so
 * the skeleton → success transition doesn't shift content:
 *
 *   - Primary card placeholder (~320 tall — image + headline + stats row)
 *   - "Also in the garage" eyebrow placeholder
 *   - Two secondary tile placeholders (~96 tall each)
 *
 * Same pulse + radius conventions as `SearchCatalogueSkeleton` and
 * `SearchTopFeaturedSkeleton`. Native driver throughout so the screen
 * stays at 60fps while a slow fetch resolves.
 */
export default function GarageSkeleton() {
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

  const cardShell = {
    borderRadius: RADIUS_SHEET,
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: isDark ? tokens.card : tokens.white,
  } as const;

  return (
    <AppView gap={24}>
      {/* Primary vehicle card placeholder */}
      <Animated.View
        style={{
          opacity,
          height: PRIMARY_CARD_HEIGHT,
          padding: 14,
          ...cardShell,
        }}
      >
        {/* Image area */}
        <AppView
          style={{
            height: 180,
            borderRadius: RADIUS_MEDIA,
            backgroundColor: highlightColor,
          }}
        />
        {/* Headline */}
        <AppView style={{ marginTop: 14, gap: 6 }}>
          <AppView
            style={{
              height: 18,
              width: '70%',
              borderRadius: RADIUS_PLACEHOLDER,
              backgroundColor: highlightColor,
            }}
          />
          <AppView
            style={{
              height: 12,
              width: '45%',
              borderRadius: RADIUS_PLACEHOLDER,
              backgroundColor: baseColor,
            }}
          />
        </AppView>
        {/* Stats row */}
        <AppView row gap={10} style={{ marginTop: 12 }}>
          <AppView
            style={{
              flex: 1,
              height: 36,
              borderRadius: RADIUS_PLACEHOLDER,
              backgroundColor: baseColor,
            }}
          />
          <AppView
            style={{
              flex: 1,
              height: 36,
              borderRadius: RADIUS_PLACEHOLDER,
              backgroundColor: baseColor,
            }}
          />
        </AppView>
      </Animated.View>

      {/* "Also in the garage" eyebrow */}
      <Animated.View style={{ opacity }}>
        <AppView
          style={{
            height: 11,
            width: 130,
            borderRadius: RADIUS_PLACEHOLDER,
            backgroundColor: baseColor,
            marginBottom: 12,
          }}
        />
        <AppView gap={10}>
          {Array.from({ length: SECONDARY_COUNT }).map((_, i) => (
            <AppView
              key={i}
              row
              align="center"
              gap={12}
              style={{
                height: SECONDARY_TILE_HEIGHT,
                padding: 12,
                ...cardShell,
              }}
            >
              <AppView
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: RADIUS_MEDIA,
                  backgroundColor: highlightColor,
                }}
              />
              <AppView style={{ flex: 1, gap: 6 }}>
                <AppView
                  style={{
                    height: 14,
                    width: '60%',
                    borderRadius: RADIUS_PLACEHOLDER,
                    backgroundColor: highlightColor,
                  }}
                />
                <AppView
                  style={{
                    height: 10,
                    width: '40%',
                    borderRadius: RADIUS_PLACEHOLDER,
                    backgroundColor: baseColor,
                  }}
                />
              </AppView>
            </AppView>
          ))}
        </AppView>
      </Animated.View>
    </AppView>
  );
}
