/**
 * Uzbek-market VIN decoder.
 *
 * NHTSA's vPIC database (the fallback provider) does not carry UzAuto Motors /
 * GM-Uzbekistan vehicles. Checked live on 2026-09-25: `DecodeWMI/XWB` returns
 * nothing, and a `XWB…` VIN comes back with an empty make/model and error 7
 * ("manufacturer is not registered with NHTSA"). So UzAuto VINs are decoded
 * here, against two tables:
 *
 *   1. `UZAUTO_VIN_PATTERNS` — real UzAuto VINs (WMI `XWB`). Every row is a
 *      VIN pattern backed by cited evidence. Nothing in it is inferred from a
 *      single character, and it only grows when new evidence arrives.
 *   2. The `XUF` demo scheme — a synthetic pattern decoder for the demo/QA
 *      build (`UZ_VIN_FIXTURES`). It does not describe real UzAuto VINs.
 *
 * `classifyUzVin` tells the caller which of three things a VIN is: decoded, a
 * UzAuto VIN this table cannot decode (don't fall back — NHTSA can't either),
 * or not a UZ VIN at all (fall back to NHTSA).
 */

export type UzVinDecode = {
  /** Normalized 17-char VIN this was decoded from. */
  vin: string;
  /** Make as the mator reference catalogue names it (`GET /v1/reference/makes`). */
  make: string;
  /** Catalog id, demo scheme only (`make_chevrolet`). Real patterns leave it
   *  unset: the add-vehicle screen resolves live ids by name at decode time. */
  makeId?: string;
  /** Model as the mator reference catalogue names it (`GET /v1/reference/models`). */
  model: string;
  /** Catalog id, demo scheme only. See `makeId`. */
  modelId?: string;
  /** Model year, or 0 when the year code is unreadable (demo scheme only). */
  year: number;
  /** Body silhouette key (aligns with `CarIcon` bodies). */
  bodyStyle: 'sedan' | 'hatchback' | 'suv' | 'van';
  /** Demo scheme only; real VIN patterns carry no fuel evidence. */
  fuelType?: string;
};

// ── Shared VIN reading ───────────────────────────────────────────────────────

/**
 * ISO 3779 model-year code (VIN position 10) → its year in the 2010–2039
 * cycle. The same code also means the year 30 earlier (1980–2009); real
 * patterns pick between the two with `resolveModelYear`. The cycle skips the
 * letters I, O, Q, U, Z and the digit 0.
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

// ── Real UzAuto VIN patterns (WMI XWB) ───────────────────────────────────────

/** UzAuto Motors (formerly UzDaewooAuto / GM Uzbekistan). Every evidence row
 *  below carries it. */
export const UZAUTO_WMI = 'XWB';

export type UzAutoVinPattern = {
  /**
   * Vehicle descriptor section, VIN positions 4–8, matched exactly. Position 9
   * (a check digit on some VINs, a letter on others), 10 (model year) and 11
   * (plant) are not part of the model match.
   */
  vds: string;
  make: string;
  /** The catalogue's model name, or its id where the name is ambiguous: two
   *  live Chevrolet models are both named "Tracker", so the Tracker row uses
   *  the id `Tracker-2`. `resolveCatalogIds` matches name first, then id. */
  model: string;
  /** The generation or marketing name the evidence uses, when it differs from
   *  the catalogue name. Informational; not part of the decode. */
  variant?: string;
  bodyStyle: UzVinDecode['bodyStyle'];
  /**
   * Model years this pattern can decode to, inclusive. `null` = still in
   * production, which caps the range at next year. Used to choose between the
   * two ISO 3779 cycles a year code can mean.
   */
  modelYears: readonly [from: number, to: number | null];
  /** Where the pattern comes from. Prefixes only — never a full VIN. */
  evidence: string;
};

/**
 * Evidence-backed UzAuto VIN patterns. The evidence was supplied for release
 * item G-5 on 2026-09-25. Each row is the narrowest match that evidence
 * supports: the exact five-character VDS it was seen with. A car whose VDS
 * isn't listed decodes as unsupported rather than being guessed.
 *
 * Make/model are the catalogue's names, so the add-vehicle screen can resolve
 * them against the live reference tables. UzAuto has sold these cars as
 * Daewoo, Ravon and Chevrolet over the years; the catalogue files the whole
 * lineup under Chevrolet.
 *
 * `modelYears.from` is the model's first generation year in the bundled
 * catalogue (`UZ_GENERATIONS` in uz-vehicle-catalog.ts), unless the evidence
 * shows an earlier model year. Where the bundled catalogue has no generation
 * matching the live model, it is the earliest evidenced model year.
 */
