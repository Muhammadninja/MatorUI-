import { describe, expect, test } from 'vitest';

import { CHEVROLET_IMAGE_MANIFEST, type VehicleImageManifest } from './manifest';
import { resolveVehicleImage, validateManifest } from './resolver';

/** The live Chevrolet model ids, `GET /v1/reference/models?makeId=chevrolet` on 2026-11-10. */
const LIVE_CHEVROLET_MODEL_IDS = [
  'cobalt', 'malibu', 'orlando', 'nexia', 'lacetti', 'gentra', 'tracker-2', 'spark', 'tracker',
  'nexia-3', 'captiva', 'onix', 'genrta-lacetti', 'damas', 'nexia-2', 'chevrolet-matiz', 'equinox',
  'traverse', 'tahoe', 'trailblazer', 'epica', 'labo', 'nexia-1', 'tacuma', 'cruze',
];

const chevy = (modelId: string, extra: Record<string, unknown> = {}) => ({ brandId: 'chevrolet', modelId, ...extra });

// Stand-ins for approved images (a bundled require() is a number).
const COBALT_IMG = 101;
const MALIBU1_WHITE = 201;
const MALIBU2_WHITE = 202;
const MALIBU2_RED = 203;
const N150_WHITE = 301;
const R3_WHITE = 302;
const TRACKER3_WHITE = 401;
const TRACKER2_WHITE = 402;

/** A manifest as it will look once some images are approved. */
function approvedFixture(): VehicleImageManifest {
  return {
    makeId: 'chevrolet',
    bodies: [
      { key: 'cobalt-a', bodyType: 'sedan', verified: true, assets: { white: COBALT_IMG } },
      { key: 'malibu-gen1', bodyType: 'sedan', verified: true, assets: { white: MALIBU1_WHITE } },
      { key: 'malibu-gen2', bodyType: 'sedan', verified: true, assets: { white: MALIBU2_WHITE, red: MALIBU2_RED } },
      { key: 'nexia-n150', bodyType: 'sedan', verified: true, assets: { white: N150_WHITE } },
      { key: 'nexia-r3', bodyType: 'sedan', verified: true, sharedBy: ['nexia-3'], assets: { white: R3_WHITE } },
      { key: 'tracker-gen3', bodyType: 'suv', verified: true, assets: { white: TRACKER3_WHITE } },
      { key: 'tracker-gen2', bodyType: 'suv', verified: true, assets: { white: TRACKER2_WHITE } },
      { key: 'gentra', bodyType: 'sedan', verified: true, assets: {} },
      { key: 'spark-m300', bodyType: 'hatchback', verified: false, assets: {} },
    ],
    models: {
      ...CHEVROLET_IMAGE_MANIFEST.models,
      cobalt: { kind: 'trim-prefix', prefixes: { 'cobalt-p4-': 'cobalt-a' } },
      // A plain trim-only rule: these fixture tests are about matching and
      // paint, not the real Malibu's facelift years.
      malibu: { kind: 'trim-prefix', prefixes: { 'malibu-1-': 'malibu-gen1', 'malibu-2-': 'malibu-gen2' } },
    },
  };
}

