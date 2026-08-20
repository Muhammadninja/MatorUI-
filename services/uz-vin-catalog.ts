/**
 * Uzbek-market VIN decoder.
 *
 * NHTSA's vPIC database (the default `VinDecoderService` provider) does not
 * carry UzAuto Motors / GM-Uzbekistan vehicles, so a VIN off a local
 * Cobalt / Gentra / Spark decodes to nothing. Since the mator catalog IS
 * the UZ lineup, we decode those VINs here against the catalog and return
 * the backend's canonical `make_id` / `model_id` — which is exactly what
 * `POST /v1/garage/vehicles` validates against.
 *
 * This is a *pattern* decoder, not an exact-VIN table: it reads the WMI
 * (chars 1–3), a 2-char model code (chars 4–5), and the ISO-3779 model-year
 * code (char 10). Any VIN that fits the UzAuto pattern resolves; anything
 * else returns `null` and the caller falls back to NHTSA.
 *
 * NOTE: the WMI + model-code scheme here is representative for the demo/QA
 * build. Production should source this map from the backend
 * (`GET /v1/reference/decode-vin`) so it tracks real UzAuto VIN allocations.
 */

export type UzVinDecode = {
  /** Normalized 17-char VIN this was decoded from. */
  vin: string;
  make: string;
  /** Backend catalog id — e.g. `make_chevrolet`. */
  makeId: string;
  model: string;
  /** Backend catalog id — e.g. `model_chevrolet_cobalt`. */
  modelId: string;
  /** Model year, or 0 when the year code is unreadable. */
  year: number;
  /** Body silhouette key (aligns with `CarIcon` bodies). */
  bodyStyle: 'sedan' | 'hatchback' | 'suv' | 'van';
  fuelType: string;
};

/** UzAuto Motors / GM-Uzbekistan world-manufacturer identifier(s). */
const UZ_WMIS = new Set(['XUF']);

type ModelDef = { slug: string; name: string; bodyStyle: UzVinDecode['bodyStyle'] };

/** 2-char model code (VIN chars 4–5) → catalog model. Codes avoid I/O/Q. */
const MODEL_CODES: Record<string, ModelDef> = {
  CB: { slug: 'cobalt', name: 'Cobalt', bodyStyle: 'sedan' },
  GN: { slug: 'gentra', name: 'Gentra', bodyStyle: 'sedan' },
  SP: { slug: 'spark', name: 'Spark', bodyStyle: 'hatchback' },
  NX: { slug: 'nexia', name: 'Nexia', bodyStyle: 'sedan' },
  TR: { slug: 'tracker', name: 'Tracker', bodyStyle: 'suv' },
  ML: { slug: 'malibu', name: 'Malibu', bodyStyle: 'sedan' },
  DM: { slug: 'damas', name: 'Damas', bodyStyle: 'van' },
  LC: { slug: 'lacetti', name: 'Lacetti', bodyStyle: 'sedan' },
};

/**
 * ISO-3779 model-year code (VIN position 10). The 30-year cycle skips the
 * letters I, O, Q, U, Z and the digit 0. Covers 2010–2039.
 */
const YEAR_CODES: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
  J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
  T: 2026, V: 2027, W: 2028, X: 2029, Y: 2030,
  1: 2031, 2: 2032, 3: 2033, 4: 2034, 5: 2035, 6: 2036, 7: 2037, 8: 2038, 9: 2039,
};

function normalize(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Decode a UZ-market VIN. Returns `null` for anything that isn't a
 * recognised UzAuto pattern (wrong length, unknown WMI, unknown model
 * code) so the caller can fall back to another provider.
 */
export function decodeUzVin(rawVin: string): UzVinDecode | null {
  const vin = normalize(rawVin);
  if (vin.length !== 17) return null;
  if (!UZ_WMIS.has(vin.slice(0, 3))) return null;

  const model = MODEL_CODES[vin.slice(3, 5)];
  if (!model) return null;

  const year = YEAR_CODES[vin[9]] ?? 0;

  return {
    vin,
    make: 'Chevrolet',
    makeId: 'make_chevrolet',
    model: model.name,
    modelId: `model_chevrolet_${model.slug}`,
    year,
    bodyStyle: model.bodyStyle,
    fuelType: 'Petrol',
  };
}

/** True when a VIN is a recognised UZ-market pattern. */
export function isUzVin(rawVin: string): boolean {
  return decodeUzVin(rawVin) !== null;
}

/**
 * Representative UZ-market VIN fixtures — one per supported model, each a
 * shape-valid 17-char VIN (no I/O/Q) whose year code decodes to `year`.
 * Used by the QA suite and available for demo seeding.
 */
export const UZ_VIN_FIXTURES: ReadonlyArray<{ vin: string } & Omit<UzVinDecode, 'vin'>> = [
  { vin: 'XUFCB6950K0000017', make: 'Chevrolet', makeId: 'make_chevrolet', model: 'Cobalt', modelId: 'model_chevrolet_cobalt', year: 2019, bodyStyle: 'sedan', fuelType: 'Petrol' },
  { vin: 'XUFGN6950L0000023', make: 'Chevrolet', makeId: 'make_chevrolet', model: 'Gentra', modelId: 'model_chevrolet_gentra', year: 2020, bodyStyle: 'sedan', fuelType: 'Petrol' },
  { vin: 'XUFSP6950M0000039', make: 'Chevrolet', makeId: 'make_chevrolet', model: 'Spark', modelId: 'model_chevrolet_spark', year: 2021, bodyStyle: 'hatchback', fuelType: 'Petrol' },
  { vin: 'XUFNX6950H0000045', make: 'Chevrolet', makeId: 'make_chevrolet', model: 'Nexia', modelId: 'model_chevrolet_nexia', year: 2017, bodyStyle: 'sedan', fuelType: 'Petrol' },
  { vin: 'XUFTR6950N0000051', make: 'Chevrolet', makeId: 'make_chevrolet', model: 'Tracker', modelId: 'model_chevrolet_tracker', year: 2022, bodyStyle: 'suv', fuelType: 'Petrol' },
  { vin: 'XUFML6950P0000068', make: 'Chevrolet', makeId: 'make_chevrolet', model: 'Malibu', modelId: 'model_chevrolet_malibu', year: 2023, bodyStyle: 'sedan', fuelType: 'Petrol' },
  { vin: 'XUFDM6950G0000074', make: 'Chevrolet', makeId: 'make_chevrolet', model: 'Damas', modelId: 'model_chevrolet_damas', year: 2016, bodyStyle: 'van', fuelType: 'Petrol' },
  { vin: 'XUFLC6950E0000085', make: 'Chevrolet', makeId: 'make_chevrolet', model: 'Lacetti', modelId: 'model_chevrolet_lacetti', year: 2014, bodyStyle: 'sedan', fuelType: 'Petrol' },
];