export const UZAUTO_VIN_PATTERNS: readonly UzAutoVinPattern[] = [
  {
    vds: 'JF69V',
    make: 'Chevrolet',
    model: 'Cobalt',
    variant: 'Model code J,1JX69',
    bodyStyle: 'sedan',
    modelYears: [2013, null], // cobalt-p1 starts 2013
    evidence:
      'A VIN record for XWBJF69VJEA… (year code E) identifies a Chevrolet Cobalt, ' +
      'Model_code "J,1JX69".',
  },
  {
    vds: 'JA69V',
    make: 'Chevrolet',
    model: 'Cobalt',
    bodyStyle: 'sedan',
    modelYears: [2013, null], // cobalt-p1 starts 2013
    evidence:
      'A current export dataset lists many Cobalt body numbers in the XWBJA69V9S… ' +
      'family (year code S).',
  },
  {
    vds: '5V31B',
    make: 'Chevrolet',
    model: 'Gentra',
    variant: 'Daewoo / Ravon / Chevrolet Gentra',
    bodyStyle: 'sedan',
    modelYears: [2013, null], // gentra-1 starts 2013
    evidence:
      'Factory documentation contains XWB5V31BDEA… and names "5" as the ' +
      'model-type code.',
  },
  {
    vds: '7T11Z',
    make: 'Chevrolet',
    model: 'Damas',
    bodyStyle: 'van',
    modelYears: [1996, null], // damas-2 starts 1996
    evidence:
      'Factory parts documentation contains XWB7T11ZB3… and names "7" as the ' +
      'model-type code.',
  },
  {
    vds: 'MA481',
    make: 'Chevrolet',
    model: 'Spark',
    variant: 'Chevrolet / Ravon Spark',
    bodyStyle: 'hatchback',
    // The bundled catalogue only lists Spark M400 from 2015, but this pattern
    // is evidenced with year code C (2012), so the evidence sets the bound.
    modelYears: [2012, null],
    evidence:
      'Real UzAuto VINs XWBMA481JCA… (year code C) are independently identified ' +
      'as Chevrolet Spark.',
  },
  {
    vds: 'TF69V',
    make: 'Chevrolet',
    model: 'Nexia 3',
    variant: 'Ravon Nexia R3',
    bodyStyle: 'sedan',
    modelYears: [2017, null], // nexia-3 starts 2017
    evidence:
      'Real UzAuto VINs XWBTF69V9HA… (year code H) are independently identified ' +
      'as Ravon Nexia R3, the car the catalogue files as Chevrolet Nexia 3.',
  },
  {
    vds: 'UA765',
    make: 'Chevrolet',
    model: 'Tracker-2', // live model id; see `model` above
    bodyStyle: 'suv',
    // The bundled catalogue has no generation for the live `tracker-2` model,
    // so the evidence sets the bound: this pattern is evidenced for 2023 only.
    modelYears: [2023, null],
    evidence:
      'The VIN that failed the G-5 device smoke test, XWBUA7659P… (year code P), ' +
      'is a Chevrolet Tracker-2, model year 2023 per the vehicle documents.',
  },
];

/**
 * Pick the model year a position-10 code means for a given pattern. A code
 * names two years 30 apart (ISO 3779). Keep those inside the pattern's
 * `modelYears` and no later than next year. Exactly one must remain;
 * otherwise the year is undetermined and the caller must not guess.
 */
export function resolveModelYear(
  code: string,
  [from, to]: UzAutoVinPattern['modelYears'],
  now: Date,
): number | null {
  const cycle2010 = YEAR_CODES[code];
  if (cycle2010 === undefined) return null;
  const latest = Math.min(to ?? Number.POSITIVE_INFINITY, now.getFullYear() + 1);
  const fits = [cycle2010 - 30, cycle2010].filter((y) => y >= from && y <= latest);
  return fits.length === 1 ? fits[0] : null;
}

