import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import {
  RADIUS_MEDIA,
  RADIUS_PLACEHOLDER,
  RADIUS_SHEET,
} from '@/components/screens-components/search/radii';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/** Shared pulse loop → opacity, native-driven. */
function usePulseOpacity() {
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
  return pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] });
}

export type CategoryGridSkeletonProps = {
  /** How many placeholder tiles to render (defaults to a full 12-cat grid). */
  count?: number;
};

/**
 * Loading shimmer for the "Shop by category" / catalog-systems grid. Mirrors
 * the `CategoryTile` layout (31.5%-wide 3-col cells: 60px icon chip + name +
 * count) so the skeleton → data swap doesn't shift the grid. Same pulse +
 * radius conventions as `GarageSkeleton` / `SearchCatalogueSkeleton`; native
 * driver throughout so a slow `/v1/categories` fetch stays at 60fps.
 */
export default function CategoryGridSkeleton({ count = 12 }: CategoryGridSkeletonProps) {
  const { tokens, scheme } = useThemeContext();
  const highlightColor = scheme === 'dark' ? tokens.gray300 : tokens.gray200;
  const opacity = usePulseOpacity();

  return (
    <AppView row wrap justify="space-between" style={{ rowGap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <AppView key={i} center style={{ width: '31.5%', gap: 10, paddingBottom: 5 }}>
          {/* Icon chip */}
          <Animated.View
            style={{
              opacity,
              width: 60,
              height: 60,
              borderRadius: RADIUS_SHEET,
              backgroundColor: highlightColor,
            }}
          />
          {/* Name bar */}
          <Animated.View
            style={{
              opacity,
              width: '72%',
              height: 11,
              borderRadius: RADIUS_PLACEHOLDER,
              backgroundColor: highlightColor,
            }}
          />
          {/* Count bar */}
          <Animated.View
            style={{
              opacity,
              width: '44%',
              height: 9,
              borderRadius: RADIUS_PLACEHOLDER,
              backgroundColor: highlightColor,
            }}
          />
        </AppView>
      ))}
    </AppView>
  );
}

export type CategoryRowsSkeletonProps = CategoryGridSkeletonProps & {
  /** Render the leading 44px icon chip (catalog systems). Off for the
   *  text-only model rows on the make screen. */
  showIcon?: boolean;
};

/**
 * List-row variant. Mirrors the catalog-systems `renderItem` (44px icon chip +
 * name + count row, divider between) — and, with `showIcon={false}`, the
 * make-screen's text-only model rows. Keeps the skeleton → data swap from
 * jumping.
 */
export function CategoryRowsSkeleton({ count = 8, showIcon = true }: CategoryRowsSkeletonProps) {
  const { tokens, scheme } = useThemeContext();
  const highlightColor = scheme === 'dark' ? tokens.gray300 : tokens.gray200;
  const opacity = usePulseOpacity();

  return (
    <AppView>
      {Array.from({ length: count }).map((_, i) => (
        <AppView
          key={i}
          row
          align="center"
          gap={14}
          style={{
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: tokens.divider,
          }}
        >
          {showIcon ? (
            <Animated.View
              style={{
                opacity,
                width: 44,
                height: 44,
                borderRadius: RADIUS_MEDIA,
                backgroundColor: highlightColor,
              }}
            />
          ) : null}
          <AppView flex={1} gap={6}>
            <Animated.View
              style={{
                opacity,
                width: '55%',
                height: 15,
                borderRadius: RADIUS_PLACEHOLDER,
                backgroundColor: highlightColor,
              }}
            />
            <Animated.View
              style={{
                opacity,
                width: '30%',
                height: 10,
                borderRadius: RADIUS_PLACEHOLDER,
                backgroundColor: highlightColor,
              }}
            />
          </AppView>
        </AppView>
      ))}
    </AppView>
  );
}

/**
 * Horizontal brand-tile shimmer for Explore's "Shop by vehicle" row. Mirrors
 * `VehicleMakeTile` (84-wide cell: 65px rounded logo chip + label bar).
 */
export function BrandRowSkeleton({ count = 6 }: CategoryGridSkeletonProps) {
  const { tokens, scheme } = useThemeContext();
  const highlightColor = scheme === 'dark' ? tokens.gray300 : tokens.gray200;
  const opacity = usePulseOpacity();

  return (
    <AppView row style={{ gap: 12, paddingVertical: 2 }}>
      {Array.from({ length: count }).map((_, i) => (
        <AppView key={i} center style={{ width: 84, gap: 8 }}>
          <Animated.View
            style={{
              opacity,
              width: 65,
              height: 65,
              borderRadius: 20,
              backgroundColor: highlightColor,
            }}
          />
          <Animated.View
            style={{
              opacity,
              width: '70%',
              height: 10,
              borderRadius: RADIUS_PLACEHOLDER,
              backgroundColor: highlightColor,
            }}
          />
        </AppView>
      ))}
    </AppView>
  );
}
