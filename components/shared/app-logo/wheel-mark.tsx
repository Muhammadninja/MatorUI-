import { useEffect } from 'react';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line } from 'react-native-svg';

import { useThemeContext } from '@/contexts/theme.context';

export type WheelMarkProps = {
  /** Rendered width/height in px. */
  size?: number;
  /** Stroke/fill color. Defaults to the theme `text` color so it inverts. */
  color?: string;
  /** When true, the wheel rotates continuously (splash + loading spinner). */
  spin?: boolean;
  /** Full-rotation duration in ms when spinning. */
  spinDurationMs?: number;
};

const AnimatedSvg = Animated.createAnimatedComponent(Svg);

// Five spokes at 0/72/144/216/288°, measured from top (12 o'clock).
const SPOKE_ANGLES = [0, 72, 144, 216, 288];
// Geometry from the handoff: outer ring r=46, inner ring r=33, hub r=9,
// stroke width 8, on a 100×100 viewBox centered at (50,50).
const HUB_R = 9;
const INNER_R = 33;

function spokePoint(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: 50 + radius * Math.cos(rad), y: 50 + radius * Math.sin(rad) };
}

/**
 * `WheelMark` — the alloy-wheel glyph that replaces the "O" in the MATOR
 * wordmark and doubles as the app's loading spinner. Monochrome so it
 * inverts cleanly by theme. Geometry per the design handoff.
 */
export default function WheelMark({
  size = 28,
  color,
  spin = false,
  spinDurationMs = 2600,
}: WheelMarkProps) {
  const { tokens } = useThemeContext();
  const stroke = color ?? tokens.text;
  const rotation = useSharedValue(0);

  useEffect(() => {
    if (spin) {
      rotation.value = 0;
      rotation.value = withRepeat(
        withTiming(360, { duration: spinDurationMs, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      cancelAnimation(rotation);
      rotation.value = 0;
    }
    return () => cancelAnimation(rotation);
  }, [spin, spinDurationMs, rotation]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <AnimatedSvg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={animatedStyle}
    >
      {/* Outer ring */}
      <Circle cx={50} cy={50} r={46} stroke={stroke} strokeWidth={8} fill="none" />
      {/* Inner ring */}
      <Circle cx={50} cy={50} r={INNER_R} stroke={stroke} strokeWidth={8} fill="none" />
      {/* Five spokes from hub to inner ring */}
      {SPOKE_ANGLES.map((angle) => {
        const inner = spokePoint(angle, HUB_R);
        const outer = spokePoint(angle, INNER_R);
        return (
          <Line
            key={angle}
            x1={inner.x}
            y1={inner.y}
            x2={outer.x}
            y2={outer.y}
            stroke={stroke}
            strokeWidth={8}
            strokeLinecap="round"
          />
        );
      })}
      {/* Center hub */}
      <Circle cx={50} cy={50} r={HUB_R} fill={stroke} />
    </AnimatedSvg>
  );
}
