import { LayoutGrid, type LucideIcon } from 'lucide-react-native';
import { Image } from 'react-native';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

// Several file names predate their artwork; the identifiers say what each shows.
import AirFilt from '../../../assets/3D _Icons/airfilt.png';
// Owner-approved 2026-11-11 (category-art audit): true-alpha renders, part
// centred at 86% of a 1024 canvas. The rotor and gearbox were cut out of a
// white studio backdrop (Vision subject lift, lug holes cleared, defringed).
import AcCompressor from '../../../assets/categories/climate-ac-compressor.png';
import Battery from '../../../assets/categories/electrical-battery.png';
import BrakeDisc from '../../../assets/categories/brakes-rotor-caliper.png';
import EngineIcon from '../../../assets/categories/engine-turbo.png';
import Gearbox from '../../../assets/categories/transmission-gearbox.png';
import Susp from '../../../assets/categories/suspension-coilover.png';
import WheelRim from '../../../assets/3D _Icons/disk.png';
import Light from '../../../assets/3D _Icons/light.png';
import Oil from '../../../assets/3D _Icons/oil.png';
import OilFilter from '../../../assets/3D _Icons/oilfilter.png';
import Piston from '../../../assets/3D _Icons/p.png';
import Wipe from '../../../assets/3D _Icons/wipe.png';

/** Category display name → the 3D PNG icon in `assets/3D _Icons/`. */
const PART_ICONS: Record<string, any> = {
  Brakes: BrakeDisc,
  Batteries: Battery,
  Filters: AirFilt,
  Ignition: Piston,
  Engine: EngineIcon,
  Electrical: Battery,
  'Oil & Fluids': Oil,
  'Belts & Hoses': OilFilter,
  Wipers: Wipe,
  Lighting: Light,
  Suspension: Susp,
  Exterior: BrakeDisc,
};

/**
 * Backend `iconKey` (stable, lowercase — e.g. "electrical") → the same PNGs.
 * The category-tree roots resolve through these keys (`ROOT_META` in
 * categories-service), each to the artwork of a part from its own system.
 */
const PART_ICONS_BY_KEY: Record<string, any> = {
  brakes: BrakeDisc,
  batteries: Battery,
  filters: AirFilt,
  ignition: Piston,
  engine: EngineIcon,
  electrical: Battery,
  oil: Oil,
  oil_fluids: Oil,
  belts: OilFilter,
  belts_hoses: OilFilter,
  wipers: Wipe,
  lighting: Light,
  suspension: Susp,
  exterior: BrakeDisc,
  maintenance: OilFilter,
  // A gearbox: the piston that stood in here is an engine part.
  transmission: Gearbox,
  // `cooling` is the category table's own key for Heating & Cooling.
  climate: AcCompressor,
  cooling: AcCompressor,
  tuning: WheelRim,
};

/**
 * Keys no part artwork can stand for — a catch-all category — drawn with the
 * app's icon set instead, on a disc the size of the artwork.
 */
const GLYPH_ICONS_BY_KEY: Record<string, LucideIcon> = {
  other: LayoutGrid,
};

/** Shown when neither `iconKey` nor `name` resolves — a category tile/row must
 *  never render blank, so fall back to a neutral engine glyph. */
const DEFAULT_ICON = EngineIcon;

/**
 * Art that is mostly black plastic or rubber. On the dark card (#171E23) more
 * than a third of each blends in (battery 63%, coilover 55%, engine 37% of
 * the part within 1.25:1), so the tile sets it on a neutral plate in dark
 * mode. Measured 2026-11-11; the silver, red and grey art reads without one.
 */
const DARK_ART = new Set<unknown>([Battery, Susp, EngineIcon]);

/** Whether a category's art needs the dark-mode backplate. */
export function isDarkPartArt(name: string, iconKey?: string): boolean {
  const icon = resolvePartIcon(name, iconKey);
  return 'image' in icon && DARK_ART.has(icon.image);
}

/** What a category draws: one of the 3D PNGs, or an icon-set glyph. */
export type PartIconSource = { image: any } | { glyph: LucideIcon };

/** Resolve by `iconKey` first (live categories), then by display `name`
 *  (bundled tiles), then the default. */
export function resolvePartIcon(name: string, iconKey?: string): PartIconSource {
  const key = iconKey?.toLowerCase();
  const glyph = key ? GLYPH_ICONS_BY_KEY[key] : undefined;
  if (glyph) return { glyph };
  return { image: (key ? PART_ICONS_BY_KEY[key] : undefined) ?? PART_ICONS[name] ?? DEFAULT_ICON };
}

export type AutoPartIconProps = {
  /** Category name — the fallback key for bundled tiles (`MATOR_CAT_TILES`). */
  name: string;
  /** Server / root icon handle; tried before `name`. */
  iconKey?: string;
  size?: number;
};

/**
 * `AutoPartIcon` — renders the 3D PNG illustration for a category (or, for a
 * catch-all key, an icon-set glyph on a disc of the same size). Keeps the same
 * size API so tiles/styles don't change.
 */
export default function AutoPartIcon({ name, iconKey, size = 36 }: AutoPartIconProps) {
  const { tokens } = useThemeContext();
  const icon = resolvePartIcon(name, iconKey);
  if ('glyph' in icon) {
    const Glyph = icon.glyph;
    return (
      <AppView
        center
        rounded={size / 2}
        style={{ width: size, height: size, backgroundColor: tokens.backgroundSecondary }}
      >
        <Glyph size={Math.round(size * 0.46)} strokeWidth={1.75} color={tokens.text} />
      </AppView>
    );
  }
  return <Image source={icon.image} style={{ width: size, height: size }} resizeMode="contain" />;
}
