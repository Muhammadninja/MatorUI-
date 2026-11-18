import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';
import type { CartItem } from '@/services/cart-math';
import { CartMutationQueue } from '@/services/cart-mutation-queue';

const state = vi.hoisted(() => ({
  authenticated: true,
  owner: 'user-a',
  fetch: vi.fn(), addItem: vi.fn(), updateQuantity: vi.fn(), removeItem: vi.fn(), clear: vi.fn(),
  danger: vi.fn(),
}));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ isAuthenticated: state.authenticated, profile: state.authenticated ? { id: state.owner } : null }) }));
vi.mock('@/services/cart-api', () => ({ cartTransport: state }));
vi.mock('@/services/cart-storage', () => ({ loadCart: async () => null, saveCart: vi.fn(), clearStoredCart: vi.fn() }));
vi.mock('@/services/toast-service', () => ({ toastService: { danger: state.danger } }));
vi.mock('@/services/i18n', () => ({ default: { t: (key: string) => key } }));
import { CartProvider, useCartContext } from '@/contexts/cart.context';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const line: CartItem = { id: 'p1', title: 'Filter', description: '', price: 'UZS 100', quantity: 1 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  state.authenticated = true;
  state.owner = 'user-a';
  state.fetch.mockReset().mockResolvedValue({ items: [line], appliedPromoCode: null });
  state.addItem.mockReset();
  state.updateQuantity.mockReset();
  state.removeItem.mockReset().mockResolvedValue(undefined);
  state.clear.mockReset().mockResolvedValue(undefined);
  state.danger.mockReset();
});

async function renderCart() {
  let value!: ReturnType<typeof useCartContext>;
  function Probe() { value = useCartContext(); return null; }
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(CartProvider, null, createElement(Probe))); });
  return {
    get: () => value,
    session: async (owner: string | null) => {
      state.authenticated = owner !== null;
      state.owner = owner ?? '';
      await act(async () => tree.update(createElement(CartProvider, null, createElement(Probe))));
    },
    unmount: async () => { await act(async () => tree.unmount()); },
  };
}

test('add applies the server price and quantity instead of keeping the optimistic catalog line', async () => {
  state.addItem.mockResolvedValue({ ...line, price: 'UZS 95.57', quantity: 4 });
  const cart = await renderCart();
  await act(async () => { cart.get().addItem(line); });
  expect(cart.get().items).toEqual([{ ...line, price: 'UZS 95.57', quantity: 4 }]);
  expect(cart.get().totals.subtotal).toBe(382.28);
  await cart.unmount();
});

test('quantity update applies a repriced canonical line with fractional UZS', async () => {
  state.updateQuantity.mockResolvedValue({ ...line, price: 'UZS 21505.57', quantity: 3 });
  const cart = await renderCart();
  await act(async () => { cart.get().incrementItem(line.id); });
  expect(cart.get().items[0]).toMatchObject({ price: 'UZS 21505.57', quantity: 3 });
  expect(cart.get().totals.subtotal).toBeCloseTo(64516.71);
  await cart.unmount();
});

test('a canonical missing line removes the optimistic item', async () => {
  state.updateQuantity.mockResolvedValue(null);
  const cart = await renderCart();
  await act(async () => { cart.get().incrementItem(line.id); });
  expect(cart.get().items).toEqual([]);
  await cart.unmount();
});

test('an older response cannot overwrite a newer optimistic quantity or clear its pending state', async () => {
  const older = deferred<CartItem>();
  const newer = deferred<CartItem>();
  state.updateQuantity.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  const cart = await renderCart();
  await act(async () => { cart.get().incrementItem(line.id); });
  await act(async () => { cart.get().incrementItem(line.id); });
  expect(cart.get().items[0].quantity).toBe(3);
  await act(async () => { older.resolve({ ...line, price: 'UZS 99', quantity: 2 }); });
  expect(cart.get().items[0].quantity).toBe(3);
  expect(cart.get().pendingIds.has(line.id)).toBe(true);
  await act(async () => { newer.resolve({ ...line, price: 'UZS 98.5', quantity: 3 }); });
  expect(cart.get().items[0]).toMatchObject({ price: 'UZS 98.5', quantity: 3 });
  expect(cart.get().pendingIds.size).toBe(0);
  await cart.unmount();
});

