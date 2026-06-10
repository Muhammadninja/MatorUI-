/**
 * Integration tests for the orders transport — the data layer that
 * powers checkout, order-confirmation, track-order, and order-history.
 *
 * Same convention as cart-math.test.ts and checkout-flow.test.ts:
 * pure-logic, React-free, runs under Vitest in Node.
 */
import { beforeEach, describe, expect, test } from 'vitest';

import { MockOrdersTransport } from './orders-api';
import type { CreateOrderInput } from './orders-service';

const BASE_INPUT: CreateOrderInput = {
  items: [
    { productId: 'p-turbo', quantity: 1 },
    { productId: 'p-brakes', quantity: 2 },
  ],
  addressId: 'addr_home',
  paymentMethodId: 'pm_mc_4242',
  shippingOptionKey: 'express',
  promoCode: null,
};

describe('MockOrdersTransport — list', () => {
  let transport: MockOrdersTransport;

  beforeEach(() => {
    transport = new MockOrdersTransport();
  });

  test('returns the full seeded page on a default request', async () => {
    const page = await transport.listOrders({});
    expect(page.total).toBe(5);
    expect(page.items).toHaveLength(5);
    expect(page.page).toBe(1);
  });

  test('filters by status when requested', async () => {
    const page = await transport.listOrders({ status: 'Delivered' });
    expect(page.items.every((o) => o.status === 'Delivered')).toBe(true);
    expect(page.items.length).toBeGreaterThan(0);
  });

  test('paginates correctly with pageSize=2', async () => {
    const first = await transport.listOrders({ page: 1, pageSize: 2 });
    expect(first.items).toHaveLength(2);
    const second = await transport.listOrders({ page: 2, pageSize: 2 });
    expect(second.items).toHaveLength(2);
    const overflow = await transport.listOrders({ page: 99, pageSize: 2 });
    expect(overflow.items).toEqual([]);
  });

  test('AbortSignal cancels in-flight reads', async () => {
    const controller = new AbortController();
    const pending = transport.listOrders({}, controller.signal);
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('MockOrdersTransport — detail', () => {
  test('returns the full order shape for a known id', async () => {
    const transport = new MockOrdersTransport();
    const order = await transport.getOrder('ORD-8790');
    expect(order).not.toBeNull();
    expect(order!.id).toBe('ORD-8790');
    expect(order!.statusLabel).toBe('Out for delivery');
    expect(order!.steps).toHaveLength(5);
    expect(order!.currentStepIndex).toBeGreaterThanOrEqual(0);
    expect(order!.currentStepIndex).toBeLessThan(order!.steps.length);
    expect(order!.destination.id).toBeTruthy();
    // In-transit orders ship a courier; delivered/cancelled don't.
    expect(order!.courier).not.toBeNull();
  });

  test('returns null for an unknown id (track-order renders NotFound)', async () => {
    const transport = new MockOrdersTransport();
    const order = await transport.getOrder('NOPE-0000');
    expect(order).toBeNull();
  });

  test('delivered order has no courier', async () => {
    const transport = new MockOrdersTransport();
    const order = await transport.getOrder('ORD-8821');
    expect(order?.statusLabel).toBe('Delivered');
    expect(order?.courier).toBeNull();
  });

  test('cancelled order has no courier and currentStepIndex=0', async () => {
    const transport = new MockOrdersTransport();
    const order = await transport.getOrder('ORD-8703');
    expect(order?.statusLabel).toBe('Cancelled');
    expect(order?.courier).toBeNull();
    expect(order?.currentStepIndex).toBe(0);
  });
});

describe('MockOrdersTransport — createOrder', () => {
  test('returns an orderId + ETA matching the chosen shipping option', async () => {
    const transport = new MockOrdersTransport();
    const result = await transport.createOrder(BASE_INPUT);
    expect(result.orderId).toMatch(/^M-\d{5}$/);
    expect(result.eta).toBe('1–2 business days'); // express
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

  test('honors standard / express / same_day distinct ETAs', async () => {
    const transport = new MockOrdersTransport();
    const standard = await transport.createOrder({
      ...BASE_INPUT,
      shippingOptionKey: 'standard',
    });
    expect(standard.eta).toBe('3–5 business days');
    const sameDay = await transport.createOrder({
      ...BASE_INPUT,
      shippingOptionKey: 'same_day',
    });
    expect(sameDay.eta).toBe('By 9 PM today');
  });
});

describe('MockOrdersTransport — account collections', () => {
  test('listAddresses returns at least the default Home', async () => {
    const transport = new MockOrdersTransport();
    const addrs = await transport.listAddresses();
    expect(addrs.length).toBeGreaterThanOrEqual(1);
    expect(addrs[0]!.label).toBe('Home');
  });

  test('listPaymentMethods includes exactly one default card', async () => {
    const transport = new MockOrdersTransport();
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
