/** Unit regressions only: synthetic transports; no real API or account mutations. */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const state = vi.hoisted(() => ({
  owner: 'account-a' as string | null,
  orders: vi.fn(), order: vi.fn(), addresses: vi.fn(), payments: vi.fn(), shipping: vi.fn(),
  notifications: vi.fn(), markRead: vi.fn(), markAllRead: vi.fn(), createOrder: vi.fn(),
}));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({
  profile: state.owner ? { id: state.owner } : null, isAuthenticated: !!state.owner, isHydrating: false,
}) }));
vi.mock('@/services/orders-api', () => ({ ordersTransport: {
  listOrders: state.orders, getOrder: state.order, listAddresses: state.addresses,
  listPaymentMethods: state.payments, getShippingQuote: state.shipping, createOrder: state.createOrder,
} }));
vi.mock('@/services/order-attempt-storage', () => ({
  loadPendingOrderAttempt: vi.fn(async () => null),
  savePendingOrderAttempt: vi.fn(async () => undefined),
  clearPendingOrderAttempt: vi.fn(async () => undefined),
}));
vi.mock('@/services/notifications-service', () => ({ notificationsTransport: {
  list: state.notifications, markRead: state.markRead, markAllRead: state.markAllRead,
} }));
import { ordersQueryKeys, useAddresses, useCreateOrder, useOrder, useOrders, usePaymentMethods, useShippingQuote } from '@/hooks/use-orders';
import { NOTIFICATIONS_QUERY_KEY, useNotifications } from '@/hooks/use-notifications';
import type { CreateOrderInput, CreateOrderResult } from '@/services/orders-service';

beforeEach(() => {
  vi.resetAllMocks();
  state.owner = 'account-a';
  state.orders.mockImplementation(async () => ({ items: [{ id: state.owner }], total: 1, page: 1, pageSize: 20 }));
  state.order.mockImplementation(async () => ({ id: state.owner, status: 'delivered' }));
  state.addresses.mockImplementation(async () => [{ id: state.owner }]);
  state.payments.mockImplementation(async () => [{ id: state.owner }]);
  state.shipping.mockImplementation(async () => [{ key: state.owner }]);
  state.notifications.mockImplementation(async () => [{ id: state.owner, title: state.owner, unread: true }]);
});
async function settle(predicate: () => boolean) {
  for (let i = 0; i < 50 && !predicate(); i++) await act(async () => { await new Promise((done) => setTimeout(done, 0)); });
  expect(predicate()).toBe(true);
}
async function mount<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 300_000 }, mutations: { retry: false } } });
  let value!: T;
  function Probe() { value = hook(); return null; }
  const element = () => <QueryClientProvider client={client}><Probe /></QueryClientProvider>;
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(element()); });
  return {
    current: () => value, client,
    update: async (owner: string | null) => { await act(async () => { state.owner = owner; tree.update(element()); }); },
    close: async () => { await act(async () => tree.unmount()); client.clear(); },
  };
}

