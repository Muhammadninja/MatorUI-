/** The app's early answer has to be the backend's: same shapes, same edge rules. */
import { describe, expect, test } from 'vitest';

import { isWithinCoverage, parseCoverageGeometry, type DeliveryPolygons } from './delivery-coverage';

const square = (min: number, max: number): [number, number][] => [
  [min, min],
  [max, min],
  [max, max],
  [min, max],
  [min, min],
];

describe('isWithinCoverage', () => {
  const area: DeliveryPolygons = [[square(10, 20)]];

  test('reads [longitude, latitude], not the other way round', () => {
    const wide: DeliveryPolygons = [
      [
        [
          [69, 41],
          [70, 41],
          [70, 42],
          [69, 42],
          [69, 41],
        ],
      ],
    ];
    expect(isWithinCoverage({ lat: 41.5, lng: 69.5 }, wide)).toBe(true);
    expect(isWithinCoverage({ lat: 69.5, lng: 41.5 }, wide)).toBe(false);
  });

  test.each([
    ['inside', 15, 15, true],
    ['beyond it', 15, 25, false],
    ['on the other side', 15, 5, false],
    ['on a corner', 10, 10, true],
    ['on a side', 10, 15, true],
    ['on the far side', 15, 20, true],
  ])('a point %s', (_, lat, lng, covered) => {
    expect(isWithinCoverage({ lat, lng }, area)).toBe(covered);
  });

  test('goes by the shape, not the box around it', () => {
    const triangle: DeliveryPolygons = [
      [
        [
          [10, 10],
          [20, 10],
          [10, 20],
          [10, 10],
        ],
      ],
    ];
    expect(isWithinCoverage({ lat: 12, lng: 12 }, triangle)).toBe(true);
    expect(isWithinCoverage({ lat: 19, lng: 19 }, triangle)).toBe(false);
  });

  test('leaves out a hole, while its edge still counts as covered', () => {
    const holed: DeliveryPolygons = [[square(10, 20), square(14, 16)]];
    expect(isWithinCoverage({ lat: 15, lng: 15 }, holed)).toBe(false);
    expect(isWithinCoverage({ lat: 15, lng: 14 }, holed)).toBe(true);
    expect(isWithinCoverage({ lat: 12, lng: 12 }, holed)).toBe(true);
  });

  test('takes separate parts, and nothing between them', () => {
    const parts: DeliveryPolygons = [[square(10, 20)], [square(30, 40)]];
    expect(isWithinCoverage({ lat: 15, lng: 15 }, parts)).toBe(true);
    expect(isWithinCoverage({ lat: 35, lng: 35 }, parts)).toBe(true);
    expect(isWithinCoverage({ lat: 25, lng: 25 }, parts)).toBe(false);
  });
});

describe('parseCoverageGeometry', () => {
  test('takes what the backend sends', () => {
    expect(
      parseCoverageGeometry({ type: 'MultiPolygon', coordinates: [[square(10, 20)]] }),
    ).toEqual([[square(10, 20)]]);
  });

  test.each([
    ['nothing', null],
    ['no area configured', undefined],
    ['another type', { type: 'Polygon', coordinates: [square(10, 20)] }],
    ['no polygons', { type: 'MultiPolygon', coordinates: [] }],
    ['an empty polygon', { type: 'MultiPolygon', coordinates: [[]] }],
    ['too short a ring', { type: 'MultiPolygon', coordinates: [[[[1, 1], [2, 2], [1, 1]]]] }],
    [
      'positions in words',
      { type: 'MultiPolygon', coordinates: [[[['1', '1'], [2, 1], [2, 2], ['1', '1']]]] },
    ],
  ])('%s leaves the decision with the backend', (_, geometry) => {
    expect(parseCoverageGeometry(geometry)).toBeNull();
  });
});
