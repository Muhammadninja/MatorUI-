import { Image } from 'react-native';

import AirFilt from '../../../assets/3D _Icons/airfilt.png';
import Alt from '../../../assets/3D _Icons/atlts.png';
import Battery from '../../../assets/3D _Icons/battery.png';
import Brake from '../../../assets/3D _Icons/brake.png';
import Brake2 from '../../../assets/3D _Icons/brake2.png';
import Disk from '../../../assets/3D _Icons/disk.png';
import Light from '../../../assets/3D _Icons/light.png';
import Oil from '../../../assets/3D _Icons/oil.png';
import OilFilter from '../../../assets/3D _Icons/oilfilter.png';
import P from '../../../assets/3D _Icons/p.png';
import Susp from '../../../assets/3D _Icons/susp.png';
import Wipe from '../../../assets/3D _Icons/wipe.png';

/** Category display name → the 3D PNG icon in `assets/3D _Icons/`. */
const PART_ICONS: Record<string, any> = {
  Brakes: Brake,
  Batteries: Battery,
  Filters: AirFilt,
  Ignition: P,
  Engine: Disk,
  Electrical: Alt,
  'Oil & Fluids': Oil,
  'Belts & Hoses': OilFilter,
  Wipers: Wipe,
  Lighting: Light,
  Suspension: Susp,
  Exterior: Brake2,
};

export type AutoPartIconProps = {
  /** Category name — must match a key in `MATOR_CAT_TILES`. */
  name: string;
  size?: number;
};

/**
 * `AutoPartIcon` — renders the 3D PNG illustration for a category. Keeps the
 * same size API as before so tiles/styles don't need changes. Renders nothing
 * for an unknown name.
 */
export default function AutoPartIcon({ name, size = 36 }: AutoPartIconProps) {
  const src = PART_ICONS[name];
  if (!src) return null;
  return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
}
