import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { canCancelOrder, formatCountdown, orderPaymentDeadline } from './order-cancel-window';

const EXPIRES = '2026-11-12T10:30:00.000Z';
const waitingOnline = { serverStatus: 'pending_payment', paymentType: 'payme', expiresAt: EXPIRES };

describe('orderPaymentDeadline', () => {
  test("is exactly the backend's expires_at for an unpaid online order", () => {
    expect(orderPaymentDeadline(waitingOnline)).toBe(Date.parse(EXPIRES));
  });

  test('applies when the payment type is not stated (older responses)', () => {
    expect(orderPaymentDeadline({ ...waitingOnline, paymentType: null })).toBe(Date.parse(EXPIRES));
  });

  test.each(['cash', 'terminal'])('a %s order has no deadline: it waits for an operator', (paymentType) => {
    expect(orderPaymentDeadline({ ...waitingOnline, paymentType })).toBeNull();
  });

  test('an open Payme transaction (expiry_suspended) removes the deadline', () => {
    expect(orderPaymentDeadline({ ...waitingOnline, expirySuspended: true })).toBeNull();
    expect(orderPaymentDeadline({ ...waitingOnline, expirySuspended: false })).toBe(Date.parse(EXPIRES));
  });

  test.each(['paid', 'processing', 'shipped', 'delivered', 'cancelled', 'expired', undefined])(
    'no deadline once an order is %s',
    (serverStatus) => {
      expect(orderPaymentDeadline({ ...waitingOnline, serverStatus })).toBeNull();
    },
  );

  test.each([undefined, null, '', 'not a date'])('no deadline without a usable expires_at (%s)', (expiresAt) => {
    expect(orderPaymentDeadline({ ...waitingOnline, expiresAt })).toBeNull();
  });
});

describe('canCancelOrder', () => {
  test.each(['cash', 'terminal'])('offers the button on a waiting %s order, with no timer', (paymentType) => {
    expect(canCancelOrder({ serverStatus: 'pending_payment', paymentType })).toBe(true);
  });

  test.each(['payme', null, undefined])('never for payment type %s (the backend refuses it)', (paymentType) => {
    expect(canCancelOrder({ serverStatus: 'pending_payment', paymentType })).toBe(false);
  });

  test('never once the order has moved on', () => {
    expect(canCancelOrder({ serverStatus: 'paid', paymentType: 'cash' })).toBe(false);
  });
});

describe('the countdown never cancels by itself', () => {
  test('the hook has no timer-driven cancel call', () => {
    const hook = readFileSync(join(__dirname, '../hooks/use-order-cancel-window.ts'), 'utf8');
    expect(hook).not.toMatch(/\.mutate\(/);
    expect(hook).not.toMatch(/mutateAsync/);
  });
});

describe('formatCountdown', () => {
  test.each([
    [30 * 60_000, '30:00'],
    [19 * 60_000 + 5_000, '19:05'],
    [42_000, '0:42'],
    [41_001, '0:42'],
    [0, '0:00'],
    [-5_000, '0:00'],
  ])('%i ms → %s', (ms, text) => {
    expect(formatCountdown(ms)).toBe(text);
  });
});
