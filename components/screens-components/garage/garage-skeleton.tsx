import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { RADIUS_MEDIA, RADIUS_PLACEHOLDER } from '@/components/screens-components/search/radii';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const HERO_HEIGHT = 156;
const QUICK_TILE_HEIGHT = 96;

/**
 * Loading shimmer for the garage screen. Mirrors the redesigned loaded
 * layout so the skeleton → success transition doesn't shift content:
 *
 *   - Active-vehicle hero placeholder (~156 tall)
 *   - 2×2 quick-action grid placeholders (~96 tall each)
 *
 * It tracks the trimmed layout: no fit-filter row, no three-column stat grid
 * in the hero, and a sub-line only on the mileage tile.
 *
 * Native driver throughout so the screen stays at 60fps while a slow
 * fetch resolves.
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

  const shell = {
    borderWidth: 1,
    borderColor: tokens.border,
    backgroundColor: tokens.card,
  } as const;

  return (
    <AppView gap={12}>
      {/* Active-vehicle hero placeholder */}
      <Animated.View
        style={{ opacity, height: HERO_HEIGHT, borderRadius: 16, padding: 16, gap: 12, ...shell }}
      >
        <AppView row gap={12} flex={1}>
          <AppView
            style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: highlightColor }}
          />
          <AppView flex={1} gap={8}>
            <AppView
              style={{
                height: 11,
                width: '48%',
                borderRadius: RADIUS_PLACEHOLDER,
                backgroundColor: baseColor,
              }}
            />
            <AppView
              style={{
                height: 20,
                width: '72%',
                borderRadius: RADIUS_PLACEHOLDER,
                backgroundColor: highlightColor,
              }}
            />
            <AppView
              style={{
                height: 12,
                width: '38%',
                borderRadius: RADIUS_PLACEHOLDER,
                backgroundColor: baseColor,
              }}
            />
          </AppView>
        </AppView>
        <AppView style={{ height: 48, borderRadius: 12, backgroundColor: highlightColor }} />
      </Animated.View>

      {/* 2×2 quick-action grid placeholders */}
      <Animated.View style={{ opacity }}>
        <AppView row style={{ flexWrap: 'wrap', gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <AppView
              key={i}
              style={{
                flexBasis: '47%',
                flexGrow: 1,
                height: QUICK_TILE_HEIGHT,
                padding: 16,
                borderRadius: 12,
                ...shell,
              }}
            >
              <AppView
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: RADIUS_MEDIA,
                  backgroundColor: highlightColor,
                }}
              />
              <AppView
                style={{
                  height: 12,
                  width: '60%',
                  borderRadius: RADIUS_PLACEHOLDER,
                  backgroundColor: highlightColor,
                  marginTop: 10,
                }}
              />
              {/* Only the mileage tile (first) carries a second line now. */}
              {i === 0 ? (
                <AppView
                  style={{
                    height: 9,
                    width: '45%',
                    borderRadius: RADIUS_PLACEHOLDER,
                    backgroundColor: baseColor,
                    marginTop: 6,
                  }}
                />
              ) : null}
            </AppView>
          ))}
        </AppView>
      </Animated.View>
    </AppView>
  );
}
