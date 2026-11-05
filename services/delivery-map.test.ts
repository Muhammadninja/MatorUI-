import { beforeEach, describe, expect, test, vi } from 'vitest';

const { platform, constants } = vi.hoisted(() => ({
  platform: { OS: 'ios' },
  constants: { expoConfig: null as null | { extra?: Record<string, unknown> } },
}));
vi.mock('react-native', () => ({ Platform: platform }));
vi.mock('expo-constants', () => ({ default: constants }));

import {
  centerOf,
  isCenteredOn,
  isCloseEnoughToChoose,
  isMapAvailable,
  OVERVIEW_REGION,
  regionAround,
  regionOfBounds,
  roughCenter,
} from './delivery-map';

beforeEach(() => {
  platform.OS = 'ios';
  constants.expoConfig = null;
});

describe('isMapAvailable', () => {
  test('iOS always has one: Apple Maps needs no key', () => {
    expect(isMapAvailable()).toBe(true);
  });

  test('Android has one only with a key in the build, or the native map would crash', () => {
    platform.OS = 'android';
    expect(isMapAvailable()).toBe(false);

    constants.expoConfig = { extra: { googleMapsConfigured: false } };
    expect(isMapAvailable()).toBe(false);

    constants.expoConfig = { extra: { googleMapsConfigured: true } };
    expect(isMapAvailable()).toBe(true);
  });
});

describe('the camera', () => {
  test('looks at a point, keeping it exact', () => {
    const point = { lat: 41.311081234, lng: 69.240562987 };
    expect(centerOf(regionAround(point))).toEqual(point);
  });

  test('takes in a delivery area with some room around it', () => {
    const region = regionOfBounds({ minLat: 41, minLng: 69, maxLat: 42, maxLng: 71 });
    expect(region.latitude).toBe(41.5);
    expect(region.longitude).toBe(70);
    expect(region.latitudeDelta).toBeGreaterThan(1);
    expect(region.longitudeDelta).toBeGreaterThan(2);
  });
});

describe('isCenteredOn', () => {
  const point = { lat: 41.3, lng: 69.2 };
  const at = (lat: number, lng: number, delta: number) => ({
    latitude: lat,
    longitude: lng,
    latitudeDelta: delta,
    longitudeDelta: delta,
  });

  test('allows for a map snapping its centre to a pixel', () => {
    expect(isCenteredOn(point, at(41.3000001, 69.2000001, 0.005))).toBe(true);
    expect(isCenteredOn(point, at(41.32, 69.22, 10))).toBe(true);
  });

  test('a real move is not noise, at street level', () => {
    expect(isCenteredOn(point, at(41.3001, 69.2, 0.005))).toBe(false);
    expect(isCenteredOn(point, at(41.3, 69.2001, 0.005))).toBe(false);
  });
});

describe('isCloseEnoughToChoose', () => {
  test('not from the country view, where a pixel is many kilometres', () => {
    expect(isCloseEnoughToChoose(OVERVIEW_REGION)).toBe(false);
  });

  test('from a city or a street', () => {
    expect(isCloseEnoughToChoose(regionAround({ lat: 41.3, lng: 69.2 }))).toBe(true);
    expect(isCloseEnoughToChoose(regionAround({ lat: 41.3, lng: 69.2 }, 0.1))).toBe(true);
    expect(isCloseEnoughToChoose(regionAround({ lat: 41.3, lng: 69.2 }, 0.11))).toBe(false);
  });
});

test('a search is told where the map looks only roughly', () => {
  expect(roughCenter({ lat: 41.311081, lng: 69.240562 })).toEqual({
    nearLat: 41.31,
    nearLng: 69.24,
  });
});
