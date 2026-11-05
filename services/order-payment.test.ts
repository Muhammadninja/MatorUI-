/**
 * What one attempt at paying an order comes to. Only the order's status on the backend can
 * say it is paid: a page that came back or was closed proves nothing either way.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

const { startPayment, openAuthSessionAsync, getOrder } = vi.hoisted(() => ({
  startPayment: vi.fn(),
  openAuthSessionAsync: vi.fn(),
  getOrder: vi.fn(),
}));

vi.mock('expo-linking', () => ({ createURL: () => 'mator://payment-return' }));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync }));
vi.mock('@/services/payments-service', () => ({ paymentsTransport: { startPayment } }));
vi.mock('@/services/orders-api', () => ({ ordersTransport: { getOrder } }));

import { PAYMENT_POLL, payOrder, readOrderPaymentState } from './order-payment';

const READY = { status: 'ready', checkoutUrl: 'https://checkout.paycom.uz/abc' };
const withStatus = (serverStatus: string) => ({ serverStatus });
const refusal = (code: string) => Object.assign(new Error(code), { code });

beforeEach(() => {
  vi.clearAllMocks();
  PAYMENT_POLL.delayMs = 0;
  startPayment.mockResolvedValue(READY);
  openAuthSessionAsync.mockResolvedValue({ type: 'success' });
  getOrder.mockResolvedValue(withStatus('paid'));
});

describe('payOrder', () => {
  test('asks to pay this order, and sends the buyer to the link', async () => {
    await payOrder('ord_1');

    expect(startPayment).toHaveBeenCalledWith({
      orderId: 'ord_1',
      provider: 'payme',
      returnUrl: 'mator://payment-return',
    });
    expect(openAuthSessionAsync).toHaveBeenCalledWith(READY.checkoutUrl, 'mator://payment-return');
  });

  test('paid is what the backend says, after the page returns', async () => {
    await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'paid' });
    expect(getOrder).toHaveBeenCalledWith('ord_1');
  });

  test('a webhook arriving a little late still counts', async () => {
    getOrder
      .mockResolvedValueOnce(withStatus('pending_payment'))
      .mockResolvedValueOnce(withStatus('pending_payment'))
      .mockResolvedValue(withStatus('paid'));

    await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'paid' });
    expect(getOrder).toHaveBeenCalledTimes(3);
  });

  test('coming back is not paying: with no confirmation it says so, and does not claim success', async () => {
    getOrder.mockResolvedValue(withStatus('pending_payment'));

    await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'failed', reason: 'unconfirmed' });
    expect(getOrder).toHaveBeenCalledTimes(PAYMENT_POLL.readsAfterReturn);
  });

  test.each(['cancel', 'dismiss'])('closing the page (%s) without paying is not paid', async (type) => {
    openAuthSessionAsync.mockResolvedValue({ type });
    getOrder.mockResolvedValue(withStatus('pending_payment'));

    await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'failed', reason: 'cancelled' });
    expect(getOrder).toHaveBeenCalledTimes(PAYMENT_POLL.readsAfterDismiss);
  });

  test('closing the page after paying in the Payme app is paid', async () => {
    openAuthSessionAsync.mockResolvedValue({ type: 'dismiss' });
    await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'paid' });
  });

  test('a page that crashes is judged by the order too', async () => {
    openAuthSessionAsync.mockRejectedValue(new Error('no browser'));
    getOrder.mockResolvedValue(withStatus('pending_payment'));
    await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'failed', reason: 'cancelled' });
  });

  test('not being able to read the status is not paid', async () => {
    getOrder.mockRejectedValue(new Error('offline'));
    await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'failed', reason: 'unconfirmed' });
  });

  test('a status it does not know is not paid', async () => {
    getOrder.mockResolvedValue(withStatus('some_new_status'));
    await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'failed', reason: 'unconfirmed' });
  });

  test('an order that expired during payment is closed', async () => {
    getOrder.mockResolvedValue(withStatus('expired'));
    await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'closed' });
  });

  describe('a refusal to start', () => {
    beforeEach(() => {
      getOrder.mockResolvedValue(withStatus('pending_payment'));
    });

    test.each([
      ['FISCAL_DATA_INCOMPLETE', 'fiscal'],
      ['PART_UNAVAILABLE', 'parts'],
      ['NETWORK', 'start'],
      ['HTTP_500', 'start'],
      ['PAYMENT_LINK_MISSING', 'start'],
    ])('%s is a failure (%s), and opens no page', async (code, reason) => {
      startPayment.mockRejectedValue(refusal(code));

      await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'failed', reason });
      expect(openAuthSessionAsync).not.toHaveBeenCalled();
    });

    test('an error with no code is a failure too', async () => {
      startPayment.mockRejectedValue(new Error('boom'));
      await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'failed', reason: 'start' });
    });

    test('may only mean the order was paid on an earlier attempt: its status decides', async () => {
      startPayment.mockRejectedValue(refusal('BAD_REQUEST'));
      getOrder.mockResolvedValue(withStatus('paid'));
      await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'paid' });
    });

    test('may mean the order expired', async () => {
      startPayment.mockRejectedValue(refusal('BAD_REQUEST'));
      getOrder.mockResolvedValue(withStatus('expired'));
      await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'closed' });
    });
  });

  test('only a transport with no gateway at all skips payment: the mock, in development', async () => {
    startPayment.mockResolvedValue({ status: 'unsupported' });

    await expect(payOrder('ord_1')).resolves.toEqual({ kind: 'no_online_step' });
    expect(openAuthSessionAsync).not.toHaveBeenCalled();
  });
});

describe('readOrderPaymentState', () => {
  test('an order that no longer exists cannot be paid', async () => {
    getOrder.mockResolvedValue(null);
    await expect(readOrderPaymentState('ord_1')).resolves.toBe('closed');
  });

  test('a failed read says nothing', async () => {
    getOrder.mockRejectedValue(new Error('offline'));
    await expect(readOrderPaymentState('ord_1')).resolves.toBe('unknown');
  });
});
