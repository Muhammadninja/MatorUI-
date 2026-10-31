/**
 * Integration tests for the orders transport — the data layer that
 * powers checkout, order-confirmation, track-order, and order-history.
 *
 * Same convention as cart-math.test.ts and checkout-flow.test.ts:
 * pure-logic, React-free, runs under Vitest in Node.
 */
import { describe, expect, test } from 'vitest';

import { MockOrdersTransport, MOCK_SEED, asList } from './orders-api';
import { STANDARD_DELIVERY_UZS } from './cart-math';
import type { CreateOrderInput } from './orders-service';

const BASE_INPUT: CreateOrderInput = {
  items: [
    { productId: 'p-turbo', quantity: 1 },
    { productId: 'p-brakes', quantity: 2 },
  ],
  addressId: 'addr_home',
  paymentType: 'cash',
  shippingOptionKey: 'courier',
  promoCode: null,
};

describe('MockOrdersTransport — list', () => {
  test('is empty by default (real orders come from the HTTP transport)', async () => {
    const transport = new MockOrdersTransport();
    const page = await transport.listOrders({});
    expect(page.total).toBe(0);
    expect(page.items).toEqual([]);
  });

  test('AbortSignal cancels in-flight reads', async () => {
    const transport = new MockOrdersTransport();
    const controller = new AbortController();
    const pending = transport.listOrders({}, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('MockOrdersTransport — detail', () => {
  test('returns null for an unknown id (track-order renders NotFound)', async () => {
    const transport = new MockOrdersTransport();
    const order = await transport.getOrder('NOPE-0000');
    expect(order).toBeNull();
  });

  test('surfaces a freshly created order (create → track round-trip)', async () => {
    const transport = new MockOrdersTransport();
    const { orderId } = await transport.createOrder(BASE_INPUT);
    const order = await transport.getOrder(orderId);
    expect(order).not.toBeNull();
    expect(order!.id).toBe(orderId);
    expect(order!.steps).toHaveLength(5);
  });
});

describe('MockOrdersTransport — createOrder', () => {
  test('returns an orderId + ETA matching the chosen shipping option', async () => {
    const transport = new MockOrdersTransport();
    const result = await transport.createOrder(BASE_INPUT);
    expect(result.orderId).toMatch(/^M-\d{5}$/);
    expect(result.eta).toBe('1-3 days'); // courier
  });

  test('seeds a fresh detail row so track-order can fetch the new id', async () => {
    const transport = new MockOrdersTransport();
    const result = await transport.createOrder(BASE_INPUT);
    const detail = await transport.getOrder(result.orderId);
    expect(detail).not.toBeNull();
    expect(detail!.id).toBe(result.orderId);
    expect(detail!.status).toBe('placed');
    expect(detail!.statusLabel).toBe('Processing');
  });

  test('rejects an empty cart', async () => {
    const transport = new MockOrdersTransport();
    await expect(
      transport.createOrder({ ...BASE_INPUT, items: [] }),
    ).rejects.toThrow(/cart is empty/i);
  });

  test('accepts a skipped (null) address with a Payme/Terminal/Cash method', async () => {
    const transport = new MockOrdersTransport();
    for (const paymentType of ['payme', 'terminal', 'cash'] as const) {
      const result = await transport.createOrder({
        ...BASE_INPUT,
        addressId: null,
        paymentType,
      });
      expect(result.orderId).toMatch(/^M-\d{5}$/);
    }
  });

  test('honors pickup / courier distinct ETAs', async () => {
    const transport = new MockOrdersTransport();
    const pickup = await transport.createOrder({
      ...BASE_INPUT,
      shippingOptionKey: 'pickup',
    });
    expect(pickup.eta).toBe('Today');
    const courier = await transport.createOrder({
      ...BASE_INPUT,
      shippingOptionKey: 'courier',
    });
    expect(courier.eta).toBe('1-3 days');
  });
});

describe('MockOrdersTransport — account collections', () => {
  test('listAddresses returns at least the default Home', async () => {
    const transport = new MockOrdersTransport(MOCK_SEED);
    const addrs = await transport.listAddresses();
    expect(addrs.length).toBeGreaterThanOrEqual(1);
    expect(addrs[0]!.label).toBe('Home');
  });

  test('listPaymentMethods includes exactly one default card', async () => {
    const transport = new MockOrdersTransport(MOCK_SEED);
    const cards = await transport.listPaymentMethods();
    const defaults = cards.filter((c) => c.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]!.last4).toHaveLength(4);
  });
});

describe('MockOrdersTransport — shipping quote', () => {
  test('mirrors the real backend: pickup free, courier a flat fee, no threshold', async () => {
    const transport = new MockOrdersTransport();
    const quote = await transport.getShippingQuote({ addressId: 'addr_home' });
    const pickup = quote.find((o) => o.key === 'pickup');
    const courier = quote.find((o) => o.key === 'courier');
    expect(pickup?.price).toBe(0);
    expect(courier?.price).toBe(STANDARD_DELIVERY_UZS);
  });
});

// The HTTP transport hardening that stops a backend shape mismatch from
// crashing the app with "undefined is not a function" on `.map`/`.find`.
describe('asList — collection response normalization', () => {
  test('passes a bare array through unchanged', () => {
    expect(asList<number>([1, 2, 3])).toEqual([1, 2, 3]);
  });

  test('unwraps the { items: [...] } envelope the backend actually returns', () => {
    expect(asList<number>({ items: [1, 2], total: 2 })).toEqual([1, 2]);
  });

  test('unwraps { data } and { results } envelopes too', () => {
    expect(asList<string>({ data: ['a'] })).toEqual(['a']);
    expect(asList<string>({ results: ['b'] })).toEqual(['b']);
  });

  test('degrades to [] for error objects / null / strings (no crash)', () => {
    expect(asList({ code: 'UNAUTHORIZED', message: 'Unauthorized' })).toEqual([]);
    expect(asList(null)).toEqual([]);
    expect(asList(undefined)).toEqual([]);
    expect(asList('oops')).toEqual([]);
    expect(asList({ items: 'not-an-array' })).toEqual([]);
  });
});
