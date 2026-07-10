import { Circle, Line, Path, Svg } from 'react-native-svg';

/**
 * Custom stroke-based car-silhouette icons for the Make screen's per-model
 * rows. Ported from the v2 design handoff's `carIcon` SVG builder. Colored by
 * the caller (brand accent); everything else is theme monochrome. Glyphs live
 * on a 0 0 100 100 viewBox.
 */

const CAR_BODY: Record<CarBody, string> = {
  sedan: 'M14 66 l6 -16 q2 -5 8 -5 h10 l10 -12 h16 q6 0 9 6 l6 16 8 3 q4 1 4 6 v7',
  suv: 'M14 66 l4 -20 q2 -6 9 -6 h34 q6 0 8 5 l6 21 6 2 q4 1 4 6 v8',
  truck: 'M12 66 v-14 h22 l8 -12 h14 q5 0 7 5 l5 12 h13 v23',
  hatchback: 'M14 66 l6 -18 q2 -5 8 -5 h12 l12 -10 h10 q6 0 8 6 l4 27',
};

export type CarBody = 'sedan' | 'suv' | 'truck' | 'hatchback';

export type CarIconProps = {
  body?: CarBody;
  size?: number;
  color: string;
};

/**
 * `CarIcon` — stroke silhouette of a vehicle body type (sedan/suv/truck/
 * hatchback), colored by the caller.
 */
export function CarIcon({ body = 'sedan', size = 40, color }: CarIconProps) {
  const s = {
    fill: 'none',
    stroke: color,
    strokeWidth: 5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  } as const;

  return (
    <Svg viewBox="0 0 100 100" width={size} height={size}>
      <Path d={CAR_BODY[body] ?? CAR_BODY.sedan} {...s} />
      <Line x1={20} y1={68} x2={92} y2={68} {...s} />
      <Circle cx={34} cy={68} r={9} fill={color} />
      <Circle cx={78} cy={68} r={9} fill={color} />
    </Svg>
  );
}
