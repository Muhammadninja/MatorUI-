import { Image } from 'react-native';

import { AppView } from '@/components/shared/app-view';

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
 * Keys no single part can stand for — a catch-all category — drawn as a 2×2
 * collage of part photos no root uses, so the tile reads as "assorted parts"
 * in the same photographic style as its neighbours (it was a glyph on a disc).
 */
const COLLAGE_BY_KEY: Record<string, any[]> = {
  other: [Light, Wipe, AirFilt, Piston],
};

/**
 * Optical size per artwork. The PNGs fill their canvas unevenly (83–99%) and
 * in different shapes — a tall bottle or coilover looks small beside a wheel
 * at the same box size — so each is scaled toward the same visual weight
 * (√ of its opaque area), capped so none outgrows the box. Measured from the
 * alpha bounds of the 1024² sources.
 */
const OPTICAL_SCALE = new Map<unknown, number>([
  [AirFilt, 1.01],
  [WheelRim, 0.9],
  [Light, 0.97],
  [Oil, 1.02],
  [OilFilter, 1.03],
  [Piston, 1.15],
  [Wipe, 0.98],
  [BrakeDisc, 0.93],
  [AcCompressor, 1.05],
  [Battery, 0.98],
  [EngineIcon, 0.93],
  [Susp, 1.12],
  [Gearbox, 1.01],
]);
/** The artwork's base share of its box, so a scaled-up one still fits. */
const ART_INSET = 0.92;

/** Shown when neither `iconKey` nor `name` resolves — a category tile/row must
 *  never render blank, so fall back to a neutral engine glyph. */
const DEFAULT_ICON = EngineIcon;

/** What a category draws: one of the 3D PNGs, or a collage of them. */
export type PartIconSource = { image: any } | { collage: any[] };

/** Resolve by `iconKey` first (live categories), then by display `name`
 *  (bundled tiles), then the default. */
export function resolvePartIcon(name: string, iconKey?: string): PartIconSource {
  const key = iconKey?.toLowerCase();
  const collage = key ? COLLAGE_BY_KEY[key] : undefined;
  if (collage) return { collage };
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
 * `AutoPartIcon` — renders the 3D PNG illustration for a category at a
 * consistent optical size, on no backplate (the owner removed the dark-mode
 * plate on 2026-11-12), or a 2×2 collage for a catch-all key. Keeps the same
 * size API so tiles/styles don't change.
 */
export default function AutoPartIcon({ name, iconKey, size = 36 }: AutoPartIconProps) {
  const icon = resolvePartIcon(name, iconKey);
  if ('collage' in icon) {
    const cell = Math.round(size * 0.46);
    return (
      <AppView row wrap center style={{ width: size, height: size, gap: Math.round(size * 0.04) }}>
        {icon.collage.map((src, i) => (
          <Image key={i} source={src} style={{ width: cell, height: cell }} resizeMode="contain" />
        ))}
      </AppView>
    );
  }
  const side = Math.min(size, Math.round(size * ART_INSET * (OPTICAL_SCALE.get(icon.image) ?? 1)));
  return (
    <AppView center style={{ width: size, height: size }}>
      <Image source={icon.image} style={{ width: side, height: side }} resizeMode="contain" />
    </AppView>
  );
}
