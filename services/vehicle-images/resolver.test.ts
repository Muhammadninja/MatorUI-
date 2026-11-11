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
      { key: 'nexia-r3', bodyType: 'sedan', verified: true, assets: { white: R3_WHITE } },
      { key: 'tracker-gen3', bodyType: 'suv', verified: true, assets: { white: TRACKER3_WHITE } },
      { key: 'tracker-gen2', bodyType: 'suv', verified: true, assets: { white: TRACKER2_WHITE } },
      { key: 'gentra', bodyType: 'sedan', verified: true, assets: {} },
      { key: 'spark', bodyType: 'hatchback', verified: false, assets: {} },
    ],
    models: {
      ...CHEVROLET_IMAGE_MANIFEST.models,
      cobalt: { kind: 'trim-prefix', prefixes: { 'cobalt-p4-': 'cobalt-a' } },
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

  test('contains no images yet: every live model shows the neutral placeholder', () => {
    for (const modelId of LIVE_CHEVROLET_MODEL_IDS) {
      expect(resolveVehicleImage(chevy(modelId, { trimId: `${modelId}-x`, year: 2020, colorHex: '#F4F5F7' })).kind).toBe('placeholder');
    }
    expect(CHEVROLET_IMAGE_MANIFEST.bodies.every((b) => Object.keys(b.assets).length === 0)).toBe(true);
  });

  test('keeps the catalog problems on the placeholder', () => {
    expect(resolveVehicleImage(chevy('genrta-lacetti'))).toEqual({ kind: 'placeholder', reason: 'catalog-issue' });
    expect(resolveVehicleImage(chevy('nexia-2'))).toEqual({ kind: 'placeholder', reason: 'shared-body-unverified' });
    expect(resolveVehicleImage(chevy('nexia-3'))).toEqual({ kind: 'placeholder', reason: 'shared-body-unverified' });
    for (const trimId of ['cobalt-p1-elegant', 'cobalt-p2-premier', 'cobalt-p3-elegant', 'cobalt-p4-ltz', undefined]) {
      expect(resolveVehicleImage(chevy('cobalt', { trimId }))).toEqual({ kind: 'placeholder', reason: 'generation-unverified' });
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
      bodies: manifest.bodies.map((b) => (b.key === 'spark' ? { ...b, assets: { white: 999 } } : b)),
    };
    expect(resolveVehicleImage(chevy('spark'), unverified)).toEqual({ kind: 'placeholder', reason: 'body-unverified', bodyType: 'hatchback' });
    expect(validateManifest(unverified)).toContain('body "spark" has assets but is unverified');
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
    // The share is per body: Nexia 3 is still unresolved.
    expect(resolveVehicleImage(chevy('nexia-3'), manifest)).toMatchObject({ reason: 'shared-body-unverified' });
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
