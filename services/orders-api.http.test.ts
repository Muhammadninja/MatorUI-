/**
 * orders-api — HTTP transport contract tests (the REAL /v1/orders path).
 *
 * Pins the mapping against the shape verified live on api.mator.uz 2026-07-21:
 *   - GET  /v1/orders        → { items:[RawBackendOrder], next_cursor }  (cursor,
 *                              NOT page/pageSize — those 400)
 *   - GET  /v1/orders/:id    → RawBackendOrder
 *   - POST /v1/orders        → RawBackendOrder  (order built from the SERVER cart;
 *                              body is cart_snapshot + optional vehicle/phone)
 */
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

import { formatCurrency } from './cart-math';
import i18n from './i18n';
import {
  HttpOrdersTransport,
  mapOrderCharges,
  mapOrderToListRow,
  mapOrderToDetail,
  type RawBackendOrder,
} from './orders-api';
import { formatOrderNo } from './orders-service';

describe('formatOrderNo', () => {
  test('shortens a long backend ULID to #<last6>', () => {
    expect(formatOrderNo('ord_01KY2DNPSRYPT8C7SDT2N7JJCH')).toBe('#N7JJCH');
  });
  test('leaves already-short mock ids as-is', () => {
    expect(formatOrderNo('ORD-8821')).toBe('ORD-8821');
    expect(formatOrderNo('M-48291')).toBe('M-48291');
  });
  test('empty id → empty string', () => {
    expect(formatOrderNo('')).toBe('');
  });
});

// The exact object api.mator.uz returned for a freshly-created order. It was placed on
// 2026-07-21 under the old flat fee of 5 000; today's tariff (tariff A) would charge 10 000 on
// 250 000 of parts. That is the point: an order keeps what it was charged, and the app shows
// the backend's stored figures, never a fee it works out itself.
const RAW: RawBackendOrder = {
  order_id: 'ord_01KY2DNPSRYPT8C7SDT2N7JJCH',
  status: 'pending_payment',
  subtotal_uzs: 250000,
  delivery_uzs: 25000,
  service_fee_uzs: 5000,
  discount_uzs: 0,
  total_uzs: 280000,
  currency: 'UZS',
  vehicle_id: null,
  delivery_address_id: null,
  delivery_method: 'courier',
  items: [
    { part_id: 'part_stock_28', service_id: null, title: 'Motor oil', qty: 2, price_uzs: 250000, line_total_uzs: 500000, scheduled_at: null },
  ],
  expires_at: '2026-07-21T13:56:03.305Z',
  created_at: '2026-07-21T13:26:03.322Z',
};

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('mapOrderToListRow', () => {
  test('maps a raw order to a history row', () => {
    const row = mapOrderToListRow(RAW);
    expect(row.id).toBe('ord_01KY2DNPSRYPT8C7SDT2N7JJCH');
    expect(row.status).toBe('Processing'); // pending_payment → Processing
    expect(row.items).toBe(2); // sum of qty
    expect(row.total).toBe(formatCurrency(280000)); // UZS grouped, in the app's language
    expect(row.date).toBe('Jul 21, 2026');
    expect(row.summary).toBe('Motor oil');
  });

  test('summary counts extra line items', () => {
    const row = mapOrderToListRow({
      ...RAW,
      items: [
        { title: 'Turbo', qty: 1, price_uzs: 1 },
        { title: 'Brakes', qty: 1, price_uzs: 1 },
        { title: 'Filter', qty: 1, price_uzs: 1 },
      ],
    });
    expect(row.summary).toBe('Turbo + 2 items');
    expect(row.items).toBe(3);
  });
});

describe('mapOrderToDetail', () => {
  test('synthesizes a coherent detail from the flat backend order', () => {
    const d = mapOrderToDetail(RAW);
    expect(d.id).toBe('ord_01KY2DNPSRYPT8C7SDT2N7JJCH');
    expect(d.status).toBe('placed'); // pending_payment → placed
    expect(d.statusLabel).toBe('Awaiting payment');
    expect(d.currentStepIndex).toBe(0);
    expect(d.steps).toHaveLength(5);
    expect(d.courier).toBeNull();
    expect(d.totalLabel).toBe(formatCurrency(280000));
    expect(d.items[0]).toMatchObject({ title: 'Motor oil', quantity: 2, price: formatCurrency(250000) });
  });

  test('keeps each part of what the order charges, as the backend stored it', () => {
    expect(mapOrderToDetail(RAW).charges).toEqual({
      subtotal: 250000,
      discount: 0,
      serviceFee: 5000,
      delivery: 25000,
      total: 280000,
    });
  });
});

describe('mapOrderCharges', () => {
  test('an order with no fee carries a fee of 0, not an unknown one', () => {
    expect(mapOrderCharges({ ...RAW, service_fee_uzs: 0, total_uzs: 275000 })).toMatchObject({
      serviceFee: 0,
      total: 275000,
    });
  });

  test('nothing is made up when the backend states no total or no parts', () => {
    expect(mapOrderCharges({ ...RAW, total_uzs: undefined })).toBeNull();
    expect(mapOrderCharges({ ...RAW, subtotal_uzs: undefined })).toBeNull();
  });
});

describe('amounts in the app’s language', () => {
  test.each([
    ['ru', '280\u00A0000 сум'],
    ['uz', '280\u00A0000 soʻm'],
    ['en', '280\u00A0000 UZS'],
  ])('%s', async (lang, expected) => {
    await i18n.changeLanguage(lang);
    expect(mapOrderToDetail(RAW).totalLabel).toBe(expected);
  });
});