test('account reads isolate A → B → guest → A with a shared query cache and gate refresh', async () => {
  const screen = await mount(() => ({ orders: useOrders(), order: useOrder('shared-order-id'), addresses: useAddresses(), payments: usePaymentMethods(), shipping: useShippingQuote({ addressId: 'shared-address-id' }), notifications: useNotifications() }));
  await settle(() => screen.current().addresses.items[0]?.id === 'account-a');
  const oldRefresh = screen.current().addresses.refresh;
  await screen.update('account-b');
  expect(screen.current().addresses.items.some((a) => a.id === 'account-a')).toBe(false);
  await settle(() => screen.current().addresses.items[0]?.id === 'account-b');
  expect(screen.current().orders.page?.items[0]?.id).toBe('account-b');
  expect(screen.current().order.order?.id).toBe('account-b');
  expect(screen.current().payments.items[0]?.id).toBe('account-b');
  expect(screen.current().shipping.options[0]?.key).toBe('account-b');
  expect(screen.current().notifications.notifications[0]?.id).toBe('account-b');
  const beforeStaleRefresh = state.addresses.mock.calls.length;
  await act(async () => oldRefresh());
  expect(state.addresses).toHaveBeenCalledTimes(beforeStaleRefresh);
  await screen.update(null);
  const before = [state.orders, state.order, state.addresses, state.payments, state.shipping, state.notifications].map((fn) => fn.mock.calls.length);
  const guest = screen.current();
  expect(guest.addresses.items).toEqual([]);
  expect(guest.payments.items).toEqual([]);
  expect(guest.orders.page).toBeNull();
  expect(guest.order.order).toBeNull();
  expect(guest.shipping.options).toEqual([]);
  expect(guest.notifications.notifications).toEqual([]);
  await act(async () => {
    guest.orders.refresh(); guest.order.refresh(); guest.addresses.refresh(); guest.payments.refresh(); guest.shipping.refresh();
    await guest.notifications.refresh(); guest.notifications.markRead('foreign'); guest.notifications.markAllRead();
  });
  expect([state.orders, state.order, state.addresses, state.payments, state.shipping, state.notifications].map((fn) => fn.mock.calls.length)).toEqual(before);
  expect(state.markRead).not.toHaveBeenCalled(); expect(state.markAllRead).not.toHaveBeenCalled();
  expect(screen.client.getQueriesData({ queryKey: ordersQueryKeys.addresses() })).toHaveLength(3);
  expect(screen.client.getQueriesData({ queryKey: NOTIFICATIONS_QUERY_KEY })).toHaveLength(3);
  await screen.update('account-a');
  expect(screen.current().addresses.items[0]?.id).toBe('account-a');
  await screen.close();
});

const input = { items: [{ productId: 'synthetic-product', quantity: 1 }], addressId: null, paymentType: 'cash', shippingOptionKey: 'standard', promoCode: null, totalLabel: '1' } as CreateOrderInput;
const result = { orderId: 'synthetic-order', eta: '', totalLabel: '1' } as CreateOrderResult;

test('concurrent order submissions send once and only the first caller continues; success stays locked until reset', async () => {
  let resolve!: (result: CreateOrderResult) => void;
  state.createOrder.mockImplementationOnce(() => new Promise<CreateOrderResult>((done) => { resolve = done; }));
  const screen = await mount(useCreateOrder);
  let first!: Promise<CreateOrderResult | null>, second!: Promise<CreateOrderResult | null>;
  await act(async () => { first = screen.current().placeOrder(input); second = screen.current().placeOrder(input); });
  expect(await second).toBeNull();
  expect(state.createOrder).toHaveBeenCalledTimes(1);
  await act(async () => screen.current().reset());
  expect(screen.current().phase).toBe('placing');
  await act(async () => { resolve(result); await first; });
  expect(screen.current().phase).toBe('success');
  expect(await screen.current().placeOrder(input)).toBeNull();
  expect(state.createOrder).toHaveBeenCalledTimes(1);
  await act(async () => screen.current().reset());
  state.createOrder.mockResolvedValueOnce({ ...result, orderId: 'second' });
  await act(async () => { await screen.current().placeOrder(input); });
  expect(state.createOrder).toHaveBeenCalledTimes(2);
  await screen.close();
});

test('failed order can retry, while account changes discard stale results and guest cannot submit', async () => {
  state.createOrder.mockRejectedValueOnce(new Error('offline'));
  const screen = await mount(useCreateOrder);
  await act(async () => { await screen.current().placeOrder(input); });
  expect(screen.current().phase).toBe('error');
  let resolve!: (result: CreateOrderResult) => void;
  state.createOrder.mockImplementationOnce(() => new Promise<CreateOrderResult>((done) => { resolve = done; }));
  let pending!: Promise<CreateOrderResult | null>;
  await act(async () => { pending = screen.current().placeOrder(input); });
  const firstKey = state.createOrder.mock.calls[0]?.[0]?.idempotencyKey;
  expect(firstKey).toEqual(expect.any(String));
  expect(state.createOrder.mock.calls[1]?.[0]?.idempotencyKey).toBe(firstKey);
  await screen.update('account-b');
  expect(screen.current().phase).toBe('idle');
  await act(async () => { resolve(result); expect(await pending).toBeNull(); });
  expect(screen.current().result).toBeNull();
  await screen.update(null);
  expect(await screen.current().placeOrder(input)).toBeNull();
  expect(state.createOrder).toHaveBeenCalledTimes(2);
  await screen.close();
});

