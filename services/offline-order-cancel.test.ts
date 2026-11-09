import { describe, expect, test } from 'vitest';

import { canCancelOfflineOrder } from './checkout-presentation';

describe('canCancelOfflineOrder', () => {
  test.each(['cash', 'terminal'] as const)('offers it on a waiting %s order', (paymentType) => {
    expect(canCancelOfflineOrder({ serverStatus: 'pending_payment', paymentType })).toBe(true);
  });

  test.each(['processing', 'paid', 'shipped', 'delivered', 'cancelled', 'expired'])(
    'never once an order is %s',
    (serverStatus) => {
      expect(canCancelOfflineOrder({ serverStatus, paymentType: 'cash' })).toBe(false);
    },
  );

  test.each(['payme', 'click', null, undefined] as const)('never for payment type %s', (paymentType) => {
    expect(
      canCancelOfflineOrder({ serverStatus: 'pending_payment', paymentType: paymentType as never }),
    ).toBe(false);
  });
});
