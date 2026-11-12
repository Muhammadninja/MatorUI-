import { describe, expect, test } from 'vitest';

import type { PickupPoint } from './orders-service';
import { groupLinesByPickup, isUsableLocation, pickupMapUrl } from './pickup-points';

const place = (dealerId: string, partIds: string[]): PickupPoint => ({
  dealerId,
  dealerName: dealerId,
  address: null,
  landmark: null,
  location: null,
  items: partIds.map((partId) => ({ cartItemId: `ci_${partId}`, partId, title: partId, quantity: 1 })),
});

describe('isUsableLocation', () => {
  test('a real pin is usable', () => {
    expect(isUsableLocation({ lat: 41.2851, lng: 69.2045 })).toBe(true);
  });
  test.each([null, undefined, { lat: 0, lng: 0 }, { lat: NaN, lng: 69 }, { lat: 91, lng: 69 }, { lat: 41, lng: 181 }])(
    '%j is not',
    (point) => {
      expect(isUsableLocation(point as never)).toBe(false);
    },
  );
});

describe('pickupMapUrl', () => {
  const pin = { lat: 41.2851, lng: 69.2045 };
  test('Apple Maps on iOS, with the place named', () => {
    expect(pickupMapUrl(pin, 'Driver’s Village', 'ios')).toBe(
      `https://maps.apple.com/?ll=41.2851,69.2045&q=${encodeURIComponent('Driver’s Village')}`,
    );
  });
  test('a geo: link elsewhere; an unnamed place is labelled by its pin', () => {
    expect(pickupMapUrl(pin, null, 'android')).toBe(
      `geo:41.2851,69.2045?q=41.2851,69.2045(${encodeURIComponent('41.2851,69.2045')})`,
    );
  });
});

describe('groupLinesByPickup', () => {
  const lines = [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }];

  test('one place: no groups, the list stays flat', () => {
    expect(groupLinesByPickup(lines, [place('a', ['p1', 'p2', 'p3'])])).toBeNull();
  });

  test("several places: each place's own lines, in the backend's order", () => {
    const groups = groupLinesByPickup(lines, [place('b', ['p2']), place('a', ['p1', 'p3'])]);
    expect(groups?.map((g) => [g.key, g.lines.map((l) => l.id)])).toEqual([
      ['b', ['p2']],
      ['a', ['p1', 'p3']],
    ]);
  });

  test('a line no place claims is kept, last, with no place', () => {
    const groups = groupLinesByPickup(lines, [place('a', ['p1']), place('b', ['p2'])]);
    expect(groups?.at(-1)).toMatchObject({ key: 'unassigned', point: null, lines: [{ id: 'p3' }] });
  });

  test('matches by the cart line id as well as the part', () => {
    const groups = groupLinesByPickup([{ id: 'ci_p1' }, { id: 'p2' }], [place('a', ['p1']), place('b', ['p2'])]);
    expect(groups?.map((g) => g.lines.map((l) => l.id))).toEqual([['ci_p1'], ['p2']]);
  });
});