test('a late add response cannot restore an item removed by a newer action', async () => {
  const older = deferred<CartItem>();
  state.addItem.mockReturnValueOnce(older.promise);
  const cart = await renderCart();
  await act(async () => { cart.get().addItem(line); });
  await act(async () => { cart.get().removeItem(line.id); });
  await act(async () => { older.resolve({ ...line, price: 'UZS 90', quantity: 2 }); });
  expect(cart.get().items).toEqual([]);
  expect(cart.get().pendingIds.size).toBe(0);
  await cart.unmount();
});

test('a late add response cannot restore an item after clearing the cart', async () => {
  const older = deferred<CartItem>();
  state.addItem.mockReturnValueOnce(older.promise);
  const cart = await renderCart();
  await act(async () => { cart.get().addItem(line); });
  await act(async () => { cart.get().clearCart(); });
  await act(async () => { older.resolve({ ...line, quantity: 2 }); });
  expect(cart.get().items).toEqual([]);
  await cart.unmount();
});

test('guest mutations stay local without requiring a canonical server line', async () => {
  state.authenticated = false;
  const cart = await renderCart();
  await act(async () => { cart.get().addItem(line); });
  expect(cart.get().items[0]).toMatchObject({ id: line.id, price: line.price, quantity: 1 });
  expect(state.addItem).not.toHaveBeenCalled();
  await act(async () => { await cart.get().refresh(); });
  expect(state.fetch).not.toHaveBeenCalled();
  expect(cart.get().pendingIds.size).toBe(0);
  await cart.unmount();
});

test('cart mutation and refresh failures use localized copy instead of backend English', async () => {
  const cart = await renderCart();
  state.updateQuantity.mockRejectedValueOnce(new Error('server response in English'));
  await act(async () => { cart.get().incrementItem(line.id); });
  expect(state.danger).toHaveBeenCalledWith('cart.updateErrorTitle', {
    description: 'cart.updateErrorBody',
  });
  expect(cart.get().error).toBe('cart.updateErrorBody');

  state.fetch.mockRejectedValueOnce(new Error('another English backend response'));
  await act(async () => { await cart.get().refresh(); });
  expect(state.danger).toHaveBeenLastCalledWith('cart.refreshErrorTitle', {
    description: 'cart.refreshErrorBody',
  });
  expect(cart.get().error).toBe('cart.refreshErrorBody');
  await cart.unmount();
});

test('two quantity taps before a render send both intended quantities', async () => {
  state.updateQuantity.mockImplementation(async (_id, quantity) => ({ ...line, quantity }));
  const cart = await renderCart();
  await act(async () => {
    cart.get().incrementItem(line.id);
    cart.get().incrementItem(line.id);
  });
  expect(state.updateQuantity.mock.calls.map((call) => call[1])).toEqual([2, 3]);
  expect(cart.get().items[0].quantity).toBe(3);
  await cart.unmount();
});

test('a failed item update never rolls back another item removal', async () => {
  const other = { ...line, id: 'p2' };
  state.fetch.mockResolvedValueOnce({ items: [line, other], appliedPromoCode: null });
  const failed = deferred<CartItem>();
  state.updateQuantity.mockReturnValueOnce(failed.promise);
  state.fetch.mockResolvedValue({ items: [line], appliedPromoCode: null });
  const cart = await renderCart();
  await act(async () => { cart.get().incrementItem(line.id); });
  await act(async () => { cart.get().removeItem(other.id); });
  await act(async () => { failed.reject(new Error('offline')); });
  expect(state.removeItem).toHaveBeenCalledWith(other.id);
  expect(cart.get().items).toEqual([line]);
  await cart.unmount();
});

test('a failed newer update recovers the price confirmed by an earlier write', async () => {
  const older = deferred<CartItem>();
  const canonical = { ...line, price: 'UZS 95.57', quantity: 2 };
  state.updateQuantity.mockReturnValueOnce(older.promise).mockRejectedValueOnce(new Error('failed'));
  const cart = await renderCart();
  state.fetch.mockResolvedValue({ items: [canonical], appliedPromoCode: null });
  await act(async () => {
    cart.get().incrementItem(line.id);
    cart.get().incrementItem(line.id);
  });
  await act(async () => { older.resolve(canonical); });
  expect(cart.get().items).toEqual([canonical]);
  expect(cart.get().pendingIds.size).toBe(0);
  await cart.unmount();
});

