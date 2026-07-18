import { Image } from 'react-native';

import AirFilt from '../../../assets/3D _Icons/airfilt.png';
import Alt from '../../../assets/3D _Icons/atlts.png';
import Battery from '../../../assets/3D _Icons/battery.png';
import EngineIcon from '../../../assets/auto-parts/engine.png';
import Brake from '../../../assets/3D _Icons/brake.png';
import Brake2 from '../../../assets/3D _Icons/brake2.png';
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
  Engine: EngineIcon,
  Electrical: Alt,
  'Oil & Fluids': Oil,
  'Belts & Hoses': OilFilter,
  Wipers: Wipe,
  Lighting: Light,
  Suspension: Susp,
  Exterior: Brake2,
};

/**
 * Backend `iconKey` (stable, lowercase — e.g. "electrical") → the same PNGs.
 * The live `/v1/categories` names ("Electrical Parts") don't always match a
 * legacy display-name key, so resolving by `iconKey` keeps every tile iconed.
 */
const PART_ICONS_BY_KEY: Record<string, any> = {
  brakes: Brake,
  batteries: Battery,
  filters: AirFilt,
  ignition: P,
  engine: EngineIcon,
  electrical: Alt,
  oil: Oil,
  oil_fluids: Oil,
  belts: OilFilter,
  belts_hoses: OilFilter,
  wipers: Wipe,
  lighting: Light,
  suspension: Susp,
  exterior: Brake2,
  // Systems that also come through the unified /v1/categories list — mapped to
  // the closest available 3D glyph so every category tile/row shows an icon.
  maintenance: Oil,
  transmission: Susp,
  climate: AirFilt,
  tuning: Brake2,
};

/** Shown when neither `iconKey` nor `name` resolves — a category tile/row must
 *  never render blank, so fall back to a neutral engine glyph. */
const DEFAULT_ICON = EngineIcon;

export type AutoPartIconProps = {
  /** Category name — must match a key in `MATOR_CAT_TILES`. */
  name: string;
  /** Server icon handle from `/v1/categories`; tried before `name`. */
  iconKey?: string;
  size?: number;
};

/**
 * `AutoPartIcon` — renders the 3D PNG illustration for a category. Resolves the
 * glyph by the server's `iconKey` first (live categories), then by display
 * `name` (bundled tiles). Keeps the same size API so tiles/styles don't change.
 * Renders nothing for an unknown key/name.
 */
export default function AutoPartIcon({ name, iconKey, size = 36 }: AutoPartIconProps) {
  const src =
    (iconKey ? PART_ICONS_BY_KEY[iconKey.toLowerCase()] : undefined) ??
    PART_ICONS[name] ??
    DEFAULT_ICON;
  return <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />;
}
