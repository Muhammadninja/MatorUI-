import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, test, vi } from 'vitest';
import type { CreateOrderInput, CreateOrderResult } from '@/services/orders-service';

const state = vi.hoisted(() => ({ createOrder: vi.fn() }));
vi.mock('@/services/orders-api', () => ({ ordersTransport: { createOrder: state.createOrder } }));
// The hook scopes orders to the signed-in account; only its owner matters here.
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ isAuthenticated: true, isHydrating: false, profile: { id: 'unit-owner' } }) }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios', select: (o: { ios?: unknown }) => o.ios } }));
import { useCreateOrder } from '@/hooks/use-orders';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let tree: TestRenderer.ReactTestRenderer | undefined;
let client: QueryClient | undefined;
afterEach(async () => {
  await act(async () => tree?.unmount());
  client?.clear();
  state.createOrder.mockReset();
});
const input: CreateOrderInput = { items: [{ productId: 'unit-part', quantity: 1 }],
  addressId: null, paymentType: 'cash', shippingOptionKey: 'pickup', promoCode: null };
async function renderOrder() {
  let value!: ReturnType<typeof useCreateOrder>;
  function Probe() { value = useCreateOrder(); return null; }
  // Deliberately hostile global policy: the hook must disable mutation retries.
  client = new QueryClient({ defaultOptions: { mutations: { retry: 3, retryDelay: 0 } } });
  await act(async () => {
    tree = TestRenderer.create(createElement(QueryClientProvider, { client: client! }, createElement(Probe)));
  });
  return () => value;
}

test('rapid submissions and taps after success produce only one order until explicit reset', async () => {
  let resolve!: (value: CreateOrderResult) => void;
  state.createOrder.mockReturnValueOnce(new Promise<CreateOrderResult>((done) => { resolve = done; }));
  const get = await renderOrder();
  let first!: Promise<CreateOrderResult | null>;
  let duplicate!: Promise<CreateOrderResult | null>;
  await act(async () => { first = get().placeOrder(input); duplicate = get().placeOrder(input); });
  expect(await duplicate).toBeNull();
  expect(state.createOrder).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ orderId: 'unit-order', eta: 'unit', totalLabel: '1 UZS' }); await first; });
  await act(async () => { expect(await get().placeOrder(input)).toBeNull(); });
  expect(state.createOrder).toHaveBeenCalledTimes(1);
  await act(async () => get().reset());
  state.createOrder.mockResolvedValueOnce({ orderId: 'next-unit-order', eta: 'unit', totalLabel: '1 UZS' });
  await act(async () => { await get().placeOrder(input); });
  expect(state.createOrder).toHaveBeenCalledTimes(2);
});

test('failed order creation is not automatically retried by React Query', async () => {
  state.createOrder.mockRejectedValue(new TypeError('response lost'));
  const get = await renderOrder();
  await act(async () => { expect(await get().placeOrder(input)).toBeNull(); });
  expect(state.createOrder).toHaveBeenCalledTimes(1);
});

test('empty cart never reaches the order transport', async () => {
  const get = await renderOrder();
  await act(async () => { expect(await get().placeOrder({ ...input, items: [] })).toBeNull(); });
  expect(state.createOrder).not.toHaveBeenCalled();
});
