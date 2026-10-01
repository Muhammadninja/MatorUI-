import type { VehicleColor } from '@/services/garage-service';

/**
 * Curated real-world automotive palette for the vehicle color picker. The
 * backend stores an arbitrary `color_hex`, so the picker works in hex (not
 * the lossy 4-value enum). `name` is an English label used only for the
 * swatch's accessibility hint — the swatch itself is the visible control, so
 * no per-color translation is required. `onHex` is the check-mark color that
 * reads on top of `hex`. Kept here (a non-token-linted util) so the picker
 * component carries no color literals.
 */
export type VehicleColorSwatch = {
  hex: string;
  /** English name — accessibility hint and the fallback display label. */
  name: string;
  /** i18n key under `addVehicle.*` for the visible label. */
  labelKey: string;
  /** Check-mark / overlay colour that reads on top of `hex`. */
  onHex: string;
};

/**
 * Eight colours, not eighteen. The picker is a SELECTOR — the handful of
 * finishes an Uzbek car actually leaves the lot in — not a paint catalogue.
 * The long list forced a wrapped three-row grid where every extra swatch cost
 * a decision and bought nothing: `nearestSwatch` still maps any stored
 * `color_hex` (including ones picked before this list shrank) onto the closest
 * of these for labelling, so nothing already saved is lost.
 */
export const VEHICLE_COLOR_SWATCHES: VehicleColorSwatch[] = [
  { hex: '#F4F5F7', name: 'White', labelKey: 'addVehicle.colorWhite', onHex: '#111827' },
  { hex: '#C7CBD1', name: 'Silver', labelKey: 'addVehicle.colorSilver', onHex: '#111827' },
  { hex: '#8A9099', name: 'Gray', labelKey: 'addVehicle.colorGray', onHex: '#111827' },
  { hex: '#14161A', name: 'Black', labelKey: 'addVehicle.colorBlack', onHex: '#FFFFFF' },
  { hex: '#C42B2B', name: 'Red', labelKey: 'addVehicle.colorRed', onHex: '#FFFFFF' },
  { hex: '#2456C8', name: 'Blue', labelKey: 'addVehicle.colorBlue', onHex: '#FFFFFF' },
  { hex: '#2E7D46', name: 'Green', labelKey: 'addVehicle.colorGreen', onHex: '#FFFFFF' },
  { hex: '#C9A96A', name: 'Beige', labelKey: 'addVehicle.colorBeige', onHex: '#111827' },
];

/** Sensible default for a fresh vehicle — white is the most common UZ car color. */
export const DEFAULT_VEHICLE_COLOR_HEX = VEHICLE_COLOR_SWATCHES[0].hex;

/** Normalize a hex for comparison (`#abc123` → `#ABC123`). */
export function normalizeHex(hex: string | null | undefined): string {
  return (hex ?? '').trim().toUpperCase();
}

/** Nearest palette swatch to an arbitrary hex — for labelling a stored color. */
export function nearestSwatch(hex: string | null | undefined): VehicleColorSwatch {
  const rgb = hexToRgb(normalizeHex(hex) || VEHICLE_COLOR_SWATCHES[0].hex);
  let best = VEHICLE_COLOR_SWATCHES[0];
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const s of VEHICLE_COLOR_SWATCHES) {
    const d = sqDistance(rgb, hexToRgb(s.hex));
    if (d < bestDistance) {
      bestDistance = d;
      best = s;
    }
  }
  return best;
}

/**
 * Backend stores vehicle color as a hex string (`#1F2A37`). The
 * frontend still uses a 4-value enum for the picker, swatches, and
 * AI-context summaries. Until the UI migrates to a full hex picker,
 * we keep the enum as the canonical UI choice and round-trip to/from
 * hex via the maps below.
 *
 * Lossy in the hex→enum direction by definition — pick the nearest of
 * the four canonical swatches. Acceptable for shipping today; the
 * day someone tints their Cobalt baby-blue, we add a picker.
 */

const ENUM_TO_HEX: Record<VehicleColor, string> = {
  midnight: '#0F1115',
  graphite: '#3A3F47',
  pearl: '#F2F2F0',
  matte: '#1F1F1F',
};

const HEX_TO_ENUM_BUCKETS: Array<{ enum: VehicleColor; rgb: [number, number, number] }> = [
  { enum: 'midnight', rgb: hexToRgb(ENUM_TO_HEX.midnight) },
  { enum: 'graphite', rgb: hexToRgb(ENUM_TO_HEX.graphite) },
  { enum: 'pearl', rgb: hexToRgb(ENUM_TO_HEX.pearl) },
  { enum: 'matte', rgb: hexToRgb(ENUM_TO_HEX.matte) },
];

export function colorEnumToHex(color: VehicleColor): string {
  return ENUM_TO_HEX[color];
}

export function colorHexToEnum(hex: string | null | undefined): VehicleColor {
  if (!hex) return 'midnight';
  const rgb = hexToRgb(hex);
  if (!rgb) return 'midnight';
  let bestEnum: VehicleColor = 'midnight';
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const bucket of HEX_TO_ENUM_BUCKETS) {
    const d = sqDistance(rgb, bucket.rgb);
    if (d < bestDistance) {
      bestDistance = d;
      bestEnum = bucket.enum;
    }
  }
  return bestEnum;
}

function hexToRgb(hex: string): [number, number, number] {
  const cleaned = hex.replace('#', '').trim();
  if (cleaned.length !== 6) return [0, 0, 0];
  const r = parseInt(cleaned.slice(0, 2), 16);
  const g = parseInt(cleaned.slice(2, 4), 16);
  const b = parseInt(cleaned.slice(4, 6), 16);
  if ([r, g, b].some((c) => Number.isNaN(c))) return [0, 0, 0];
  return [r, g, b];
}

function sqDistance(a: [number, number, number], b: [number, number, number]): number {
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
}