describe('the shipped Chevrolet manifest', () => {
  test('covers exactly the 25 live backend models, no more and no fewer', () => {
    expect(Object.keys(CHEVROLET_IMAGE_MANIFEST.models).sort()).toEqual([...LIVE_CHEVROLET_MODEL_IDS].sort());
  });

  test('is internally consistent', () => {
    expect(validateManifest(CHEVROLET_IMAGE_MANIFEST)).toEqual([]);
  });

  test('only the Cobalt, Gentra, Nexia 3, Spark and Malibu have images; every other live model shows the placeholder', () => {
    for (const modelId of LIVE_CHEVROLET_MODEL_IDS) {
      const result = resolveVehicleImage(chevy(modelId, { trimId: `${modelId}-x`, year: 2020, colorHex: '#F4F5F7' }));
      expect(result.kind).toBe(['cobalt', 'gentra', 'nexia-3', 'spark', 'malibu'].includes(modelId) ? 'image' : 'placeholder');
    }
    const withImages = CHEVROLET_IMAGE_MANIFEST.bodies.filter((b) => Object.keys(b.assets).length > 0);
    expect(withImages.map((b) => b.key)).toEqual(['cobalt-gen2', 'malibu-gen2-facelift', 'nexia-r3', 'gentra', 'spark-m300']);
  });

  test('every Cobalt trim, and a Cobalt with no or an unknown trim, is the one pre-restyle body', () => {
    for (const trimId of ['cobalt-p1-elegant', 'cobalt-p2-premier', 'cobalt-p3-elegant', 'cobalt-p4-ls', 'cobalt-p4-ltz', 'unknown', undefined]) {
      expect(resolveVehicleImage(chevy('cobalt', { trimId }))).toMatchObject({ kind: 'image', bodyKey: 'cobalt-gen2', paint: 'white' });
    }
  });

  test('a Cobalt in a colour without an approved image shows the white Cobalt, flagged as unmatched', () => {
    expect(resolveVehicleImage(chevy('cobalt', { colorHex: '#C42B2B' }))).toMatchObject({ bodyKey: 'cobalt-gen2', paint: 'white', paintMatched: false });
    expect(resolveVehicleImage(chevy('cobalt', { colorHex: '#F4F5F7' }))).toMatchObject({ paint: 'white', paintMatched: true });
  });

  test('keeps the catalog problems on the placeholder', () => {
    expect(resolveVehicleImage(chevy('genrta-lacetti'))).toEqual({ kind: 'placeholder', reason: 'catalog-issue' });
    expect(resolveVehicleImage(chevy('lacetti', { trimId: 'lacetti-sx', year: 2008 }))).toEqual({ kind: 'placeholder', reason: 'generation-unverified' });
    expect(resolveVehicleImage(chevy('nexia-2'))).toEqual({ kind: 'placeholder', reason: 'shared-body-unverified' });
  });

  test('Nexia 3 is one body for both backend records; Nexia generations never mix', () => {
    // Both records reach the same R3 image; the N150 (nexia-2-*) never does.
    expect(resolveVehicleImage(chevy('nexia-3'))).toMatchObject({ kind: 'image', bodyKey: 'nexia-r3' });
    expect(resolveVehicleImage(chevy('nexia', { trimId: 'nexia-3-ls' }))).toMatchObject({ kind: 'image', bodyKey: 'nexia-r3' });
    expect(resolveVehicleImage(chevy('nexia', { trimId: 'nexia-2-dlx' }))).toEqual({ kind: 'placeholder', reason: 'body-unverified', bodyType: 'sedan' });
    expect(resolveVehicleImage(chevy('nexia-1')).kind).toBe('placeholder');
    expect(resolveVehicleImage(chevy('nexia', { trimId: 'nexia-9-zz' }))).toEqual({ kind: 'placeholder', reason: 'generation-unverified' });
  });
});

