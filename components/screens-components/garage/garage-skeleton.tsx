import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { RADIUS_MEDIA, RADIUS_PLACEHOLDER } from '@/components/screens-components/search/radii';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const HERO_HEIGHT = 202;
const QUICK_TILE_HEIGHT = 86;

/**
 * Loading shimmer for the garage screen. Mirrors the redesigned loaded
 * layout so the skeleton → success transition doesn't shift content:
 *
 *   - Active-vehicle hero placeholder (~202 tall)
 *   - 2×2 quick-action grid placeholders (~86 tall each)
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
    backgroundColor: isDark ? tokens.card : tokens.white,
  } as const;

  return (
    <AppView gap={14}>
      {/* Active-vehicle hero placeholder */}
      <Animated.View style={{ opacity, height: HERO_HEIGHT, borderRadius: 22, padding: 18, ...shell }}>
        <AppView style={{ height: 12, width: 96, borderRadius: RADIUS_PLACEHOLDER, backgroundColor: baseColor }} />
        <AppView style={{ height: 26, width: '55%', borderRadius: RADIUS_PLACEHOLDER, backgroundColor: highlightColor, marginTop: 14 }} />
        <AppView style={{ height: 26, width: '38%', borderRadius: RADIUS_PLACEHOLDER, backgroundColor: highlightColor, marginTop: 6 }} />
        <AppView style={{ height: 13, width: '62%', borderRadius: RADIUS_PLACEHOLDER, backgroundColor: baseColor, marginTop: 10 }} />
        <AppView row gap={10} style={{ marginTop: 20 }}>
          <AppView style={{ flex: 1, height: 46, borderRadius: 13, backgroundColor: highlightColor }} />
          <AppView style={{ width: 46, height: 46, borderRadius: 13, backgroundColor: highlightColor }} />
        </AppView>
      </Animated.View>

      {/* 2×2 quick-action grid placeholders */}
      <Animated.View style={{ opacity }}>
        <AppView row style={{ flexWrap: 'wrap', gap: 10 }}>
          {[0, 1, 2, 3].map((i) => (
            <AppView key={i} style={{ flexBasis: '48%', flexGrow: 1, height: QUICK_TILE_HEIGHT, padding: 14, borderRadius: 16, ...shell }}>
              <AppView style={{ width: 22, height: 22, borderRadius: RADIUS_MEDIA, backgroundColor: highlightColor }} />
              <AppView style={{ height: 12, width: '60%', borderRadius: RADIUS_PLACEHOLDER, backgroundColor: highlightColor, marginTop: 10 }} />
              {/* Only the mileage tile (first) carries a second line now. */}
              {i === 0 ? (
                <AppView style={{ height: 9, width: '45%', borderRadius: RADIUS_PLACEHOLDER, backgroundColor: baseColor, marginTop: 6 }} />
              ) : null}
            </AppView>
          ))}
        </AppView>
      </Animated.View>
    </AppView>
  );
}
