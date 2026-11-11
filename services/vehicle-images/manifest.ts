import type { PaintKey } from './paint';

/**
 * Vehicle image manifest: which approved image a Garage vehicle shows. Data
 * only. Mapping lives here and nowhere else, and nothing in compatibility,
 * cart or checkout reads it.
 *
 * Keys are the backend's own ids (`GET /v1/reference/models?makeId=chevrolet`,
 * `GET /v1/reference/trims?modelId=…`, read 2026-11-10). Nothing is matched by
 * display name: two live models are both called "Tracker".
 *
 * A body is one physical exterior (model + generation). An image appears only
 * when its body's identity is `verified` AND an approved asset is listed. Until
 * then the resolver answers with a neutral placeholder. A body served by more
 * than one backend model must say so in `sharedBy`, with a verified match.
 *
 * See docs/vehicle-images/chevrolet-asset-matrix.md.
 */

export type BodyType = 'sedan' | 'hatchback' | 'suv' | 'mpv' | 'microvan' | 'pickup';

/** A bundled `require()` or a remote URL (Cloudinary, sized by the client). */
export type VehicleImageSource = number | { uri: string };

export type VehicleBody = {
  /** `{model}-{generation}`, lowercase kebab, e.g. `nexia-r3`, `malibu-gen2`. */
  key: string;
  bodyType: BodyType;
  /** Identity checked against dated reference photos. False = never shown. */
  verified: boolean;
  /** Other backend model ids allowed to use this body. Each entry is a
   *  verified, owner-approved match, never a guess. */
  sharedBy?: string[];
  /** Approved images only, by paint. White comes first. */
  assets: Partial<Record<PaintKey, VehicleImageSource>>;
  note?: string;
};

/** A year range used to pick a generation. Only `verified` ranges with a
 *  cited source are ever used; none qualify yet (owner decision 4). */
export type VerifiedYearRange = { from: number; to: number; bodyKey: string; source: string };

export type ModelRule =
  /** Every record of this model is one body. */
  | { kind: 'body'; bodyKey: string }
  /** The generation is encoded in the backend trim id (`malibu-2-lt`). */
  | { kind: 'trim-prefix'; prefixes: Record<string, string>; years?: VerifiedYearRange[] }
  /** Known, deliberately unresolved: always the neutral placeholder. */
  | { kind: 'placeholder'; reason: PlaceholderReason };

export type PlaceholderReason =
  | 'unsupported-make'
  | 'unknown-model'
  | 'catalog-issue'
  | 'generation-unverified'
  | 'shared-body-unverified'
  | 'body-unverified'
  | 'asset-missing';

export type VehicleImageManifest = {
  makeId: string;
  bodies: VehicleBody[];
  models: Record<string, ModelRule>;
};

const body = (
  key: string,
  bodyType: BodyType,
  note?: string,
): VehicleBody => ({ key, bodyType, verified: false, assets: {}, ...(note ? { note } : {}) });

/**
 * Chevrolet, all 25 live models. No image is approved yet, so every vehicle
 * resolves to the placeholder. The Explore hero's Cobalt image is the approved
 * marketing artwork and is deliberately NOT listed here (see `cobalt` below).
 */
export const CHEVROLET_IMAGE_MANIFEST: VehicleImageManifest = {
  makeId: 'chevrolet',
  bodies: [
    body('malibu-gen1', 'sedan', 'Backend trims malibu-1-*.'),
    body('malibu-gen2', 'sedan', 'Backend trims malibu-2-*.'),
    body('nexia-n150', 'sedan', 'Backend model `nexia` with trims nexia-2-*.'),
    body('nexia-r3', 'sedan', 'Backend model `nexia` with trims nexia-3-*; sold as Ravon Nexia R3.'),
    body('nexia-n100', 'sedan', 'Backend model `nexia-1`.'),
    body('lacetti-j200', 'sedan'),
    body('gentra', 'sedan', 'Kept apart from Lacetti (owner decision 3).'),
    body('spark', 'hatchback', 'Generation unverified: backend trim says M400.'),
    body('tracker-gen3', 'suv', 'Backend model `tracker` (trim tracker-3-premier).'),
    body('tracker-gen2', 'suv', 'Backend model `tracker-2`; same display name as `tracker`.'),
    body('captiva', 'suv', 'Which Captiva body "Captiva 5" is: unverified.'),
    body('onix', 'sedan', 'Trim is onix-1-premier; local catalog says 2020+. Unverified.'),
    body('damas', 'microvan'),
    body('labo', 'pickup', 'Shares the Damas cab, but the bed shows in a 3/4 view: own image.'),
    body('matiz', 'hatchback', 'Generation unverified.'),
    body('orlando', 'mpv'),
    body('cruze', 'sedan', 'Generation unverified.'),
    body('epica', 'sedan'),
    body('tacuma', 'mpv'),
    body('equinox', 'suv', 'Generation unverified.'),
    body('traverse', 'suv', 'Generation unverified.'),
    body('tahoe', 'suv', 'Generation unverified.'),
    body('trailblazer', 'suv', 'Two very different vehicles share the name: unverified.'),
  ],
  models: {
    // "Position 1–4" may be equipment levels, and a front restyle was announced
    // for late 2025 / early 2026. Not resolved until the exteriors are verified
    // (owner decision 2), so the hero's Cobalt image is not reused here.
    cobalt: { kind: 'placeholder', reason: 'generation-unverified' },
    malibu: { kind: 'trim-prefix', prefixes: { 'malibu-1-': 'malibu-gen1', 'malibu-2-': 'malibu-gen2' } },
    nexia: { kind: 'trim-prefix', prefixes: { 'nexia-2-': 'nexia-n150', 'nexia-3-': 'nexia-r3' } },
    // Separate records for the same names; sharing nexia-n150 / nexia-r3 needs
    // a verified match first (owner decision 2).
    'nexia-1': { kind: 'body', bodyKey: 'nexia-n100' },
    'nexia-2': { kind: 'placeholder', reason: 'shared-body-unverified' },
    'nexia-3': { kind: 'placeholder', reason: 'shared-body-unverified' },
    lacetti: { kind: 'body', bodyKey: 'lacetti-j200' },
    gentra: { kind: 'body', bodyKey: 'gentra' },
    // Misspelled "Genrta", no trims (owner decision 1).
    'genrta-lacetti': { kind: 'placeholder', reason: 'catalog-issue' },
    spark: { kind: 'body', bodyKey: 'spark' },
    tracker: { kind: 'body', bodyKey: 'tracker-gen3' },
    'tracker-2': { kind: 'body', bodyKey: 'tracker-gen2' },
    captiva: { kind: 'body', bodyKey: 'captiva' },
    onix: { kind: 'body', bodyKey: 'onix' },
    damas: { kind: 'body', bodyKey: 'damas' },
    labo: { kind: 'body', bodyKey: 'labo' },
    'chevrolet-matiz': { kind: 'body', bodyKey: 'matiz' },
    orlando: { kind: 'body', bodyKey: 'orlando' },
    cruze: { kind: 'body', bodyKey: 'cruze' },
    epica: { kind: 'body', bodyKey: 'epica' },
    tacuma: { kind: 'body', bodyKey: 'tacuma' },
    equinox: { kind: 'body', bodyKey: 'equinox' },
    traverse: { kind: 'body', bodyKey: 'traverse' },
    tahoe: { kind: 'body', bodyKey: 'tahoe' },
    trailblazer: { kind: 'body', bodyKey: 'trailblazer' },
  },
};