describe('id schemes', () => {
  test('the demo/mock scheme resolves like the live ids: Cobalt 2019 LS AT and Gentra 2021 LTZ', () => {
    expect(resolveVehicleImage({ brandId: 'make_chevrolet', modelId: 'model_cobalt', trimId: 'trim_ls_at', year: 2019 }))
      .toMatchObject({ kind: 'image', bodyKey: 'cobalt-gen2' });
    expect(resolveVehicleImage({ brandId: 'make_chevrolet', modelId: 'model_gentra', trimId: 'trim_ltz', year: 2021 }))
      .toMatchObject({ kind: 'image', bodyKey: 'gentra' });
    expect(resolveVehicleImage({ brandId: 'make_chevrolet', modelId: 'model_chevrolet_cobalt' }))
      .toMatchObject({ kind: 'image', bodyKey: 'cobalt-gen2' });
  });

  test('Cobalt and Gentra show their image with a missing, unknown or foreign trim', () => {
    for (const modelId of ['cobalt', 'gentra']) {
      for (const trimId of [undefined, null, '', 'trim_ls_at', 'malibu-2-lt', 'nexia-3-ls']) {
        expect(resolveVehicleImage(chevy(modelId, { trimId })).kind).toBe('image');
      }
    }
  });

  test('normalising the scheme never maps one model to another', () => {
    expect(resolveVehicleImage({ brandId: 'make_chevrolet', modelId: 'model_lacetti' })).toMatchObject({ kind: 'placeholder' });
    // Only exact known shapes: no underscore-to-hyphen guessing, no foreign make segment.
    expect(resolveVehicleImage({ brandId: 'make_chevrolet', modelId: 'model_tracker_2' })).toEqual({ kind: 'placeholder', reason: 'unknown-model' });
    expect(resolveVehicleImage({ brandId: 'make_chevrolet', modelId: 'model_kia_cobalt' })).toEqual({ kind: 'placeholder', reason: 'unknown-model' });
    expect(resolveVehicleImage({ brandId: 'make_chevrolet', modelId: 'model_Cobalt' })).toEqual({ kind: 'placeholder', reason: 'unknown-model' });
    // The demo Tracker can't say which of the two live Trackers it is.
    expect(resolveVehicleImage({ brandId: 'make_chevrolet', modelId: 'model_chevrolet_tracker' })).toEqual({ kind: 'placeholder', reason: 'unknown-model' });
    expect(resolveVehicleImage({ brandId: 'make_chevrolet', modelId: 'model_nexia', trimId: 'trim_ls' })).toEqual({ kind: 'placeholder', reason: 'generation-unverified' });
    expect(resolveVehicleImage({ brandId: 'make_kia', modelId: 'model_cobalt' })).toEqual({ kind: 'placeholder', reason: 'unsupported-make' });
    expect(resolveVehicleImage({ brandId: 'chevrolet_make', modelId: 'cobalt' })).toEqual({ kind: 'placeholder', reason: 'unsupported-make' });
  });
});

describe('Spark M300', () => {
  test('every Spark record shows the M300 image, whatever its trim id says (the backend mislabels it M400)', () => {
    for (const trimId of ['spark-m400-ls', undefined, 'unknown']) {
      expect(resolveVehicleImage(chevy('spark', { trimId }))).toMatchObject({ kind: 'image', bodyKey: 'spark-m300' });
    }
    expect(resolveVehicleImage({ brandId: 'make_chevrolet', modelId: 'model_chevrolet_spark' })).toMatchObject({ bodyKey: 'spark-m300' });
  });

  test('the Spark image never appears for the other small cars', () => {
    for (const modelId of ['chevrolet-matiz', 'damas', 'labo', 'nexia-1']) {
      const r = resolveVehicleImage(chevy(modelId));
      expect(r.kind === 'image' && r.bodyKey === 'spark-m300').toBe(false);
    }
  });
});

