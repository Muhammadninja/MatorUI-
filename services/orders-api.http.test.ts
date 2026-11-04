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

import { HttpOrdersTransport, mapOrderToListRow, mapOrderToDetail, type RawBackendOrder } from './orders-api';
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

// The exact object api.mator.uz returned for a freshly-created order.
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
    expect(row.total).toBe("280\u00A0000 UZS"); // UZS grouped
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
  test('maps original server values and flags the historical inconsistent subtotal', () => {
    const d = mapOrderToDetail(RAW);
    expect(d.id).toBe('ord_01KY2DNPSRYPT8C7SDT2N7JJCH');
    expect(d.status).toBe('placed'); // pending_payment → placed
    expect(d.statusLabel).toBe('Awaiting payment');
    expect(d.currentStepIndex).toBe(0);
    expect(d.steps).toHaveLength(5);
    expect(d.courier).toBeNull();
    expect(d.totalLabel).toBe("280\u00A0000 UZS");
    expect(d.items[0]).toMatchObject({ title: 'Motor oil', quantity: 2, price: "250\u00A0000 UZS" });
    expect(d.pricing?.lines[0]).toEqual({ quantity: 2, unitPrice: 250000, lineTotal: 500000 });
    expect(d.pricing?.checks.items).toBe(false);
    expect(d.pricing?.status).toBe('inconsistent');
  });
});

test('detail keeps complete server breakdown and does not mutate timestamps or input', () => {
  const raw = { ...RAW, subtotal_uzs: 500000, total_uzs: 530000 };
  const snapshot = JSON.stringify(raw);
  const detail = mapOrderToDetail(raw);
  expect(detail.pricing).toMatchObject({ subtotal: 500000, delivery: 25000, serviceFee: 5000, discount: 0, total: 530000, status: 'confirmed' });
  expect(detail.totalLabel).toBe("530\u00A0000 UZS");
  expect(JSON.stringify(raw)).toBe(snapshot);
});

test('missing amounts/quantity do not become a zero price or one item in detail', () => {
  const detail = mapOrderToDetail({ ...RAW, total_uzs: null, delivery_uzs: undefined, service_fee_uzs: null, discount_uzs: undefined, items: [{ title: 'Unknown', price_uzs: null }] });
  expect(detail.totalLabel).toBe('');
  expect(detail.items[0]).toMatchObject({ quantity: 0, price: '' });
  expect(detail.pricing).toMatchObject({ total: null, delivery: null, serviceFee: null, discount: null, status: 'incomplete' });
  expect(detail.pricing?.lines[0]).toEqual({ quantity: null, unitPrice: null, lineTotal: null });
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
    expect(res.totalLabel).toBe("280\u00A0000 UZS");
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

  test('getOrder returns null on 404', async () => {
    const { ApiError } = await import('@/services/api-client');
    get.mockRejectedValueOnce(new (ApiError as any)(404));
    const d = await t.getOrder('ord_missing');
    expect(d).toBeNull();
  });
});

test('contradictory foreign currency cannot be relabeled UZS in history/detail/create results', async () => {
  const foreign = { ...RAW, currency: 'USD' };
  expect(mapOrderToListRow(foreign).total).toBe('');
  expect(mapOrderToDetail(foreign).totalLabel).toBe('');
  post.mockResolvedValueOnce(foreign);
  const result = await new HttpOrdersTransport().createOrder({ items: [], addressId: null, paymentType: 'cash', shippingOptionKey: 'pickup', promoCode: null });
  expect(result.totalLabel).toBe('');
});
