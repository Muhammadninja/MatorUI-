import { useEffect } from 'react';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import { useThemeContext } from '@/contexts/theme.context';

export type WheelLoaderProps = {
  /** Rendered width/height in px. */
  size?: number;
  /** Stroke/fill color. Defaults to the theme `text` so it inverts by mode. */
  color?: string;
  /** Full-rotation duration in ms. Handoff spec: 2.6s linear, infinite. */
  durationMs?: number;
};

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

// Geometry (viewBox 100×100), per the loader handoff: 5 spokes at
// 0/72/144/216/288° from centre to r=30, and 5 lug bolts at 36/108/180/252/324°
// on r=15. Precomputed so the SVG is static and only the wrapper rotates.
const SPOKES = [0, 72, 144, 216, 288].map((a) => {
  const r = ((a - 90) * Math.PI) / 180;
  return { x: 50 + 30 * Math.cos(r), y: 50 + 30 * Math.sin(r) };
});
const LUGS = [36, 108, 180, 252, 324].map((a) => {
  const r = ((a - 90) * Math.PI) / 180;
  return { x: 50 + 15 * Math.cos(r), y: 50 + 15 * Math.sin(r) };
});

/**
 * `WheelLoader` — the alloy-wheel glyph (the logo "O") spinning as the app's
 * loading indicator, so loading feels on-brand. Reused on the Splash, the
 * Category/Make list-loading overlay, and the Explore pull-to-refresh bar.
 * Geometry + 360°/2.6s linear spin per the loader handoff.
 */
export default function WheelLoader({ size = 40, color, durationMs = 2600 }: WheelLoaderProps) {
  const { tokens } = useThemeContext();
  const tint = color ?? tokens.text;
  const rot = useSharedValue(0);

  useEffect(() => {
    rot.value = 0;
    rot.value = withRepeat(withTiming(360, { duration: durationMs, easing: Easing.linear }), -1);
    return () => cancelAnimation(rot);
  }, [rot, durationMs]);

  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  return (
    <AnimatedSvg width={size} height={size} viewBox="0 0 100 100" style={style}>
      {/* outer tire ring */}
      <Circle cx={50} cy={50} r={45} fill="none" stroke={tint} strokeWidth={10} />
      {/* inner rim */}
      <Circle cx={50} cy={50} r={31} fill="none" stroke={tint} strokeWidth={6} />
      {/* spokes */}
      {SPOKES.map((p, i) => (
        <Line key={i} x1={50} y1={50} x2={p.x} y2={p.y} stroke={tint} strokeWidth={9} strokeLinecap="round" />
      ))}
      {/* hub */}
      <Circle cx={50} cy={50} r={11} fill={tint} />
      {/* lug bolts */}
      {LUGS.map((p, i) => (
        <Circle key={i} cx={p.x} cy={p.y} r={2.6} fill={tint} />
      ))}
    </AnimatedSvg>
  );
}
