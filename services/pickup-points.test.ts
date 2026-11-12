/**
 * Reading `GET /v1/shipping/pickup-points`: a place the app shows has to be the one the
 * backend stated. A location that is not real coordinates is no location, never another one.
 */
import { describe, expect, test } from 'vitest';

import {
  formatCoordinates,
  parsePickupLocation,
  parsePickupPoints,
  pickupCartKey,
  pickupPointGap,
} from '@/services/pickup-points';

const ITEM = { cart_item_id: 'ci_1', part_id: 'part_1', title: 'Колодки', quantity: 2 };
const POINT = {
  dealer_id: 'drivers-village',
  dealer_name: 'Driver’s Village',
  address: 'Toshkent, Bunyodkor shoh ko‘chasi 12',
  landmark: 'Mega Planet qarshisida',
  location: { lat: 41.2851, lng: 69.2045 },
  items: [ITEM],
};

describe('parsePickupPoints', () => {
  test('reads each dealer as the backend states it', () => {
    expect(parsePickupPoints([POINT])).toEqual([
      {
        dealerId: 'drivers-village',
        dealerName: 'Driver’s Village',
        address: 'Toshkent, Bunyodkor shoh ko‘chasi 12',
        landmark: 'Mega Planet qarshisida',
        location: { lat: 41.2851, lng: 69.2045 },
        items: [{ cartItemId: 'ci_1', partId: 'part_1', title: 'Колодки', quantity: 2 }],
      },
    ]);
  });

  test('keeps dealers apart and in order, each with its own lines', () => {
    const other = {
      ...POINT,
      dealer_id: 'seller_7',
      dealer_name: 'Avto Ehtiyot',
      items: [{ ...ITEM, cart_item_id: 'ci_2', part_id: 'part_2' }],
    };
    const points = parsePickupPoints([POINT, other]);

    expect(points.map((p) => p.dealerId)).toEqual(['drivers-village', 'seller_7']);
    expect(points.map((p) => p.items.map((i) => i.cartItemId))).toEqual([['ci_1'], ['ci_2']]);
  });

  test('blank words are no words', () => {
    const [point] = parsePickupPoints([
      { ...POINT, address: '   ', landmark: '', dealer_name: null },
    ]);
    expect(point).toMatchObject({ address: null, landmark: null, dealerName: null });
  });

  test('a dealer the app can name no line for is left out; a malformed answer is no places', () => {
    expect(parsePickupPoints([{ ...POINT, items: [] }])).toEqual([]);
    expect(parsePickupPoints([{ ...POINT, items: [{ ...ITEM, quantity: 0 }] }])).toEqual([]);
    expect(parsePickupPoints([{ ...POINT, items: [{ ...ITEM, title: '' }] }])).toEqual([]);
    expect(parsePickupPoints([null, 'x', 7])).toEqual([]);
    expect(parsePickupPoints(undefined)).toEqual([]);
    expect(parsePickupPoints({ pickup_points: [POINT] })).toEqual([]);
  });
});

describe('parsePickupLocation', () => {
  test('a real point is kept exactly, never rounded', () => {
    expect(parsePickupLocation({ lat: 41.285123456, lng: 69.204598765 })).toEqual({
      lat: 41.285123456,
      lng: 69.204598765,
    });
  });

  test.each([
    ['nothing', null],
    ['no longitude', { lat: 41.3 }],
    ['numbers as words', { lat: '41.3', lng: '69.2' }],
    ['0, 0', { lat: 0, lng: 0 }],
    ['out of range', { lat: 141.3, lng: 69.2 }],
    ['not a number', { lat: Number.NaN, lng: 69.2 }],
    ['infinite', { lat: 41.3, lng: Number.POSITIVE_INFINITY }],
  ])('%s is no location, and nothing stands in for it', (_label, raw) => {
    expect(parsePickupLocation(raw)).toBeNull();
    const [point] = parsePickupPoints([{ ...POINT, location: raw }]);
    expect(point!.location).toBeNull();
  });
});

describe('what the checkout says is missing', () => {
  const at = { lat: 41.2851, lng: 69.2045 };

  test.each([
    ['both on record', 'Bunyodkor 12', at, null],
    ['no address', null, at, 'no_address'],
    ['no location', 'Bunyodkor 12', null, 'no_location'],
    ['neither', null, null, 'not_specified'],
  ] as const)('%s', (_label, address, location, gap) => {
    expect(pickupPointGap({ address, location })).toBe(gap);
  });
});

test('coordinates read to six places', () => {
  expect(formatCoordinates({ lat: 41.2851, lng: 69.2045 })).toBe('41.285100, 69.204500');
});

test('the cart key changes with a line or a quantity, not with the order of lines', () => {
  const a = pickupCartKey([
    { id: 'part_1', quantity: 2 },
    { id: 'part_2', quantity: 1 },
  ]);
  expect(
    pickupCartKey([
      { id: 'part_2', quantity: 1 },
      { id: 'part_1', quantity: 2 },
    ]),
  ).toBe(a);
  expect(
    pickupCartKey([
      { id: 'part_1', quantity: 3 },
      { id: 'part_2', quantity: 1 },
    ]),
  ).not.toBe(a);
  expect(pickupCartKey([{ id: 'part_1', quantity: 2 }])).not.toBe(a);
});