describe('years and trims that do not change the exterior', () => {
  const malibu = (extra: Record<string, unknown>) => resolveVehicleImage(chevy('malibu', extra));

  test('a facelift Malibu shows its image for 2020 onwards, with any or no trim', () => {
    for (const year of [2020, 2022, 2024]) {
      for (const trimId of [undefined, '', 'malibu-2-lt', 'malibu-2-premier', 'trim_ltz', 'unknown']) {
        expect(malibu({ year, trimId })).toMatchObject({ kind: 'image', bodyKey: 'malibu-gen2-facelift' });
      }
    }
  });

  test('2019 is ambiguous in Uzbekistan (both fronts were sold), so it stays the silhouette', () => {
    expect(malibu({ year: 2019 })).toEqual({ kind: 'placeholder', reason: 'generation-unverified' });
    expect(malibu({ year: 2019, trimId: 'malibu-2-lt' })).toEqual({ kind: 'placeholder', reason: 'generation-unverified' });
  });

  test('the pre-facelift Malibu 2 and Malibu 1 never borrow the facelift image', () => {
    expect(malibu({ year: 2017, trimId: 'malibu-2-lt' })).toEqual({ kind: 'placeholder', reason: 'body-unverified', bodyType: 'sedan' });
    expect(malibu({ year: 2017 })).toEqual({ kind: 'placeholder', reason: 'generation-unverified' });
    // The trim names the generation; the year can't move a Malibu 1 onto the newer body.
    expect(malibu({ year: 2022, trimId: 'malibu-1-ltz' })).toEqual({ kind: 'placeholder', reason: 'body-unverified', bodyType: 'sedan' });
    expect(malibu({})).toEqual({ kind: 'placeholder', reason: 'generation-unverified' });
  });

  test('a saved colour keeps the white facelift image, flagged as unmatched', () => {
    expect(malibu({ year: 2022, colorHex: '#14161A' })).toMatchObject({ bodyKey: 'malibu-gen2-facelift', paint: 'white', paintMatched: false });
    expect(malibu({ year: 2022, colorHex: '#F4F5F7' })).toMatchObject({ paint: 'white', paintMatched: true });
  });

  test('Cobalt, Gentra and Nexia 3 resolve across every year', () => {
    for (let year = 2013; year <= 2026; year++) {
      expect(resolveVehicleImage(chevy('cobalt', { year }))).toMatchObject({ bodyKey: 'cobalt-gen2' });
      expect(resolveVehicleImage(chevy('gentra', { year }))).toMatchObject({ bodyKey: 'gentra' });
      expect(resolveVehicleImage(chevy('nexia-3', { year }))).toMatchObject({ bodyKey: 'nexia-r3' });
    }
  });

  test('the two Trackers never share an image, and unknown models stay unknown', () => {
    expect(resolveVehicleImage(chevy('tracker', { year: 2023 })).kind).toBe('placeholder');
    expect(resolveVehicleImage(chevy('tracker-2', { year: 2018 })).kind).toBe('placeholder');
    expect(resolveVehicleImage(chevy('malibu-3', { year: 2022 }))).toEqual({ kind: 'placeholder', reason: 'unknown-model' });
  });

  test('the Malibu image never leaks to another model', () => {
    for (const modelId of LIVE_CHEVROLET_MODEL_IDS.filter((id) => id !== 'malibu')) {
      for (const trimId of ['malibu-2-lt', undefined]) {
        const r = resolveVehicleImage(chevy(modelId, { trimId, year: 2022 }));
        expect(r.kind === 'image' && r.bodyKey === 'malibu-gen2-facelift').toBe(false);
      }
    }
  });
});

