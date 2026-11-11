import { VEHICLE_COLOR_SWATCHES } from '@/utils/vehicle-color';

/**
 * Paint keys for vehicle images: one per swatch the colour picker offers, so a
 * colour someone picked always has a matching image name. The key is the
 * asset's `{paint}` segment (`chevrolet/<bodyKey>/<paint>.webp`).
 */
export const PAINT_KEYS = ['white', 'silver', 'gray', 'black', 'red', 'blue', 'green', 'beige'] as const;
export type PaintKey = (typeof PAINT_KEYS)[number];

/** The paint every body is produced in first, and the one shown when the
 *  stored colour can't be matched. */
export const BASE_PAINT: PaintKey = 'white';

/**
 * How close (Euclidean RGB) a stored `color_hex` must be to a swatch to count
 * as that paint. The picker stores swatch hexes exactly; older vehicles may hold
 * hexes from the previous 18-colour list. The closest pair of swatches (white
 * and silver) are ~72 apart, so 32 can never match two swatches at once, and a
 * colour from the old list that is not near any of today's eight is left
 * unmatched rather than guessed.
 */
export const PAINT_MATCH_DISTANCE = 32;

const PAINT_BY_SWATCH_NAME: Record<string, PaintKey> = {
  White: 'white',
  Silver: 'silver',
  Gray: 'gray',
  Black: 'black',
  Red: 'red',
  Blue: 'blue',
  Green: 'green',
  Beige: 'beige',
};

/** Strict `#RRGGBB` / `#RGB` parse. Anything else is "no colour", never black. */
export function parseHex(hex: string | null | undefined): [number, number, number] | null {
  const raw = (hex ?? '').trim().replace(/^#/, '');
  const full = /^[0-9a-f]{3}$/i.test(raw) ? raw.replace(/(.)/g, '$1$1') : raw;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
}

/** The paint a stored `color_hex` matches, or null when it is missing,
 *  malformed, or not close enough to any offered paint. */
export function paintForHex(hex: string | null | undefined): PaintKey | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  let best: PaintKey | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const swatch of VEHICLE_COLOR_SWATCHES) {
    const paint = PAINT_BY_SWATCH_NAME[swatch.name];
    const target = parseHex(swatch.hex);
    if (!paint || !target) continue;
    const distance = Math.hypot(rgb[0] - target[0], rgb[1] - target[1], rgb[2] - target[2]);
    if (distance < bestDistance) {
      best = paint;
      bestDistance = distance;
    }
  }
  return bestDistance <= PAINT_MATCH_DISTANCE ? best : null;
}
