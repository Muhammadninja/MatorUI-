import { describe, expect, test } from 'vitest';

import {
  canCancelOrder,
  formatCountdown,
  ORDER_CANCEL_WINDOW_MS,
  orderCancelDeadline,
} from './order-cancel-window';

const CREATED = '2026-11-12T10:00:00.000Z';
const CREATED_MS = Date.parse(CREATED);

describe('orderCancelDeadline', () => {
  test('is 20 minutes after creation for an order waiting for payment', () => {
    expect(orderCancelDeadline({ serverStatus: 'pending_payment', createdAt: CREATED })).toBe(
      CREATED_MS + 20 * 60_000,
    );
    expect(ORDER_CANCEL_WINDOW_MS).toBe(20 * 60_000);
  });

  test('an earlier server expiry wins, a later one does not', () => {
    const earlier = '2026-11-12T10:10:00.000Z';
    const later = '2026-11-12T10:30:00.000Z';
    expect(
      orderCancelDeadline({ serverStatus: 'pending_payment', createdAt: CREATED, expiresAt: earlier }),
    ).toBe(Date.parse(earlier));
    expect(
      orderCancelDeadline({ serverStatus: 'pending_payment', createdAt: CREATED, expiresAt: later }),
    ).toBe(CREATED_MS + ORDER_CANCEL_WINDOW_MS);
  });

  test.each(['paid', 'processing', 'shipped', 'delivered', 'cancelled', 'expired', undefined])(
    'has no window once an order is %s',
    (serverStatus) => {
      expect(orderCancelDeadline({ serverStatus, createdAt: CREATED })).toBeNull();
    },
  );

  test.each([undefined, null, '', 'not a date'])('has no window without a creation time (%s)', (createdAt) => {
    expect(orderCancelDeadline({ serverStatus: 'pending_payment', createdAt })).toBeNull();
  });
});

describe('canCancelOrder', () => {
  const order = { serverStatus: 'pending_payment', createdAt: CREATED };

  test('is offered for any payment type while the window runs', () => {
    expect(canCancelOrder(order, CREATED_MS + 60_000)).toBe(true);
    expect(canCancelOrder(order, CREATED_MS + ORDER_CANCEL_WINDOW_MS - 1)).toBe(true);
  });

  test('is gone when the time is up', () => {
    expect(canCancelOrder(order, CREATED_MS + ORDER_CANCEL_WINDOW_MS)).toBe(false);
  });

  test('is never offered for a paid order', () => {
    expect(canCancelOrder({ ...order, serverStatus: 'paid' }, CREATED_MS)).toBe(false);
  });
});

describe('formatCountdown', () => {
  test.each([
    [20 * 60_000, '20:00'],
    [19 * 60_000 + 5_000, '19:05'],
    [42_000, '0:42'],
    [41_001, '0:42'],
    [0, '0:00'],
    [-5_000, '0:00'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});