describe('strict model matching', () => {
  const manifest = approvedFixture();

  test('needs the exact make id', () => {
    expect(resolveVehicleImage({ brandId: 'daewoo', modelId: 'nexia', trimId: 'nexia-3-ls' }, manifest).kind).toBe('placeholder');
    expect(resolveVehicleImage({ modelId: 'tracker' }, manifest)).toEqual({ kind: 'placeholder', reason: 'unsupported-make' });
  });

  test('never matches by display name', () => {
    expect(resolveVehicleImage(chevy('Tracker'), manifest)).toEqual({ kind: 'placeholder', reason: 'unknown-model' });
    expect(resolveVehicleImage(chevy('Nexia 3'), manifest)).toEqual({ kind: 'placeholder', reason: 'unknown-model' });
  });

  test('keeps the two "Tracker" records apart', () => {
    expect(resolveVehicleImage(chevy('tracker'), manifest)).toMatchObject({ bodyKey: 'tracker-gen3', source: TRACKER3_WHITE });
    expect(resolveVehicleImage(chevy('tracker-2'), manifest)).toMatchObject({ bodyKey: 'tracker-gen2', source: TRACKER2_WHITE });
  });

  test('picks the generation from the backend trim id', () => {
    expect(resolveVehicleImage(chevy('malibu', { trimId: 'malibu-1-ltz' }), manifest)).toMatchObject({ bodyKey: 'malibu-gen1' });
    expect(resolveVehicleImage(chevy('malibu', { trimId: 'malibu-2-premier' }), manifest)).toMatchObject({ bodyKey: 'malibu-gen2' });
    expect(resolveVehicleImage(chevy('nexia', { trimId: 'nexia-2-dlx' }), manifest)).toMatchObject({ bodyKey: 'nexia-n150' });
    expect(resolveVehicleImage(chevy('nexia', { trimId: 'nexia-3-lt' }), manifest)).toMatchObject({ bodyKey: 'nexia-r3' });
  });

  test('without a trim, or with another model\'s trim, the generation is unknown', () => {
    for (const input of [chevy('malibu'), chevy('malibu', { year: 2014 }), chevy('malibu', { trimId: 'nexia-3-ls' }), chevy('nexia', { year: 2018 })]) {
      expect(resolveVehicleImage(input, manifest)).toEqual({ kind: 'placeholder', reason: 'generation-unverified' });
    }
  });

  test('uses a year only inside a verified, sourced, unambiguous range', () => {
    const withYears = (years: { from: number; to: number; bodyKey: string; source: string }[]): VehicleImageManifest => ({
      ...manifest,
      models: { ...manifest.models, malibu: { kind: 'trim-prefix', prefixes: {}, years } },
    });
    const sourced = withYears([
      { from: 2012, to: 2015, bodyKey: 'malibu-gen1', source: 'dated press photos' },
      { from: 2016, to: 2030, bodyKey: 'malibu-gen2', source: 'dated press photos' },
    ]);
    expect(resolveVehicleImage(chevy('malibu', { year: 2014 }), sourced)).toMatchObject({ bodyKey: 'malibu-gen1' });
    expect(resolveVehicleImage(chevy('malibu', { year: 2011 }), sourced)).toMatchObject({ reason: 'generation-unverified' });

    const overlapping = withYears([
      { from: 2012, to: 2016, bodyKey: 'malibu-gen1', source: 'a' },
      { from: 2016, to: 2030, bodyKey: 'malibu-gen2', source: 'b' },
    ]);
    expect(resolveVehicleImage(chevy('malibu', { year: 2016 }), overlapping)).toMatchObject({ reason: 'generation-unverified' });

    const unsourced = withYears([{ from: 2012, to: 2015, bodyKey: 'malibu-gen1', source: ' ' }]);
    expect(resolveVehicleImage(chevy('malibu', { year: 2014 }), unsourced)).toMatchObject({ reason: 'generation-unverified' });
  });

  test('a body that is not verified is never shown, even with an image', () => {
    const unverified: VehicleImageManifest = {
      ...manifest,
      bodies: manifest.bodies.map((b) => (b.key === 'spark-m300' ? { ...b, assets: { white: 999 } } : b)),
    };
    expect(resolveVehicleImage(chevy('spark'), unverified)).toEqual({ kind: 'placeholder', reason: 'body-unverified', bodyType: 'hatchback' });
    expect(validateManifest(unverified)).toContain('body "spark-m300" has assets but is unverified');
  });

  test('a verified body without an image is the placeholder, with its body type', () => {
    expect(resolveVehicleImage(chevy('gentra'), manifest)).toEqual({ kind: 'placeholder', reason: 'asset-missing', bodyType: 'sedan' });
  });
});

describe('the Cobalt image', () => {
  test('is never shown for any other model, trim or colour', () => {
    const manifest = approvedFixture();
    const trims = ['', 'cobalt-p4-ls', 'malibu-2-lt', 'nexia-3-ls', 'nexia-2-base'];
    for (const modelId of LIVE_CHEVROLET_MODEL_IDS.filter((id) => id !== 'cobalt')) {
      for (const trimId of trims) {
        const result = resolveVehicleImage(chevy(modelId, { trimId, colorHex: '#F4F5F7', year: 2023 }), manifest);
        if (result.kind === 'image') expect(result.source).not.toBe(COBALT_IMG);
      }
    }
    expect(resolveVehicleImage(chevy('cobalt', { trimId: 'cobalt-p4-ltz' }), manifest)).toMatchObject({ source: COBALT_IMG });
    expect(resolveVehicleImage(chevy('cobalt', { trimId: 'cobalt-p1-elegant' }), manifest).kind).toBe('placeholder');
  });
});

