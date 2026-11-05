import { beforeEach, describe, expect, test, vi } from 'vitest';

const { store, storage } = vi.hoisted(() => {
  const store = new Map<string, string>();
  return {
    store,
    storage: {
      getItem: vi.fn(async (key: string) => store.get(key) ?? null),
      setItem: vi.fn(async (key: string, value: string) => void store.set(key, value)),
      removeItem: vi.fn(async (key: string) => void store.delete(key)),
    },
  };
});
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));

import {
  clearPendingPayment,
  loadPendingPayment,
  savePendingPayment,
} from './pending-payment-storage';

const RECORD = { orderId: 'ord_1', totalLabel: "100 so'm", cartKey: 'part_1:2' };

beforeEach(() => {
  vi.clearAllMocks();
  store.clear();
});

describe('the record of an unpaid order', () => {
  test('survives until cleared', async () => {
    await savePendingPayment('user_a', RECORD);
    await expect(loadPendingPayment('user_a')).resolves.toEqual(RECORD);

    await clearPendingPayment('user_a');
    await expect(loadPendingPayment('user_a')).resolves.toBeNull();
  });

  test("is one account's own", async () => {
    await savePendingPayment('user_a', RECORD);
    await expect(loadPendingPayment('user_b')).resolves.toBeNull();
    await expect(loadPendingPayment(null)).resolves.toBeNull();
  });

  test.each(['not json', '{}', '{"orderId":""}', '{"orderId":"o","totalLabel":1,"cartKey":""}', 'null'])(
    'reads %s as none, rather than crash or guess',
    async (raw) => {
      store.set('pending-payment:v1:user:user_a', raw);
      await expect(loadPendingPayment('user_a')).resolves.toBeNull();
    },
  );

  test('storage failing never stops a payment', async () => {
    storage.setItem.mockRejectedValueOnce(new Error('full'));
    await expect(savePendingPayment('user_a', RECORD)).resolves.toBeUndefined();
    storage.removeItem.mockRejectedValueOnce(new Error('full'));
    await expect(clearPendingPayment('user_a')).resolves.toBeUndefined();
    storage.getItem.mockRejectedValueOnce(new Error('full'));
    await expect(loadPendingPayment('user_a')).resolves.toBeNull();
  });
});
