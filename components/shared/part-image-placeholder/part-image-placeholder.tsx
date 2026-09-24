import { memo } from 'react';
import { View, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, G, Line } from 'react-native-svg';

import { useThemeContext } from '@/contexts/theme.context';

export type PartImagePlaceholderProps = {
  /** Accessibility label — the product name, so the slot still announces
   *  something meaningful when there is no photo. */
  label?: string;
  width?: DimensionValue;
  height?: DimensionValue;
  radius?: number;
  /** Tile color. Defaults to the theme's `card`; pass a value when the
   *  surrounding card already paints its own background. */
  backgroundColor?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Glyph side as a fraction of the box's shorter edge. Keeps the rotor
 *  optically centered and comfortably inset at every size we render at
 *  (56px cart thumbnails through 320px detail heroes). */
const GLYPH_FRACTION = 0.46;
const MIN_GLYPH = 28;
const MAX_GLYPH = 132;

/**
 * The catalog's "no photo" placeholder: a brake-rotor glyph on a flat tile.
 *
 * Replaces the bundled `test-image.png`, which was a stand-in PRODUCT photo —
 * it read as a real listing image, so a part with no photo was indistinguishable
 * from one that had a (wrong) photo. A neutral glyph says "no image" honestly.
 *
 * Drawn with `react-native-svg` rather than shipped as a raster so it stays
 * crisp from a 56px thumbnail to a full-width hero, weighs nothing in the
 * bundle, and — unlike a baked PNG — follows the theme into dark mode.
 *
 * A rotor is the glyph because it is the most legible auto-part silhouette at
 * small sizes: a concentric ring reads correctly at 28px where a piston or
 * alternator collapses into mush.
 */
function PartImagePlaceholder({
  label,
  width = '100%',
  height = '100%',
  radius = 0,
  backgroundColor,
  style,
  testID,
}: PartImagePlaceholderProps) {
  const { tokens } = useThemeContext();

  // The glyph is sized off the numeric edge when we have one. Percentage
  // dimensions ('100%') carry no pixel size here, so fall back to a mid-scale
  // glyph and let `aspectRatio`-free flex layout do the centering.
  const numericEdges = [width, height].filter(
    (v): v is number => typeof v === 'number',
  );
  const glyph = numericEdges.length
    ? Math.max(MIN_GLYPH, Math.min(MAX_GLYPH, Math.min(...numericEdges) * GLYPH_FRACTION))
    : 56;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: backgroundColor ?? tokens.card,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <Svg width={glyph} height={glyph} viewBox="0 0 48 48">
        <G
          stroke={tokens.textMuted}
          strokeWidth={2}
          strokeLinecap="round"
          fill="none"
          opacity={0.5}
        >
          {/* Rotor face and hub */}
          <Circle cx={24} cy={24} r={19} />
          <Circle cx={24} cy={24} r={7.5} />
          {/* Lug holes, evenly spaced on the hub flange */}
          {[0, 72, 144, 216, 288].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <Circle
                key={deg}
                cx={24 + Math.cos(rad) * 12}
                cy={24 + Math.sin(rad) * 12}
                r={1.7}
                fill={tokens.textMuted}
                stroke="none"
              />
            );
          })}
          {/* Cooling vents — short radial ticks just inside the rim */}
          {[30, 90, 150, 210, 270, 330].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <Line
                key={deg}
                x1={24 + Math.cos(rad) * 14.5}
                y1={24 + Math.sin(rad) * 14.5}
                x2={24 + Math.cos(rad) * 17.5}
                y2={24 + Math.sin(rad) * 17.5}
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}

export default memo(PartImagePlaceholder);