test('a delayed refresh cannot restore a removed item', async () => {
  const cart = await renderCart();
  const oldRead = deferred<{ items: CartItem[]; appliedPromoCode: null }>();
  state.fetch.mockReturnValueOnce(oldRead.promise);
  let refresh!: Promise<void>;
  await act(async () => { refresh = cart.get().refresh(); });
  await act(async () => { cart.get().removeItem(line.id); });
  await act(async () => {
    oldRead.resolve({ items: [line], appliedPromoCode: null });
    await refresh;
  });
  expect(cart.get().items).toEqual([]);
  await cart.unmount();
});

test('refresh started during removal waits for its server write', async () => {
  const cart = await renderCart();
  const removal = deferred<void>();
  state.removeItem.mockReturnValueOnce(removal.promise);
  await act(async () => { cart.get().removeItem(line.id); });
  let refresh!: Promise<void>;
  await act(async () => { refresh = cart.get().refresh(); });
  expect(state.fetch).toHaveBeenCalledTimes(1);
  state.fetch.mockResolvedValue({ items: [], appliedPromoCode: null });
  await act(async () => { removal.resolve(); await refresh; });
  expect(cart.get().items).toEqual([]);
  await cart.unmount();
});

test('the initial server read cannot replace a newer optimistic addition', async () => {
  const initial = deferred<{ items: CartItem[]; appliedPromoCode: null }>();
  const addition = deferred<CartItem>();
  state.fetch.mockReturnValueOnce(initial.promise);
  state.addItem.mockReturnValueOnce(addition.promise);
  const cart = await renderCart();
  await act(async () => { cart.get().addItem(line); });
  await act(async () => { initial.resolve({ items: [], appliedPromoCode: null }); });
  expect(cart.get().items).toEqual([line]);
  await act(async () => { addition.resolve({ ...line, price: 'UZS 95.57' }); });
  expect(cart.get().items[0].price).toBe('UZS 95.57');
  await cart.unmount();
});

test('a queued read from a previous session never reaches the transport', async () => {
  const queue = new CartMutationQueue();
  const previous = deferred<void>();
  const write = queue.enqueue(queue.begin('p1'), () => previous.promise);
  await Promise.resolve();
  const send = vi.fn().mockResolvedValue('old');
  const read = queue.read(send);
  queue.invalidate(true);
  expect(await queue.read(async () => 'new')).toBe('new');
  previous.resolve();
  await write;
  expect(await read).toBeUndefined();
  expect(send).not.toHaveBeenCalled();
});

test.each(['resolve', 'reject'] as const)('logout removes account data and ignores a late %s', async (outcome) => {
  const pending = deferred<CartItem>();
  state.updateQuantity.mockReturnValueOnce(pending.promise);
  const cart = await renderCart();
  await act(async () => { cart.get().incrementItem(line.id); });
  await cart.session(null);
  expect(cart.get().items).toEqual([]);
  expect(cart.get().pendingIds.size).toBe(0);
  await act(async () => {
    if (outcome === 'resolve') pending.resolve({ ...line, quantity: 2 });
    else pending.reject(new Error('old account failed'));
  });
  expect(cart.get().items).toEqual([]);
  expect(cart.get().error).toBeNull();
  await cart.unmount();
});

test('account switch while authenticated isolates old writes and failed new reads', async () => {
  const pending = deferred<CartItem>();
  state.updateQuantity.mockReturnValueOnce(pending.promise);
  const cart = await renderCart();
  await act(async () => { cart.get().incrementItem(line.id); });
  state.fetch.mockRejectedValueOnce(new Error('offline new account'));
  await cart.session('user-b');
  expect(cart.get().items).toEqual([]);
  await act(async () => { pending.resolve({ ...line, quantity: 9 }); });
  expect(cart.get().items).toEqual([]);
  expect(cart.get().pendingIds.size).toBe(0);
  await cart.unmount();
});