describe('shared bodies', () => {
  const sharing = (sharedBy?: string[]): VehicleImageManifest => {
    const base = approvedFixture();
    return {
      ...base,
      bodies: base.bodies.map((b) => (b.key === 'nexia-n150' ? { ...b, ...(sharedBy ? { sharedBy } : {}) } : b)),
      models: { ...base.models, 'nexia-2': { kind: 'body', bodyKey: 'nexia-n150' } },
    };
  };

  test('two models on one body without a verified share both get the placeholder', () => {
    const manifest = sharing();
    expect(resolveVehicleImage(chevy('nexia-2'), manifest)).toMatchObject({ reason: 'shared-body-unverified' });
    expect(resolveVehicleImage(chevy('nexia', { trimId: 'nexia-2-base' }), manifest)).toMatchObject({ reason: 'shared-body-unverified' });
    expect(validateManifest(manifest)).toContain('body "nexia-n150" is used by nexia, nexia-2 without a verified sharedBy');
  });

  test('a verified share lets both records use the body', () => {
    const manifest = sharing(['nexia-2']);
    // The fixture defines only some bodies; the share itself must be valid.
    expect(validateManifest(manifest).filter((p) => p.includes('nexia-n150'))).toEqual([]);
    expect(resolveVehicleImage(chevy('nexia-2'), manifest)).toMatchObject({ bodyKey: 'nexia-n150', source: N150_WHITE });
    expect(resolveVehicleImage(chevy('nexia', { trimId: 'nexia-2-base' }), manifest)).toMatchObject({ bodyKey: 'nexia-n150' });
    // Shares are per body: Nexia 3 reaches the R3 through its own approved share, never the N150.
    expect(resolveVehicleImage(chevy('nexia-3'), manifest)).toMatchObject({ bodyKey: 'nexia-r3', source: R3_WHITE });
  });
});

describe('paint', () => {
  const manifest = approvedFixture();
  const malibu2 = (colorHex?: string | null) => resolveVehicleImage(chevy('malibu', { trimId: 'malibu-2-lt', colorHex }), manifest);

  test('shows the stored colour when that paint has an approved image', () => {
    expect(malibu2('#C42B2B')).toMatchObject({ paint: 'red', paintMatched: true, source: MALIBU2_RED });
    expect(malibu2('#c83030')).toMatchObject({ paint: 'red', paintMatched: true });
  });

  test('falls back to white, and says so, when the paint has no image', () => {
    expect(malibu2('#2456C8')).toMatchObject({ paint: 'white', paintMatched: false, source: MALIBU2_WHITE });
  });

  test('a white car is a matched white image', () => {
    expect(malibu2('#F4F5F7')).toMatchObject({ paint: 'white', paintMatched: true });
    expect(malibu2('#fff')).toMatchObject({ paint: 'white', paintMatched: true });
  });

  test('no colour, a malformed colour, or a colour nowhere near a paint shows white, never black', () => {
    for (const hex of [undefined, null, '', '#ZZZZZZ', 'red', '#7B3FA0']) {
      expect(malibu2(hex)).toMatchObject({ paint: 'white', paintMatched: false, source: MALIBU2_WHITE });
    }
  });

  test('colour images without a white base are rejected by validation', () => {
    const bad: VehicleImageManifest = {
      ...manifest,
      bodies: manifest.bodies.map((b) => (b.key === 'gentra' ? { ...b, assets: { red: 1 } } : b)),
    };
    expect(validateManifest(bad)).toContain('body "gentra" has colour images but no white base');
  });
});