test('notification failure after account change rolls back only its originating account cache', async () => {
  let reject!: (error: Error) => void;
  state.markRead.mockImplementationOnce(() => new Promise<void>((_done, fail) => { reject = fail; }));
  const screen = await mount(useNotifications);
  await settle(() => screen.current().notifications[0]?.id === 'account-a');
  await act(async () => { screen.current().markRead('account-a'); });
  await settle(() => state.markRead.mock.calls.length === 1);
  await settle(() => screen.current().notifications[0]?.unread === false);
  await screen.update('account-b');
  await settle(() => screen.current().notifications[0]?.id === 'account-b');
  await act(async () => { reject(new Error('offline')); });
  await settle(() => screen.client.getQueryData<{ unread: boolean }[]>([...NOTIFICATIONS_QUERY_KEY, 'account-a'])?.[0]?.unread === true);
  expect(screen.current().notifications[0]?.id).toBe('account-b');
  expect(screen.current().notifications[0]?.unread).toBe(true);
  await screen.close();
});


test('mark all read confirms only after success and rolls back a rejected operation', async () => {
  let reject!: (error: Error) => void;
  state.markAllRead.mockImplementationOnce(() => new Promise<void>((_done, fail) => { reject = fail; }));
  const screen = await mount(useNotifications);
  await settle(() => screen.current().unreadCount === 1);
  let pending!: Promise<boolean | null>;
  await act(async () => { pending = screen.current().markAllRead(); });
  await settle(() => state.markAllRead.mock.calls.length === 1);
  await act(async () => { expect(await screen.current().markAllRead()).toBeNull(); });
  expect(state.markAllRead).toHaveBeenCalledTimes(1);
  await act(async () => { reject(new Error('Rejected')); expect(await pending).toBe(false); });
  await settle(() => screen.current().unreadCount === 1);
  state.markAllRead.mockResolvedValueOnce(undefined);
  await act(async () => { expect(await screen.current().markAllRead()).toBe(true); });
  await settle(() => screen.current().unreadCount === 0);
  await screen.close();
});

test('tracking without an order ID is not-found and refresh cannot fetch an undefined order', async () => {
  const screen = await mount(() => useOrder(null));
  expect(screen.current().state).toBe('not_found');
  expect(screen.current().order).toBeNull();
  await act(async () => screen.current().refresh());
  expect(state.order).not.toHaveBeenCalled();
  await screen.close();
});

test('empty checkout preserves the earlier frontend guard and never reaches the transport', async () => {
  const screen = await mount(useCreateOrder);
  await act(async () => { expect(await screen.current().placeOrder({ ...input, items: [] })).toBeNull(); });
  expect(state.createOrder).not.toHaveBeenCalled();
  expect(screen.current().phase).toBe('idle');
  await screen.close();
});

test('a pending old-account mark-all neither blocks nor unlocks the new account action', async () => {
  let finishA!: () => void, finishB!: () => void;
  state.markAllRead.mockImplementationOnce(() => new Promise<void>((resolve) => { finishA = resolve; }))
    .mockImplementationOnce(() => new Promise<void>((resolve) => { finishB = resolve; }));
  const screen = await mount(useNotifications);
  await settle(() => screen.current().unreadCount === 1);
  let first!: Promise<boolean | null>, second!: Promise<boolean | null>;
  await act(async () => { first = screen.current().markAllRead(); });
  await settle(() => state.markAllRead.mock.calls.length === 1);
  await screen.update('account-b');
  await settle(() => screen.current().notifications[0]?.id === 'account-b');
  await act(async () => { second = screen.current().markAllRead(); });
  await settle(() => state.markAllRead.mock.calls.length === 2);
  await act(async () => { finishA(); expect(await first).toBeNull(); });
  await act(async () => { expect(await screen.current().markAllRead()).toBeNull(); });
  expect(state.markAllRead).toHaveBeenCalledTimes(2);
  await act(async () => { finishB(); expect(await second).toBe(true); });
  await screen.close();
});
