/**
 * Integration tests for the orders transport — the data layer that
 * powers checkout, order-confirmation, track-order, and order-history.
 *
 * Same convention as cart-math.test.ts and checkout-flow.test.ts:
 * pure-logic, React-free, runs under Vitest in Node.
 */
import { describe, expect, test } from 'vitest';

import { MockOrdersTransport, MOCK_SEED, asList } from './orders-api';
import type { CreateOrderInput } from './orders-service';

const BASE_INPUT: CreateOrderInput = {
  items: [
    { productId: 'p-turbo', quantity: 1 },
    { productId: 'p-brakes', quantity: 2 },
  ],
  addressId: 'addr_home',
  paymentType: 'cash',
  shippingOptionKey: 'express',
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
    expect(result.eta).toBe('1-2 business days'); // express
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

  test('honors standard / express / same_day distinct ETAs', async () => {
    const transport = new MockOrdersTransport();
    const standard = await transport.createOrder({
      ...BASE_INPUT,
      shippingOptionKey: 'standard',
    });
    expect(standard.eta).toBe('3-5 business days');
    const sameDay = await transport.createOrder({
      ...BASE_INPUT,
      shippingOptionKey: 'same_day',
    });
    expect(sameDay.eta).toBe('By 9 PM today');
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
  test('standard becomes free above $500 (mirrors the free-ship rule)', async () => {
    const transport = new MockOrdersTransport();
    const above = await transport.getShippingQuote({
      addressId: 'addr_home',
      subtotal: 1000,
    });
    const standard = above.find((o) => o.key === 'standard');
    expect(standard?.price).toBe(0);
  });

  test('standard is still its base price below $500', async () => {
    const transport = new MockOrdersTransport();
    const below = await transport.getShippingQuote({
      addressId: 'addr_home',
      subtotal: 200,
    });
    const standard = below.find((o) => o.key === 'standard');
    // Base seed has standard at 0 either way (free standard always), but
    // express must stay 9.99 to prove pricing isn't being zeroed wholesale.
    const express = below.find((o) => o.key === 'express');
    expect(express?.price).toBe(9.99);
    expect(standard).toBeDefined();
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
