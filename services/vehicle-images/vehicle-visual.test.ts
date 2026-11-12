import { describe, expect, test } from 'vitest';

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

  test('otherwise the bundled approved image stays', () => {
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
});
