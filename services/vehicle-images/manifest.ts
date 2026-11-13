import cobaltGen2White from '@/assets/vehicles/chevrolet/cobalt-gen2/white.webp';
import gentraWhite from '@/assets/vehicles/chevrolet/gentra/white.webp';
import nexiaR3White from '@/assets/vehicles/chevrolet/nexia-r3/white.webp';

import { approvedCatalogAssetForBody } from './catalog';
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
  /** The generation is encoded in the backend trim id (`malibu-2-lt`). A
   *  prefix names one body, or verified year ranges when the generation had a
   *  facelift. `years` resolves a record with no (or an unrecognised) trim. */
  | { kind: 'trim-prefix'; prefixes: Record<string, string | VerifiedYearRange[]>; years?: VerifiedYearRange[] }
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

/** UzAuto's facelifted Malibu went on sale in August–September 2019
 *  (kun.uz/en/news/2019/08/16, spot.uz/ru/2019/08/16/malibu); GM's global
 *  facelift is model year 2019. Asset matrix section 18. */
const MALIBU_FACELIFT_SOURCE = 'UzAuto Malibu facelift sales Aug-Sep 2019 (Kun.uz, Spot.uz)';

/** UzAuto built the J200 Lacetti until 2013, sold the car as (Ravon) Gentra,
 *  and brought back the Chevrolet Lacetti name for it in 2020. */
const LACETTI_SOURCE = 'UzAuto: Lacetti J200 to 2013; Gentra renamed Chevrolet Lacetti in 2020';

const body = (
  key: string,
  bodyType: BodyType,
  note?: string,
): VehicleBody => ({ key, bodyType, verified: false, assets: {}, ...(note ? { note } : {}) });

const approvedBody = (
  key: string,
  bodyType: BodyType,
  source: VehicleImageSource,
  note?: string,
  sharedBy?: string[],
): VehicleBody => {
  if (!approvedCatalogAssetForBody(key)) return body(key, bodyType, note ?? 'Catalog approval is missing; using the placeholder.');
  return {
    key,
    bodyType,
    verified: true,
    ...(sharedBy ? { sharedBy } : {}),
    assets: { white: source },
    ...(note ? { note } : {}),
  };
};

/**
 * Chevrolet, all 25 live models. Only bodies with explicit owner approval
 * have assets here. Pending previews remain on disk but are not bundled or
 * returned by the Garage resolver. The Explore hero keeps its own decorative
 * copy of the Cobalt artwork.
 */
export const CHEVROLET_IMAGE_MANIFEST: VehicleImageManifest = {
  makeId: 'chevrolet',
  bodies: [
    approvedBody(
      'cobalt-gen2',
      'sedan',
      cobaltGen2White,
      undefined,
    ),
    body('malibu-gen1', 'sedan', 'Backend trims malibu-1-*; image awaits owner approval.'),
    body('malibu-gen2', 'sedan', '9th generation before its facelift: 2016–2018 in Uzbekistan.'),
    body('malibu-gen2-facelift', 'sedan', '9th generation facelift; image awaits owner approval.'),
    // Nexia 2 image is intentionally unresolved until its candidate and shared-body
    // mapping receive explicit owner approval. Keep the existing placeholder.
    body('nexia-n150', 'sedan', 'Image pending explicit owner approval.'),
    approvedBody(
      'nexia-r3',
      'sedan',
      nexiaR3White,
      'Backend model `nexia` with trims nexia-3-*; sold as Ravon Nexia R3.',
      ['nexia-3'],
    ),
    body('nexia-n100', 'sedan', 'Image awaits owner approval.'),
    body('lacetti-j200', 'sedan', 'Image awaits owner approval.'),
    approvedBody(
      'gentra',
      'sedan',
      gentraWhite,
      'Kept apart from Lacetti; 2020+ Uzbekistan Lacetti alias is the same verified body.',
      ['lacetti'],
    ),
    body('spark-m300', 'hatchback', 'Uzbek Spark is the M300; image awaits owner approval.'),
    body('tracker-gen3', 'suv', 'Backend model `tracker`; image awaits owner approval.'),
    body('tracker-gen2', 'suv', 'Backend model `tracker-2`; same display name as `tracker`.'),
    body('captiva', 'suv', 'Image awaits owner approval.'),
    body('onix', 'sedan', 'Image awaits owner approval.'),
    body('damas-classic', 'microvan', 'Image awaits owner approval.'),
    body('labo', 'pickup', 'Image awaits owner approval.'),
    body('matiz', 'hatchback', 'Image awaits owner approval.'),
    body('orlando', 'mpv', 'Image awaits owner approval.'),
    body('cruze', 'sedan', 'Generation unverified.'),
    body('epica', 'sedan', 'Image awaits owner approval.'),
    body('tacuma', 'mpv'),
    body('equinox', 'suv', 'Image awaits owner approval.'),
    body('traverse', 'suv', 'Image awaits owner approval.'),
    body('tahoe', 'suv', 'Image awaits owner approval.'),
    body('trailblazer', 'suv', 'Image awaits owner approval.'),
  ],
  models: {
    cobalt: { kind: 'body', bodyKey: 'cobalt-gen2' },
    // Facelift on sale in Uzbekistan from Aug–Sep 2019; the pre-facelift car was
    // still sold earlier that year, so model year 2019 stays unresolved.
    malibu: {
      kind: 'trim-prefix',
      prefixes: {
        'malibu-1-': 'malibu-gen1',
        'malibu-2-': [
          { from: 2016, to: 2018, bodyKey: 'malibu-gen2', source: MALIBU_FACELIFT_SOURCE },
          { from: 2020, to: 2099, bodyKey: 'malibu-gen2-facelift', source: MALIBU_FACELIFT_SOURCE },
        ],
      },
      years: [{ from: 2020, to: 2099, bodyKey: 'malibu-gen2-facelift', source: MALIBU_FACELIFT_SOURCE }],
    },
    nexia: { kind: 'trim-prefix', prefixes: { 'nexia-2-': 'nexia-n150', 'nexia-3-': 'nexia-r3' } },
    'nexia-1': { kind: 'body', bodyKey: 'nexia-n100' },
    'nexia-2': { kind: 'placeholder', reason: 'body-unverified' },
    'nexia-3': { kind: 'body', bodyKey: 'nexia-r3' },
    // The 2004–13 sedan or a 2020+ "Lacetti", which is a Gentra body. Only the
    // year decides; 2014–2019 (sold as Gentra) stays unresolved.
    lacetti: {
      kind: 'trim-prefix',
      prefixes: {},
      years: [
        { from: 2004, to: 2013, bodyKey: 'lacetti-j200', source: LACETTI_SOURCE },
        { from: 2020, to: 2099, bodyKey: 'gentra', source: LACETTI_SOURCE },
      ],
    },
    gentra: { kind: 'body', bodyKey: 'gentra' },
    // Misspelled "Genrta", no trims (owner decision 1).
    'genrta-lacetti': { kind: 'placeholder', reason: 'catalog-issue' },
    spark: { kind: 'body', bodyKey: 'spark-m300' },
    tracker: { kind: 'body', bodyKey: 'tracker-gen3' },
    'tracker-2': { kind: 'body', bodyKey: 'tracker-gen2' },
    captiva: { kind: 'body', bodyKey: 'captiva' },
    onix: { kind: 'body', bodyKey: 'onix' },
    damas: { kind: 'body', bodyKey: 'damas-classic' },
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
