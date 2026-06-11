import type { VehicleColor } from '@/services/garage-service';

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
