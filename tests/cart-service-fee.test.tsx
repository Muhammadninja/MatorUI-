/**
 * The cart context holds the server's figures for the cart, fee included, and never works a
 * fee out itself: a guest's cart, which the server never sees, has none.
 */
import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  authenticated: true,
  fetch: vi.fn(),
  charges: vi.fn(),
  updateQuantity: vi.fn(),
  load: vi.fn(),
}));
vi.mock('@/contexts/user.context', () => ({
  useUserContext: () => ({
    isAuthenticated: state.authenticated,
    profile: state.authenticated ? { id: 'user-a' } : null,
  }),
}));
vi.mock('@/services/cart-api', () => ({
  cartTransport: {
    fetch: state.fetch,
    charges: state.charges,
    updateQuantity: state.updateQuantity,
  },
}));
vi.mock('@/services/cart-storage', () => ({
  loadCart: state.load,
  saveCart: vi.fn(),
  clearStoredCart: vi.fn(),
}));
vi.mock('@/services/toast-service', () => ({ toastService: { danger: vi.fn() } }));
import { CartProvider, useCartContext } from '@/contexts/cart.context';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const line = { id: 'part_1', title: 'Колодки', description: '', price: 'UZS 99000', quantity: 1 };
const ONE = { subtotal: 99_000, discount: 0, serviceFee: 0, total: 99_000 };
const TWO = { subtotal: 198_000, discount: 0, serviceFee: 5_000, total: 203_000 };

beforeEach(() => {
  state.authenticated = true;
  state.load.mockReset().mockResolvedValue({ items: [line], appliedPromoCode: null });
  state.fetch
    .mockReset()
    .mockResolvedValue({ items: [line], appliedPromoCode: null, charges: ONE });
  state.charges.mockReset().mockReturnValue(ONE);
  state.updateQuantity.mockReset();
});

async function renderCart() {
  let value: ReturnType<typeof useCartContext>;
  function Probe() {
    value = useCartContext();
    return null;
  }
  let tree: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(createElement(CartProvider, null, createElement(Probe)));
  });
  return {
    get: () => value!,
    unmount: async () => {
      await act(async () => tree!.unmount());
    },
  };
}

test('after the server is read, the cart holds its figures', async () => {
  const cart = await renderCart();
  expect(cart.get().charges).toEqual(ONE);
  await cart.unmount();
});

test('a change to the cart brings the server’s new fee with it', async () => {
  const cart = await renderCart();
  state.updateQuantity.mockImplementation(async () => {
    state.charges.mockReturnValue(TWO);
    return { ...line, quantity: 2 };
  });

  await act(async () => {
    cart.get().incrementItem('part_1');
  });

  expect(state.updateQuantity).toHaveBeenCalledWith('part_1', 2);
  expect(cart.get().charges).toEqual(TWO);
  await cart.unmount();
});

test('a guest’s cart has no fee figures: the server has not seen it', async () => {
  state.authenticated = false;
  const cart = await renderCart();
  expect(cart.get().charges).toBeNull();
  expect(state.fetch).not.toHaveBeenCalled();
  await cart.unmount();
});
