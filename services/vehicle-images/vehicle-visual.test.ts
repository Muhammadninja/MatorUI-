import { describe, expect, test } from 'vitest';

import { parseVehicleImage } from './image-status';
import { resolveVehicleImage } from './resolver';
import { chooseVehicleVisual } from './vehicle-visual';

const BUNDLED = { kind: 'image', bodyKey: 'cobalt', bodyType: 'sedan', paint: 'white', paintMatched: true, source: 42 } as never;
const NONE = { kind: 'placeholder', reason: 'unknown-model' } as never;
const URL = 'https://res.cloudinary.com/mator/vehicle-images/k/v1.webp';

describe('chooseVehicleVisual', () => {
  test('approved backend image wins, by url', () => {
    expect(chooseVehicleVisual(NONE, { status: 'approved', url: URL, version: 1 })).toEqual({
      kind: 'image',
      source: { uri: URL },
    });
    expect(chooseVehicleVisual(BUNDLED, { status: 'approved', url: URL, version: 1 })).toEqual({
      kind: 'image',
      source: { uri: URL },
    });
  });

  test('an explicitly approved bundled catalog image remains the fallback while backend sync is pending', () => {
    expect(chooseVehicleVisual(BUNDLED, { status: 'pending', url: null, version: null })).toEqual({
      kind: 'image',
      source: 42,
    });
  });

  test('pending → preparing placeholder; unavailable → unavailable placeholder', () => {
    expect(chooseVehicleVisual(NONE, { status: 'pending', url: null, version: null })).toEqual({
      kind: 'placeholder',
      status: 'pending',
    });
    expect(chooseVehicleVisual(NONE, { status: 'unavailable', url: null, version: null })).toEqual({
      kind: 'placeholder',
      status: 'unavailable',
    });
  });

  test('no backend field (older backend) keeps the existing placeholder', () => {
    expect(chooseVehicleVisual(NONE, undefined)).toEqual({ kind: 'placeholder' });
  });

  test.each([
    ['cobalt', 2024, 'cobalt-gen2'],
    ['gentra', 2020, 'gentra'],
    ['nexia-3', 2018, 'nexia-r3'],
  ])('the backend catalog key selects the matching approved %s asset', (modelId, year, assetKey) => {
    const bundled = resolveVehicleImage({ brandId: 'chevrolet', modelId, year });
    const image = parseVehicleImage({
      status: 'approved', url: null, version: 1, catalog_asset_key: assetKey,
    });
    if (bundled.kind !== 'image') throw new Error(`Expected approved bundled ${modelId} image`);
    expect(bundled.bodyKey).toBe(assetKey);
    expect(chooseVehicleVisual(bundled, image)).toEqual({ kind: 'image', source: bundled.source });
  });

  test('a pending or review-required image cannot display an unapproved model asset', () => {
    const spark = resolveVehicleImage({ brandId: 'chevrolet', modelId: 'spark', year: 2020 });
    const pending = parseVehicleImage({ status: 'pending', url: null, version: null });
    expect(chooseVehicleVisual(spark, pending)).toEqual({ kind: 'placeholder', status: 'pending' });

    const needsReview = parseVehicleImage({
      status: 'unavailable', url: null, version: null, reason: 'needs_review',
    });
    expect(chooseVehicleVisual(spark, needsReview)).toEqual({ kind: 'placeholder', status: 'unavailable' });
  });

  test('an unverified or ambiguous identity never borrows the model-level bundled picture', () => {
    // A 2012 Cobalt is outside the registry's verified 2013-2026 years.
    const cobalt = resolveVehicleImage({ brandId: 'chevrolet', modelId: 'cobalt', year: 2012 });
    expect(cobalt.kind).toBe('image');
    const waiting = parseVehicleImage({ status: 'pending', stage: 'awaiting_review', url: null, version: null });
    expect(chooseVehicleVisual(cobalt, waiting, 'unverified')).toEqual({
      kind: 'placeholder', status: 'pending', stage: 'awaiting_review',
    });
    expect(chooseVehicleVisual(cobalt, waiting, 'needs_review')).toMatchObject({ kind: 'placeholder' });
    const notRequested = parseVehicleImage({ status: 'unavailable', url: null, version: null, reason: 'not_requested' });
    expect(chooseVehicleVisual(cobalt, notRequested, 'unverified')).toEqual({ kind: 'placeholder', status: 'unavailable' });
    // A vehicle saved before identities existed, or a verified one, keeps the approved bundle.
    expect(chooseVehicleVisual(cobalt, notRequested, 'unresolved')).toMatchObject({ kind: 'image' });
    expect(chooseVehicleVisual(cobalt, waiting, 'verified')).toMatchObject({ kind: 'image' });
    // A confirmed publication for the unverified identity is shown.
    expect(chooseVehicleVisual(cobalt, { status: 'approved', url: URL, version: 1 }, 'unverified')).toEqual({
      kind: 'image', source: { uri: URL },
    });
  });
});

