import { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { useThemeContext } from '@/contexts/theme.context';

export type ImageShimmerProps = {
  /** Draw the rotor glyph in the middle. Off for boxes under ~72px, where the
   *  glyph is larger than the pulse it sits on. */
  showGlyph?: boolean;
  /** The box is a product photo's white surface, which stays white in dark
   *  mode, so the pulse must too — or controls drawn for white vanish on it. */
  onPhoto?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** Glyph side, fixed: the shimmer fills its parent, so there is no numeric
 *  edge to scale off. Matches the mid-scale size `PartImagePlaceholder` uses. */
const GLYPH = 44;

/**
 * Loading state for a remote photo: a pulsing tile with a faint rotor outline.
 *
 * Pulses opacity 1 → 0.55 → 1 at 700ms on the native driver — the same cadence
 * the list skeletons (`SearchResultSkeleton`, `GarageSkeleton`, …) use, so a
 * screen where rows have arrived but photos haven't breathes in one rhythm
 * rather than two.
 *
 * It deliberately echoes `PartImagePlaceholder`'s rotor at a lighter weight:
 * "this photo is coming" and "this part has no photo" should read as the same
 * family, with movement as the only difference between them.
 */
function ImageShimmer({ showGlyph = true, onPhoto = false, style }: ImageShimmerProps) {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
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

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          opacity,
          backgroundColor: onPhoto ? tokens.photoShimmer : isDark ? tokens.gray200 : tokens.gray100,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {showGlyph ? (
        <Svg width={GLYPH} height={GLYPH} viewBox="0 0 48 48">
          <G
            stroke={onPhoto ? tokens.onPhotoMuted : tokens.textMuted}
            strokeWidth={2}
            fill="none"
            opacity={0.32}
          >
            <Circle cx={24} cy={24} r={19} />
            <Circle cx={24} cy={24} r={7.5} />
          </G>
        </Svg>
      ) : null}
    </Animated.View>
  );
}

export default memo(ImageShimmer);
