import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import type { CreateOrderInput } from '@/services/orders-service';

const state = vi.hoisted(() => ({ createOrder: vi.fn(), storage: new Map<string, string>() }));
vi.mock('@/services/orders-api', () => ({ ordersTransport: { createOrder: state.createOrder } }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: async (key: string) => state.storage.get(key) ?? null,
  setItem: async (key: string, value: string) => { state.storage.set(key, value); },
  removeItem: async (key: string) => { state.storage.delete(key); },
} }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ profile: { id: 'user_a' } }) }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios', select: (o: { ios?: unknown }) => o.ios } }));
import { useCreateOrder } from '@/hooks/use-orders';
import { resetOrderAttemptMemoryForTests } from '@/services/order-attempt';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let tree: TestRenderer.ReactTestRenderer | undefined;
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
  state.createOrder.mockReset();
  state.storage.clear();
  resetOrderAttemptMemoryForTests();
});

const input: CreateOrderInput = { items: [{ productId: 'part_1', quantity: 1 }], addressId: null,
  paymentType: 'cash', shippingOptionKey: 'pickup', promoCode: null };
const placed = { orderId: 'ord_1', eta: 'Awaiting payment', totalLabel: '1 000 UZS' };

async function mount() {
  let value!: ReturnType<typeof useCreateOrder>;
  function Probe() { value = useCreateOrder(); return null; }
  // A hostile global policy: the hook must not let React Query resubmit an order by itself.
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 0 } } });
  await act(async () => {
    tree = TestRenderer.create(createElement(QueryClientProvider, { client }, createElement(Probe)));
  });
  return () => value;
}
/** React Query hands mutation state to observers on its scheduler's next tick. */
const settle = () => act(async () => { await new Promise((done) => setTimeout(done, 0)); });
const keyOf = (call: number) => (state.createOrder.mock.calls[call]![0] as CreateOrderInput).idempotencyKey;

test('a lost answer, then the app is closed and reopened: the retry sends the original key', async () => {
  state.createOrder.mockRejectedValueOnce(Object.assign(new Error('Request timed out.'), { code: 'TIMEOUT' }));
  let get = await mount();
  await act(async () => { expect(await get().placeOrder(input)).toBeNull(); });
  await settle();
  expect(get()).toMatchObject({ phase: 'error', errorCode: 'TIMEOUT' });
  expect(state.createOrder).toHaveBeenCalledTimes(1); // no silent resubmission
  const sent = keyOf(0);
  expect(sent).toMatch(/^ord_[A-Za-z0-9_]+$/);

  // Process killed: the screen is gone and so is everything in memory, storage remains.
  await act(async () => tree?.unmount());
  resetOrderAttemptMemoryForTests();
  state.createOrder.mockResolvedValueOnce(placed);
  get = await mount();
  await act(async () => { expect(await get().placeOrder(input)).toEqual(placed); });
  await settle();

  expect(keyOf(1)).toBe(sent);
  expect(get()).toMatchObject({ phase: 'success', result: placed });
  expect(state.storage.size).toBe(0); // confirmed, so given up
});

test('a confirmed order ends the operation: the next checkout uses a new key', async () => {
  state.createOrder.mockResolvedValue(placed);
  const get = await mount();
  await act(async () => { await get().placeOrder(input); });
  await act(async () => get().reset());
  await act(async () => { await get().placeOrder(input); });
  expect(keyOf(1)).not.toBe(keyOf(0));
});

test('a refusal keeps its code for the screen and does not rotate the key', async () => {
  state.createOrder
    .mockRejectedValueOnce(Object.assign(new Error('Total changed'), { code: 'ORDER_TOTAL_CHANGED' }))
    .mockResolvedValueOnce(placed);
  const get = await mount();
  await act(async () => { await get().placeOrder(input); });
  await settle();
  expect(get()).toMatchObject({ phase: 'error', errorCode: 'ORDER_TOTAL_CHANGED' });
  await act(async () => get().reset());
  await act(async () => { await get().placeOrder({ ...input, confirmedTotalUzs: 1100 }); });
  expect(keyOf(1)).toBe(keyOf(0));
});
