import type { FC } from 'react';
import type { SvgProps } from 'react-native-svg';

import AcCompressor from '@/assets/auto-parts/ac-compressor.svg';
import AirFilter from '@/assets/auto-parts/air-filter.svg';
import Battery from '@/assets/auto-parts/battery.svg';
import BrakeRotor from '@/assets/auto-parts/brake-rotor.svg';
import Clutch from '@/assets/auto-parts/clutch.svg';
import HeadlightProjector from '@/assets/auto-parts/headlight-projector.svg';
import OilBottle from '@/assets/auto-parts/oil-bottle.svg';
import OilFilter from '@/assets/auto-parts/oil-filter.svg';
import Piston from '@/assets/auto-parts/piston.svg';
import Strut from '@/assets/auto-parts/strut.svg';
import Wheel from '@/assets/auto-parts/wheel.svg';
import Wiper from '@/assets/auto-parts/wiper.svg';

/** Category display name → the realistic auto-part illustration in
 *  `assets/auto-parts/`. A few categories with no exact asset use the
 *  nearest mechanical part. */
const PART_ICONS: Record<string, FC<SvgProps>> = {
  Brakes: BrakeRotor,
  Batteries: Battery,
  Filters: AirFilter,
  Ignition: Piston,
  Engine: Clutch,
  Electrical: AcCompressor,
  'Oil & Fluids': OilBottle,
  'Belts & Hoses': OilFilter,
  Wipers: Wiper,
  Lighting: HeadlightProjector,
  Suspension: Strut,
  Exterior: Wheel,
};

export type AutoPartIconProps = {
  /** Category name — must match a key in `MATOR_CAT_TILES`. */
  name: string;
  size?: number;
};

/**
 * `AutoPartIcon` — renders the realistic auto-part illustration (SVG from
 * `assets/auto-parts/`) for a category, in the artwork's own colors. Used on
 * the Explore "Shop by category" grid. Renders nothing for an unknown name.
 */
export default function AutoPartIcon({ name, size = 36 }: AutoPartIconProps) {
  const Icon = PART_ICONS[name];
  if (!Icon) return null;
  return <Icon width={size} height={size} />;
}