// ── Demo / QA scheme (WMI XUF) — synthetic, unchanged ────────────────────────

/** Demo world-manufacturer identifier. Not a real UzAuto WMI. */
const DEMO_WMIS = new Set(['XUF']);

type ModelDef = { slug: string; name: string; bodyStyle: UzVinDecode['bodyStyle'] };

/** Demo 2-char model code (VIN chars 4–5) → catalog model. Codes avoid I/O/Q. */
const DEMO_MODEL_CODES: Record<string, ModelDef> = {
  CB: { slug: 'cobalt', name: 'Cobalt', bodyStyle: 'sedan' },
  GN: { slug: 'gentra', name: 'Gentra', bodyStyle: 'sedan' },
  SP: { slug: 'spark', name: 'Spark', bodyStyle: 'hatchback' },
  NX: { slug: 'nexia', name: 'Nexia', bodyStyle: 'sedan' },
  TR: { slug: 'tracker', name: 'Tracker', bodyStyle: 'suv' },
  ML: { slug: 'malibu', name: 'Malibu', bodyStyle: 'sedan' },
  DM: { slug: 'damas', name: 'Damas', bodyStyle: 'van' },
  LC: { slug: 'lacetti', name: 'Lacetti', bodyStyle: 'sedan' },
};

function decodeDemoVin(vin: string): UzVinDecode | null {
  const model = DEMO_MODEL_CODES[vin.slice(3, 5)];
  if (!model) return null;
  return {
    vin,
    make: 'Chevrolet',
    makeId: 'make_chevrolet',
    model: model.name,
    modelId: `model_chevrolet_${model.slug}`,
    year: YEAR_CODES[vin[9]] ?? 0,
    bodyStyle: model.bodyStyle,
    fuelType: 'Petrol',
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

export type UzVinClassification =
  | { kind: 'decoded'; decode: UzVinDecode }
  /** A UzAuto VIN (WMI XWB) this table cannot decode: its VDS isn't listed
   *  (`model`) or its year code is ambiguous or out of range (`year`). */
  | { kind: 'unsupported'; reason: 'model' | 'year' }
  /** Not a UZ-market VIN — let another provider try. */
  | { kind: 'not-uz' };

/**
 * Classify a VIN against the UZ tables. `now` bounds the latest model year a
 * real pattern may decode to; tests pass a fixed date.
 */
export function classifyUzVin(rawVin: string, now: Date = new Date()): UzVinClassification {
  const vin = normalize(rawVin);
  if (vin.length !== 17) return { kind: 'not-uz' };
  const wmi = vin.slice(0, 3);

  if (wmi === UZAUTO_WMI) {
    const pattern = UZAUTO_VIN_PATTERNS.find((p) => p.vds === vin.slice(3, 8));
    if (!pattern) return { kind: 'unsupported', reason: 'model' };
    const year = resolveModelYear(vin[9], pattern.modelYears, now);
    if (year === null) return { kind: 'unsupported', reason: 'year' };
    return {
      kind: 'decoded',
      decode: { vin, make: pattern.make, model: pattern.model, year, bodyStyle: pattern.bodyStyle },
    };
  }

  if (DEMO_WMIS.has(wmi)) {
    const demo = decodeDemoVin(vin);
    // An unknown demo model code isn't a real UzAuto car either — hand it on.
    return demo ? { kind: 'decoded', decode: demo } : { kind: 'not-uz' };
  }

  return { kind: 'not-uz' };
}

/**
 * Decode a UZ-market VIN, or `null` when it can't be decoded here (not a UZ
 * VIN, or a UzAuto VIN outside the evidence table).
 */
export function decodeUzVin(rawVin: string, now: Date = new Date()): UzVinDecode | null {
  const result = classifyUzVin(rawVin, now);
  return result.kind === 'decoded' ? result.decode : null;
}

/** True when a VIN is a recognised UZ-market pattern. */
export function isUzVin(rawVin: string): boolean {
  return decodeUzVin(rawVin) !== null;
}

/**
 * Demo/QA fixtures for the synthetic `XUF` scheme — one per model, each a
 * shape-valid 17-char VIN (no I/O/Q) whose year code decodes to `year`.
 * Used by the QA suite and available for demo seeding. Not real VINs.
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
