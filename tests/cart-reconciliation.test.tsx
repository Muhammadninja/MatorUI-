import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';
import type { CartSnapshot } from '@/services/cart-api';
import type { StoredCart } from '@/services/cart-storage';

const state = vi.hoisted(() => ({
  authenticated: true,
  fetch: vi.fn(),
  load: vi.fn(),
}));
vi.mock('@/contexts/user.context', () => ({
    useUserContext: () => ({ isAuthenticated: state.authenticated, profile: state.authenticated ? { id: 'user-a' } : null }),
}));
vi.mock('@/services/cart-api', () => ({ cartTransport: { fetch: state.fetch } }));
vi.mock('@/services/cart-storage', () => ({
  loadCart: state.load, saveCart: vi.fn(), clearStoredCart: vi.fn(),
}));
vi.mock('@/services/toast-service', () => ({ toastService: { danger: vi.fn() } }));
import { CartProvider, useCartContext } from '@/contexts/cart.context';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const cached = { id: 'old', title: 'Cached item', description: '', price: 'UZS 100', quantity: 1 };
const serverItem = { ...cached, id: 'server', title: 'Server item', quantity: 2 };

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  state.authenticated = true;
  state.fetch.mockReset().mockResolvedValue({ items: [], appliedPromoCode: null });
  state.load.mockReset().mockResolvedValue({ items: [cached], appliedPromoCode: null });
});

async function renderCart() {
  let value: ReturnType<typeof useCartContext>;
  function Probe() { value = useCartContext(); return null; }
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(CartProvider, null, createElement(Probe))); });
  return {
    get: () => value!,
    setAuthenticated: async (authenticated: boolean) => {
      state.authenticated = authenticated;
      await act(async () => {
        tree!.update(createElement(CartProvider, null, createElement(Probe)));
      });
    },
    unmount: async () => { await act(async () => tree!.unmount()); },
  };
}

test('successful empty server cart removes stale cached lines after hydration', async () => {
  const cart = await renderCart();
  expect(state.fetch).toHaveBeenCalledOnce();
  expect(cart.get().items).toEqual([]);
  await cart.unmount();
});

test('failed server request retains the offline cache', async () => {
  state.fetch.mockRejectedValue(new Error('offline'));
  const cart = await renderCart();
  expect(cart.get().items).toEqual([cached]);
  await cart.unmount();
});

test('guest cart stays local and never fetches an authenticated endpoint', async () => {
  state.authenticated = false;
  const cart = await renderCart();
  expect(state.fetch).not.toHaveBeenCalled();
  expect(cart.get().items).toEqual([cached]);
  await cart.unmount();
});

test.each([{ remoteItems: [] }, { remoteItems: [serverItem] }])(
  'cold launch waits for slow cache hydration before applying authoritative server items: $remoteItems',
  async ({ remoteItems }) => {
    const storage = deferred<StoredCart>();
    state.load.mockReturnValue(storage.promise);
    state.fetch.mockResolvedValue({ items: remoteItems, appliedPromoCode: null });
    const cart = await renderCart();
    expect(cart.get().isHydrated).toBe(false);
    expect(state.fetch).not.toHaveBeenCalled();
    await act(async () => { storage.resolve({ items: [cached], appliedPromoCode: null }); });
    expect(cart.get().isHydrated).toBe(true);
    expect(state.fetch).toHaveBeenCalledOnce();
    expect(cart.get().items).toEqual(remoteItems);
    await cart.unmount();
  },
);

test('restored authentication replaces cached lines with an empty server cart', async () => {
  state.authenticated = false;
  const cart = await renderCart();
  expect(cart.get().items).toEqual([cached]);
  expect(state.fetch).not.toHaveBeenCalled();
  await cart.setAuthenticated(true);
  expect(state.fetch).toHaveBeenCalledOnce();
  expect(cart.get().items).toEqual([]);
  await cart.unmount();
});

test('a pending request from the signed-out session cannot overwrite a later session cart', async () => {
  const oldRequest = deferred<CartSnapshot>();
  state.fetch.mockReturnValueOnce(oldRequest.promise);
  const cart = await renderCart();
  await cart.setAuthenticated(false);
  state.fetch.mockResolvedValue({ items: [serverItem], appliedPromoCode: null });
  await cart.setAuthenticated(true);
  expect(cart.get().items).toEqual([serverItem]);
  await act(async () => { oldRequest.resolve({ items: [], appliedPromoCode: null }); });
  expect(cart.get().items).toEqual([serverItem]);
  await cart.unmount();
});
