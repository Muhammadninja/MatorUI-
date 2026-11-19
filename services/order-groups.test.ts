import { describe, expect, test } from 'vitest';

import {
  DELIVERED_CARD_DAYS,
  isActiveOrder,
  isClosedOrder,
  orderStage,
  ordersForTab,
  orderStageBodyKey,
  PICKUP_CARD_DAYS,
  statusCardOrders,
} from './order-groups';
import type { OrderListRow } from './orders-service';

const NOW = Date.parse('2026-11-19T12:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number) => new Date(NOW - days * DAY).toISOString();

const row = (id: string, over: Partial<OrderListRow> = {}): OrderListRow => ({
  id,
  date: '',
  status: 'Processing',
  items: 1,
  total: '',
  summary: '',
  serverStatus: 'paid',
  paymentType: 'payme',
  deliveryMethod: 'courier',
  ...over,
});

describe('orderStage', () => {
  test.each([
    ['pending_payment', 'payme', 'awaiting_payment'],
    ['pending_payment', null, 'awaiting_payment'],
    ['pending_payment', 'cash', 'awaiting_confirmation'],
    ['pending_payment', 'terminal', 'awaiting_confirmation'],
    ['paid', 'payme', 'preparing'],
    ['processing', 'cash', 'preparing'],
    ['shipped', 'payme', 'on_the_way'],
    ['delivered', 'payme', 'delivered'],
    ['refunded', 'payme', 'refunded'],
  ] as const)('%s, paid by %s → %s', (serverStatus, paymentType, stage) => {
    expect(orderStage(row('o', { serverStatus, paymentType }))).toBe(stage);
  });

  test('a delivered pickup order is ready to collect', () => {
    expect(orderStage(row('o', { serverStatus: 'delivered', deliveryMethod: 'pickup' }))).toBe(
      'ready_for_pickup',
    );
  });

  test.each(['cancelled', 'expired', 'something_new'])('%s has no stage', (serverStatus) => {
    expect(orderStage(row('o', { serverStatus }))).toBeNull();
  });

  test('a source with no status word falls back to the list pill', () => {
    expect(orderStage(row('o', { serverStatus: undefined, status: 'Out for delivery' }))).toBe('on_the_way');
    expect(orderStage(row('o', { serverStatus: undefined, status: 'Cancelled' }))).toBeNull();
  });

  test('on the way reads differently for a pickup order', () => {
    expect(orderStageBodyKey('on_the_way', 'pickup')).toBe('orderStage.onTheWayPickupBody');
    expect(orderStageBodyKey('on_the_way', 'courier')).toBe('orderStage.onTheWayBody');
  });
});

describe('My orders never lists a cancelled order', () => {
  const rows = [
    row('waiting', { serverStatus: 'pending_payment' }),
    row('cancelled', { serverStatus: 'cancelled', status: 'Cancelled' }),
    row('expired', { serverStatus: 'expired', status: 'Cancelled' }),
    row('shipped', { serverStatus: 'shipped' }),
    row('delivered', { serverStatus: 'delivered', deliveredAt: daysAgo(1) }),
    row('refunded', { serverStatus: 'refunded' }),
  ];

  test('all: everything but cancelled and expired, in the backend order', () => {
    expect(ordersForTab(rows, 'all', NOW).map((r) => r.id)).toEqual([
      'waiting',
      'shipped',
      'delivered',
      'refunded',
    ]);
  });

  test('active: only what is still under way', () => {
    expect(ordersForTab(rows, 'active', NOW).map((r) => r.id)).toEqual(['waiting', 'shipped']);
  });

  test('a pickup order waiting to be collected is active for a few days', () => {
    const fresh = row('p', { serverStatus: 'delivered', deliveryMethod: 'pickup', deliveredAt: daysAgo(2) });
    const old = { ...fresh, deliveredAt: daysAgo(PICKUP_CARD_DAYS + 1) };
    expect(isActiveOrder(fresh, NOW)).toBe(true);
    expect(isActiveOrder(old, NOW)).toBe(false);
    expect(isActiveOrder({ ...fresh, deliveredAt: undefined }, NOW)).toBe(false);
  });

  test('closed is cancelled or expired, whatever the source', () => {
    expect(isClosedOrder(row('o', { serverStatus: 'expired' }))).toBe(true);
    expect(isClosedOrder(row('o', { serverStatus: undefined, status: 'Cancelled' }))).toBe(true);
    expect(isClosedOrder(row('o', { serverStatus: 'refunded' }))).toBe(false);
  });
});

describe('the status card', () => {
  test('puts what needs the buyer first: paying, then collecting, then what is coming', () => {
    const rows = [
      row('preparing', { serverStatus: 'processing' }),
      row('shipped', { serverStatus: 'shipped' }),
      row('pickup', { serverStatus: 'delivered', deliveryMethod: 'pickup', deliveredAt: daysAgo(1) }),
      row('unpaid', { serverStatus: 'pending_payment' }),
      row('cash', { serverStatus: 'pending_payment', paymentType: 'cash' }),
    ];
    expect(statusCardOrders(rows, NOW).map((c) => c.row.id)).toEqual([
      'unpaid',
      'pickup',
      'shipped',
      'cash',
      'preparing',
    ]);
  });

  test('newest first within a stage, as the backend lists them', () => {
    const rows = [row('new', { serverStatus: 'shipped' }), row('old', { serverStatus: 'shipped' })];
    expect(statusCardOrders(rows, NOW).map((c) => c.row.id)).toEqual(['new', 'old']);
  });

  test('a delivered courier order stays a few days, then leaves', () => {
    const fresh = row('d', { serverStatus: 'delivered', deliveredAt: daysAgo(1) });
    const old = row('d', { serverStatus: 'delivered', deliveredAt: daysAgo(DELIVERED_CARD_DAYS + 1) });
    expect(statusCardOrders([fresh], NOW)).toHaveLength(1);
    expect(statusCardOrders([old], NOW)).toHaveLength(0);
  });

  test('never shows cancelled, expired, refunded or unknown orders', () => {
    const rows = [
      row('c', { serverStatus: 'cancelled' }),
      row('e', { serverStatus: 'expired' }),
      row('r', { serverStatus: 'refunded' }),
      row('u', { serverStatus: 'something_new' }),
    ];
    expect(statusCardOrders(rows, NOW)).toEqual([]);
  });
});
