import cobaltGen2White from '@/assets/vehicles/chevrolet/cobalt-gen2/white.webp';
import gentraWhite from '@/assets/vehicles/chevrolet/gentra/white.webp';
import malibuGen2FaceliftWhite from '@/assets/vehicles/chevrolet/malibu-gen2-facelift/white.webp';
import nexiaR3White from '@/assets/vehicles/chevrolet/nexia-r3/white.webp';
import sparkM300White from '@/assets/vehicles/chevrolet/spark-m300/white.webp';

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

const body = (
  key: string,
  bodyType: BodyType,
  note?: string,
): VehicleBody => ({ key, bodyType, verified: false, assets: {}, ...(note ? { note } : {}) });

/**
 * Chevrolet, all 25 live models. Only the Cobalt, Gentra, Nexia 3, Spark and Malibu (facelift) have images; every
 * other vehicle resolves to the placeholder until its image is approved. The
 * Explore hero keeps its own decorative copy of the Cobalt artwork.
 */
export const CHEVROLET_IMAGE_MANIFEST: VehicleImageManifest = {
  makeId: 'chevrolet',
  bodies: [
    {
      key: 'cobalt-gen2',
      bodyType: 'sedan',
      // Owner-approved body: the pre-restyle exterior sold since 2013. "Positions"
      // are equipment levels, so every Cobalt trim shares it. Midnight and the
      // announced restyle are out of scope (section 11 of the asset matrix).
      verified: true,
      assets: { white: cobaltGen2White },
    },
    body('malibu-gen1', 'sedan', 'Backend trims malibu-1-*.'),
    body('malibu-gen2', 'sedan', '9th generation before its facelift: 2016–2018 in Uzbekistan.'),
    {
      ...body('malibu-gen2-facelift', 'sedan', '9th generation facelift (new grille, lamps, bumper).'),
      // PREVIEW, pending owner approval: owner-supplied candidate, Vision subject lift (section 18).
      verified: true,
      assets: { white: malibuGen2FaceliftWhite },
    },
    body('nexia-n150', 'sedan', 'Backend model `nexia` with trims nexia-2-*.'),
    {
      ...body('nexia-r3', 'sedan', 'Backend model `nexia` with trims nexia-3-*; sold as Ravon Nexia R3.'),
      // Same car as the separate "Nexia 3" record (Aveo T250 sedan; section 11).
      sharedBy: ['nexia-3'],
      // Owner-approved 2026-11-10: replacement candidate, Vision subject lift (section 15).
      verified: true,
      assets: { white: nexiaR3White },
    },
    body('nexia-n100', 'sedan', 'Backend model `nexia-1`.'),
    body('lacetti-j200', 'sedan'),
    {
      ...body('gentra', 'sedan', 'Kept apart from Lacetti (owner decision 3).'),
      // Owner-approved 2026-11-10. Cut out with Vision subject lift + edge refinement (section 14).
      verified: true,
      assets: { white: gentraWhite },
    },
    {
      ...body('spark-m300', 'hatchback', 'Uzbek Spark is the M300 (Ravon R2); the backend trim id says M400.'),
      // PREVIEW, pending owner approval: owner-supplied cutout with real alpha (section 16).
      verified: true,
      assets: { white: sparkM300White },
    },
    body('tracker-gen3', 'suv', 'Backend model `tracker` (trim tracker-3-premier).'),
    body('tracker-gen2', 'suv', 'Backend model `tracker-2`; same display name as `tracker`.'),
    body('captiva', 'suv', 'Which Captiva body "Captiva 5" is: unverified.'),
    body('onix', 'sedan', 'Trim is onix-1-premier; local catalog says 2020+. Unverified.'),
    body('damas-classic', 'microvan', 'Classic passenger Damas; not the 2025 Damas Move/Max.'),
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
    // Not yet verified as the same car as `nexia` + nexia-2-* trims.
    'nexia-2': { kind: 'placeholder', reason: 'shared-body-unverified' },
    'nexia-3': { kind: 'body', bodyKey: 'nexia-r3' },
    // Can be the 2004–13 sedan or a 2020+ "Lacetti", which is a Gentra body.
    lacetti: { kind: 'placeholder', reason: 'generation-unverified' },
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
