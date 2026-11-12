import { beforeEach, expect, test, vi } from 'vitest';

const storage = vi.hoisted(() => ({ map: new Map<string, string>(), failWrites: false, readsDuringSend: [] as (string | null)[] }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => storage.map.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    if (storage.failWrites) throw new Error('storage unavailable');
    storage.map.set(key, value);
  },
  removeItem: async (key: string) => { storage.map.delete(key); },
} }));

import {
  ORDER_ATTEMPT_MAX_AGE_MS,
  acquireOrderAttempt,
  resetOrderAttemptMemoryForTests,
  submitOrderAttempt,
} from '@/services/order-attempt';
import type { CreateOrderInput, CreateOrderResult } from '@/services/orders-service';

const OWNER = 'user_a';
const input: CreateOrderInput = { items: [{ productId: 'part_1', quantity: 1 }], addressId: null,
  paymentType: 'cash', shippingOptionKey: 'pickup', promoCode: null, confirmedTotalUzs: 190000 };
const placed: CreateOrderResult = { orderId: 'ord_1', eta: 'Awaiting payment', totalLabel: '190 000 UZS' };
const refusal = (code: string, status = 409) => Object.assign(new Error(code), { code, status });
const timeout = () => Object.assign(new Error('Request timed out.'), { code: 'TIMEOUT', status: 0 });

const send = vi.fn<(input: CreateOrderInput) => Promise<CreateOrderResult>>();
const keyOf = (call: number) => send.mock.calls[call]![0].idempotencyKey;
const attempt = (owner: string | null = OWNER, body: CreateOrderInput = input) =>
  submitOrderAttempt(owner, body, send).catch((error: unknown) => error);

beforeEach(() => {
  storage.map.clear();
  storage.failWrites = false;
  resetOrderAttemptMemoryForTests();
  send.mockReset();
});

test('a timeout keeps the key: the retry sends the same one, and success then clears it', async () => {
  send.mockRejectedValueOnce(timeout()).mockResolvedValueOnce(placed);

  expect(await attempt()).toMatchObject({ code: 'TIMEOUT' });
  expect(await attempt()).toEqual(placed);

  expect(keyOf(0)).toMatch(/^[A-Za-z0-9_]{8,128}$/);
  expect(keyOf(1)).toBe(keyOf(0));
  expect(storage.map.size).toBe(0);
});

test('the key is stored before the request leaves, so a kill mid-request keeps it', async () => {
  send.mockImplementationOnce(async (keyed) => {
    storage.readsDuringSend.push(storage.map.get(`@mator/orders/pending-attempt/${OWNER}`) ?? null);
    expect(JSON.parse(storage.readsDuringSend[0]!)).toMatchObject({ key: keyed.idempotencyKey });
    throw timeout();
  });
  await attempt();
  expect(storage.readsDuringSend).toHaveLength(1);
});

test('after an app restart (memory gone) the retry still sends the original key', async () => {
  send.mockRejectedValueOnce(new TypeError('Network request failed')).mockResolvedValueOnce(placed);
  await attempt();
  const sent = keyOf(0);

  resetOrderAttemptMemoryForTests(); // the process was killed and started again
  expect(await attempt()).toEqual(placed);

  expect(keyOf(1)).toBe(sent);
  expect(storage.map.size).toBe(0);
});

test('every network attempt reuses one key; a new key only for the next checkout', async () => {
  send.mockRejectedValueOnce(timeout()).mockRejectedValueOnce(timeout())
    .mockRejectedValueOnce(refusal('INTERNAL_ERROR', 500)).mockResolvedValueOnce(placed)
    .mockResolvedValueOnce({ ...placed, orderId: 'ord_2' });
  for (let i = 0; i < 4; i += 1) await attempt();
  await attempt();

  expect(new Set([0, 1, 2, 3].map(keyOf)).size).toBe(1);
  expect(keyOf(4)).not.toBe(keyOf(0));
});

test('a refusal that placed nothing keeps the key for the corrected order', async () => {
  send.mockRejectedValueOnce(timeout()).mockRejectedValueOnce(refusal('ORDER_TOTAL_CHANGED'))
    .mockResolvedValueOnce(placed);
  await attempt();
  await attempt();
  await attempt(OWNER, { ...input, confirmedTotalUzs: 195000 });

  expect(keyOf(1)).toBe(keyOf(0));
  // Had the unanswered first attempt gone through, the server answers REUSED, never a 2nd order.
  expect(keyOf(2)).toBe(keyOf(0));
});

test.each(['IDEMPOTENCY_KEY_REUSED', 'IDEMPOTENCY_KEY_EXPIRED', 'INVALID_IDEMPOTENCY_KEY'])(
  '%s ends the checkout: the error is shown and the next checkout gets a new key',
  async (code) => {
    send.mockRejectedValueOnce(refusal(code, code === 'INVALID_IDEMPOTENCY_KEY' ? 400 : 409))
      .mockResolvedValueOnce(placed);
    expect(await attempt()).toMatchObject({ code });
    await attempt();
    expect(keyOf(1)).not.toBe(keyOf(0));
  },
);

test('two taps at once share one key', async () => {
  send.mockResolvedValue(placed);
  await Promise.all([attempt(), attempt()]);
  expect(keyOf(1)).toBe(keyOf(0));
});

test('a key older than the server keeps it is replaced, never sent', async () => {
  const old = { key: 'ord_old_key_123', createdAt: Date.now() - ORDER_ATTEMPT_MAX_AGE_MS - 1 };
  storage.map.set(`@mator/orders/pending-attempt/${OWNER}`, JSON.stringify(old));
  send.mockResolvedValueOnce(placed);
  await attempt();
  expect(keyOf(0)).not.toBe(old.key);
});

test('an unreadable stored attempt is replaced rather than blocking checkout', async () => {
  storage.map.set(`@mator/orders/pending-attempt/${OWNER}`, '{not json');
  send.mockResolvedValueOnce(placed);
  expect(await attempt()).toEqual(placed);
  expect(keyOf(0)).toMatch(/^ord_/);
});

test('when storage cannot be written, retries in this session still share the key', async () => {
  storage.failWrites = true;
  send.mockRejectedValueOnce(timeout()).mockResolvedValueOnce(placed);
  await attempt();
  expect(await attempt()).toEqual(placed);
  expect(keyOf(1)).toBe(keyOf(0));
});

test('each buyer has their own checkout key', async () => {
  send.mockRejectedValue(timeout());
  await attempt('user_a');
  await attempt('user_b');
  await attempt('user_a');
  expect(keyOf(1)).not.toBe(keyOf(0));
  expect(keyOf(2)).toBe(keyOf(0));
});

test('without a signed-in buyer no key is kept or sent', async () => {
  send.mockResolvedValueOnce(placed);
  await attempt(null);
  expect(keyOf(0)).toBeUndefined();
  expect(storage.map.size).toBe(0);
});

test('acquire returns the stored attempt unchanged', async () => {
  const first = await acquireOrderAttempt(OWNER);
  resetOrderAttemptMemoryForTests();
  expect(await acquireOrderAttempt(OWNER)).toEqual(first);
});
