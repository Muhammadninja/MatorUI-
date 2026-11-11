/** HTTP contracts for address, delivery coverage, shipping quotes and pickup points. */
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => true,
}));

const get = vi.fn();
const post = vi.fn();
vi.mock('@/services/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a) },
  ApiError: class ApiError extends Error {
    constructor(public status: number) {
      super('api');
    }
  },
}));

import { HttpOrdersTransport } from './orders-api';

beforeEach(() => { get.mockReset(); post.mockReset(); });

describe('HttpOrdersTransport account and delivery endpoints', () => {
  const t = new HttpOrdersTransport();

  test('getShippingQuote asks for the courier price of the saved address, stating no coordinates', async () => {
    post.mockResolvedValueOnce({
      options: [{ type: 'courier', label: 'Kuryer', price_uzs: 32500, quote_id: 'quote_1' }],
      currency: 'UZS',
    });
    const options = await t.getShippingQuote({
      addressId: 'addr_1',
      location: '41.3,69.2',
      cartKey: 'part_1',
    });
    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/v1/shipping/quote');
    expect(body).toEqual({ delivery_address_id: 'addr_1', delivery_method: 'courier' });
    expect(options).toEqual([{ key: 'courier', label: 'Kuryer', price: 32500, quoteId: 'quote_1' }]);
  });

  test('reads both options the backend answers: pickup, free, and the priced courier', async () => {
    post.mockResolvedValueOnce({
      options: [
        { type: 'pickup', label: 'Olib ketish', available: true, price_uzs: 0, quote_id: null, unavailable_reason: null },
        { type: 'courier', label: 'Kuryer', available: true, price_uzs: 32500, quote_id: 'quote_1', unavailable_reason: null },
      ],
      currency: 'UZS',
    });
    await expect(t.getShippingQuote({ addressId: 'addr_1' })).resolves.toEqual([
      { key: 'pickup', label: 'Olib ketish', price: 0, quoteId: null },
      { key: 'courier', label: 'Kuryer', price: 32500, quoteId: 'quote_1' },
    ]);
  });

  test('keeps a courier the backend cannot deliver as such, with its reason and no price', async () => {
    post.mockResolvedValueOnce({
      options: [
        { type: 'pickup', label: 'Olib ketish', available: true, price_uzs: 0, quote_id: null, unavailable_reason: null },
        {
          type: 'courier',
          label: 'Kuryer',
          available: false,
          price_uzs: null,
          quote_id: null,
          unavailable_reason: { code: 'DELIVERY_OUTSIDE_COVERAGE', message: 'outside' },
        },
      ],
      currency: 'UZS',
    });
    await expect(t.getShippingQuote({ addressId: 'addr_1' })).resolves.toEqual([
      { key: 'pickup', label: 'Olib ketish', price: 0, quoteId: null },
      {
        key: 'courier',
        label: 'Kuryer',
        available: false,
        price: null,
        quoteId: null,
        unavailableCode: 'DELIVERY_OUTSIDE_COVERAGE',
      },
    ]);
  });

  test.each([
    ['a price beside it', { price_uzs: 0, quote_id: 'quote_1', unavailable_reason: { code: 'DELIVERY_ROUTE_NOT_FOUND' } }, 'DELIVERY_ROUTE_NOT_FOUND'],
    ['no reason', { price_uzs: null }, null],
    ['a reason with no code', { unavailable_reason: { message: 'no' } }, null],
  ])('an unavailable courier with %s is still never priced, nor free', async (_, over, code) => {
    post.mockResolvedValueOnce({
      options: [{ type: 'courier', label: 'Kuryer', available: false, ...over }],
    });
    await expect(t.getShippingQuote({ addressId: 'addr_1' })).resolves.toEqual([
      { key: 'courier', label: 'Kuryer', available: false, price: null, quoteId: null, unavailableCode: code },
    ]);
  });

  test('a price with no quote behind it could only be refused, so it is no quote at all', async () => {
    post.mockResolvedValueOnce({
      options: [{ type: 'courier', label: 'Kuryer', price_uzs: 32500 }],
    });
    await expect(t.getShippingQuote({ addressId: 'addr_1' })).resolves.toEqual([]);
  });

  test('nothing to deliver is free, with nothing to bind', async () => {
    post.mockResolvedValueOnce({
      options: [{ type: 'courier', label: 'Kuryer', price_uzs: 0, quote_id: null }],
    });
    await expect(t.getShippingQuote({ addressId: 'addr_1' })).resolves.toEqual([
      { key: 'courier', label: 'Kuryer', price: 0, quoteId: null },
    ]);
  });

  test.each([
    ['no price', { type: 'courier', label: 'Kuryer' }],
    ['a null price', { type: 'courier', label: 'Kuryer', price_uzs: null }],
    ['a negative price', { type: 'courier', label: 'Kuryer', price_uzs: -1 }],
    ['a price in words', { type: 'courier', label: 'Kuryer', price_uzs: '32500' }],
  ])('getShippingQuote never reads %s as free', async (_, option) => {
    post.mockResolvedValueOnce({ options: [option], currency: 'UZS' });
    await expect(t.getShippingQuote({ addressId: 'addr_1' })).resolves.toEqual([]);
  });

  test('address writes carry a stated location, and only a stated one', async () => {
    const patch = vi.fn();
    const { apiClient } = await import('@/services/api-client');
    (apiClient as any).patch = patch;
    const raw = { id: 'addr_1', street: 'Navoi 1', district: 'Toshkent', lat: 41.3, lng: 69.2 };
    patch.mockResolvedValue(raw);
    const text = { label: 'Home', name: '', line1: 'Navoi 1', city: 'Toshkent' };

    const saved = await t.updateAddress('addr_1', { ...text, lat: 41.3, lng: 69.2 });
    expect(patch.mock.calls[0]![1]).toMatchObject({ lat: 41.3, lng: 69.2 });
    expect(saved).toMatchObject({ lat: 41.3, lng: 69.2 });

    await t.updateAddress('addr_1', text);
    expect(patch.mock.calls[1]![1]).not.toHaveProperty('lat');
    expect(patch.mock.calls[1]![1]).not.toHaveProperty('lng');
  });

  test('a hint for the courier goes with the address, and an empty one clears it', async () => {
    post.mockResolvedValue({ id: 'addr_1', street: 'Navoi 1', landmark: 'Blue gate' });
    const text = { label: 'Home', name: '', line1: 'Navoi 1', city: 'Toshkent' };

    const saved = await t.createAddress({ ...text, landmark: ' Blue gate ' });
    expect(post.mock.lastCall![1]).toMatchObject({ landmark: 'Blue gate' });
    expect(saved.landmark).toBe('Blue gate');

    await t.createAddress({ ...text, landmark: '  ' });
    expect(post.mock.lastCall![1]).toMatchObject({ landmark: null });

    await t.createAddress(text);
    expect(post.mock.lastCall![1]).not.toHaveProperty('landmark');
  });

  test('a point with no words sends no text, for the server to describe', async () => {
    post.mockResolvedValueOnce({ id: 'addr_1', full_text: '41.3, 69.2', lat: 41.3, lng: 69.2 });

    const saved = await t.createAddress({
      label: 'Выбранная точка',
      name: '',
      line1: '',
      city: '',
      lat: 41.3,
      lng: 69.2,
    });

    expect(post.mock.calls[0]![1]).toEqual({ label: 'Выбранная точка', lat: 41.3, lng: 69.2 });
    // Its stored description is for the courier: not a street to show the buyer.
    expect(saved).toMatchObject({ line1: '', city: '', lat: 41.3, lng: 69.2 });
  });

  test('searches through the backend, encoding what was typed, and maps the matches', async () => {
    get.mockResolvedValueOnce({
      items: [
        {
          id: 77,
          title: 'Амира Темура 12',
          subtitle: 'Ташкент',
          city: 'Ташкент',
          district: 'Юнусабад',
          street: 'Амира Темура',
          house_number: '12',
          lat: 41.31,
          lng: 69.28,
        },
      ],
      attribution: '© OpenStreetMap contributors',
    });

    const found = await t.searchAddresses({
      street: 'Амира Темура',
      house: '12',
      city: 'Ташкент',
      lang: 'ru',
    });

    expect(get.mock.calls[0]![0]).toBe(
      `/v1/addresses/suggestions?street=${encodeURIComponent('Амира Темура')}&house=12&city=${encodeURIComponent('Ташкент')}&lang=ru`,
    );
    expect(found).toEqual({
      items: [
        {
          id: '77',
          title: 'Амира Темура 12',
          subtitle: 'Ташкент',
          city: 'Ташкент',
          district: 'Юнусабад',
          street: 'Амира Темура',
          houseNumber: '12',
          lat: 41.31,
          lng: 69.28,
        },
      ],
      attribution: '© OpenStreetMap contributors',
    });
  });

  test('a search states only what was typed', async () => {
    get.mockResolvedValueOnce({ items: [] });
    await t.searchAddresses({ street: 'Navoi', lang: 'uz' });
    expect(get.mock.calls[0]![0]).toBe('/v1/addresses/suggestions?street=Navoi&lang=uz');
  });

  test('a submitted search says so, and carries where the map is looking', async () => {
    get.mockResolvedValueOnce({ items: [] });
    await t.searchAddresses({
      street: 'Navoi',
      lang: 'uz',
      mode: 'search',
      nearLat: 41.31,
      nearLng: 69.24,
    });
    expect(get.mock.calls[0]![0]).toBe(
      '/v1/addresses/suggestions?street=Navoi&lang=uz&mode=search&near_lat=41.31&near_lng=69.24',
    );
  });

  test('asks what is at a confirmed point, by its exact coordinates', async () => {
    get.mockResolvedValueOnce({
      address: { city: 'Toshkent', district: null, street: 'Seul', house_number: '5' },
      within_coverage: true,
      attribution: 'Map data © OpenStreetMap contributors, licensed under the ODbL.',
    });

    const found = await t.describePoint({ lat: 41.311081234, lng: 69.240562987 }, 'ru');

    expect(get.mock.calls[0]![0]).toBe(
      '/v1/addresses/reverse?lat=41.311081234&lng=69.240562987&lang=ru',
    );
    expect(found).toEqual({
      address: { city: 'Toshkent', district: null, street: 'Seul', houseNumber: '5' },
      withinCoverage: true,
      attribution: 'Map data © OpenStreetMap contributors, licensed under the ODbL.',
    });
  });

  test('a point nothing is known about is an answer too', async () => {
    get.mockResolvedValueOnce({ address: null, within_coverage: null, attribution: null });
    await expect(t.describePoint({ lat: 41.3, lng: 69.2 }, 'ru')).resolves.toEqual({
      address: null,
      withinCoverage: null,
      attribution: null,
    });
  });

  test.each([
    [
      'an area',
      {
        configured: true,
        bounds: { min_lat: 41, min_lng: 69, max_lat: 42, max_lng: 70 },
        geometry: { type: 'MultiPolygon', coordinates: [[[[69, 41], [70, 41], [70, 42], [69, 41]]]] },
      },
      {
        configured: true,
        bounds: { minLat: 41, minLng: 69, maxLat: 42, maxLng: 70 },
        polygons: [[[[69, 41], [70, 41], [70, 42], [69, 41]]]],
      },
    ],
    [
      'no area',
      { configured: false, bounds: null, geometry: null },
      { configured: false, bounds: null, polygons: null },
    ],
    ['nothing useful', {}, { configured: false, bounds: null, polygons: null }],
  ])('reads the delivery coverage: %s', async (_, raw, read) => {
    get.mockResolvedValueOnce(raw);
    await expect(t.getDeliveryCoverage()).resolves.toEqual(read);
    expect(get.mock.lastCall![0]).toBe('/v1/shipping/coverage');
  });

  test.each([
    ['no point', { id: 1, title: 'A' }],
    ['half a point', { id: 1, title: 'A', lat: 41.3 }],
    ['a point in words', { id: 1, title: 'A', lat: '41.3', lng: '69.2' }],
    ['no title', { id: 1, lat: 41.3, lng: 69.2 }],
  ])('never offers a match with %s: picking it could not be priced', async (_, item) => {
    get.mockResolvedValueOnce({ items: [item] });
    await expect(t.searchAddresses({ street: 'A', lang: 'uz' })).resolves.toEqual({
      items: [],
      attribution: null,
    });
  });

  test("getPickupPoints asks where the cart's goods are collected and reads each dealer's place", async () => {
    get.mockResolvedValueOnce({
      pickup_points: [
        {
          dealer_id: 'seller_7',
          dealer_name: 'Avto Ehtiyot',
          address: 'Sergeli avtobozori, 3-qator 25',
          landmark: null,
          location: { lat: 41.2263, lng: 69.219 },
          items: [{ cart_item_id: 'ci_1', part_id: 'part_1', title: 'Колодки', quantity: 2 }],
        },
        {
          dealer_id: 'seller_4',
          dealer_name: 'Nuqtasiz Savdo',
          address: null,
          landmark: null,
          location: null,
          items: [{ cart_item_id: 'ci_2', part_id: 'part_2', title: 'Фильтр', quantity: 1 }],
        },
      ],
    });

    const points = await t.getPickupPoints();

    expect(get.mock.lastCall![0]).toBe('/v1/shipping/pickup-points');
    expect(points).toEqual([
      {
        dealerId: 'seller_7',
        dealerName: 'Avto Ehtiyot',
        address: 'Sergeli avtobozori, 3-qator 25',
        landmark: null,
        location: { lat: 41.2263, lng: 69.219 },
        items: [{ cartItemId: 'ci_1', partId: 'part_1', title: 'Колодки', quantity: 2 }],
      },
      {
        dealerId: 'seller_4',
        dealerName: 'Nuqtasiz Savdo',
        address: null,
        landmark: null,
        location: null,
        items: [{ cartItemId: 'ci_2', partId: 'part_2', title: 'Фильтр', quantity: 1 }],
      },
    ]);
  });

  test('getPickupPoints reads an answer with no list as no places', async () => {
    get.mockResolvedValueOnce({});
    await expect(t.getPickupPoints()).resolves.toEqual([]);
  });
});