describe('HttpOrdersTransport', () => {
  const t = new HttpOrdersTransport();

  test('listOrders GETs /v1/orders with NO page params and maps items', async () => {
    get.mockResolvedValueOnce({ items: [RAW], next_cursor: null });
    const page = await t.listOrders({ page: 1, pageSize: 20 });
    expect(get.mock.calls[0]![0]).toBe('/v1/orders'); // no ?page= (would 400)
    expect(page.items).toHaveLength(1);
    expect(page.items[0]!.id).toBe(RAW.order_id);
  });

  test('createOrder sends cart_snapshot + vehicle + phone and maps the result', async () => {
    post.mockResolvedValueOnce(RAW);
    const res = await t.createOrder({
      items: [{ productId: 'p', quantity: 1 }],
      addressId: 'addr_1',
      paymentType: 'cash',
      shippingOptionKey: 'standard',
      promoCode: 'SAVE10',
      vehicleId: 'veh_1',
      contactPhone: '+998 90 123 45 67',
    });

    const [url, body] = post.mock.calls[0]!;
    expect(url).toBe('/v1/orders');
    expect(body).toEqual({
      cart_snapshot: { delivery_method: 'courier', delivery_address_id: 'addr_1', promo_code: 'SAVE10' },
      vehicle_id: 'veh_1',
      contact_phone_e164: '+998901234567', // normalized
      payment_type: 'cash', // chosen method forwarded so the backend can route the webhook
    });
    expect(res.orderId).toBe(RAW.order_id);
    expect(res.totalLabel).toBe(formatCurrency(280000));
  });

  test('createOrder omits vehicle/phone when absent (both optional server-side)', async () => {
    post.mockResolvedValueOnce(RAW);
    await t.createOrder({
      items: [],
      addressId: null,
      paymentType: 'payme',
      shippingOptionKey: 'standard',
      promoCode: null,
    });
    const [, body] = post.mock.calls[0]!;
    expect(body).toEqual({
      cart_snapshot: { delivery_method: 'courier', delivery_address_id: null, promo_code: null },
      payment_type: 'payme',
    });
    expect(body).not.toHaveProperty('vehicle_id');
    expect(body).not.toHaveProperty('contact_phone_e164');
  });

  test('createOrder states the courier price the buyer was shown', async () => {
    post.mockResolvedValueOnce(RAW);
    await t.createOrder({
      items: [],
      addressId: 'addr_1',
      paymentType: 'cash',
      shippingOptionKey: 'courier',
      confirmedDeliveryUzs: 32500,
      deliveryQuoteId: 'quote_1',
      promoCode: null,
    });
    const [, body] = post.mock.calls[0]!;
    expect(body).toMatchObject({
      cart_snapshot: { delivery_method: 'courier', delivery_address_id: 'addr_1' },
      confirmed_delivery_uzs: 32500,
      delivery_quote_id: 'quote_1',
    });
  });

  test('createOrder states the total the buyer was shown, fee included, and nothing else of money', async () => {
    post.mockResolvedValueOnce(RAW);
    await t.createOrder({
      items: [],
      addressId: null,
      paymentType: 'payme',
      shippingOptionKey: 'pickup',
      confirmedTotalUzs: 620000,
      promoCode: null,
    });
    const [, body] = post.mock.calls[0]!;
    expect(body).toMatchObject({ confirmed_total_uzs: 620000 });
    expect(body).not.toHaveProperty('service_fee_uzs');
    expect(body).not.toHaveProperty('total_uzs');
  });

  test('createOrder states no total when none was shown', async () => {
    post.mockResolvedValueOnce(RAW);
    await t.createOrder({
      items: [],
      addressId: null,
      paymentType: 'cash',
      shippingOptionKey: 'pickup',
      confirmedTotalUzs: null,
      promoCode: null,
    });
    expect(post.mock.calls[0]![1]).not.toHaveProperty('confirmed_total_uzs');
  });

  test('createOrder states no price for pickup', async () => {
    post.mockResolvedValueOnce(RAW);
    await t.createOrder({
      items: [],
      addressId: null,
      paymentType: 'cash',
      shippingOptionKey: 'pickup',
      confirmedDeliveryUzs: null,
      promoCode: null,
    });
    const [, body] = post.mock.calls[0]!;
    expect(body).not.toHaveProperty('confirmed_delivery_uzs');
    expect(body).not.toHaveProperty('delivery_quote_id');
    expect((body as any).cart_snapshot.delivery_method).toBe('pickup');
  });

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

  test.each([
    ['payme', 'payme'],
    ['cash', 'cash'],
    ['terminal', 'terminal'],
    [null, null],
    [undefined, null],
    ['barter', null],
  ])('an order paid by %s reads as %s, keeping the status word as sent', (sent, read) => {
    const detail = mapOrderToDetail({ ...RAW, payment_type: sent } as never);
    expect(detail.paymentType).toBe(read);
    expect(detail.serverStatus).toBe('pending_payment');
  });

  test('getOrder returns null on 404', async () => {
    const { ApiError } = await import('@/services/api-client');
    get.mockRejectedValueOnce(new (ApiError as any)(404));
    const d = await t.getOrder('ord_missing');
    expect(d).toBeNull();
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

describe('cancelling an offline order', () => {
  const t = new HttpOrdersTransport();
  beforeEach(() => post.mockReset());

  test('posts to the cancel endpoint and maps the answer', async () => {
    post.mockResolvedValue({ order_id: 'o 1', status: 'cancelled', payment_type: 'cash' });
    const order = await t.cancelOrder('o 1');
    expect(post).toHaveBeenCalledWith('/v1/orders/o%201/cancel', {});
    expect(order.status).toBe('cancelled');
    expect(order.serverStatus).toBe('cancelled');
  });

  test('a refusal reaches the caller', async () => {
    post.mockRejectedValueOnce(new Error('409'));
    await expect(t.cancelOrder('o1')).rejects.toThrow('409');
  });
});
