/**
 * Keeping the cart when payment fails. The backend empties its cart when the order is
 * created and a fresh fetch treats it as the truth, so this has to put the lines back on the
 * server: a cart only kept on screen would be gone at the next launch.
 */
import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';
import type { CartSnapshot } from '@/services/cart-api';
import { MockCartTransport } from '@/tests/support/transports/cart-api';

const state = vi.hoisted(() => ({
  authenticated: true,
  owner: 'user-a',
  epoch: 0,
  transport: null as unknown as Record<string, any>,
}));
vi.mock('@/contexts/user.context', () => ({
  useUserContext: () => ({
    isAuthenticated: state.authenticated,
    profile: state.authenticated ? { id: state.owner } : null,
  }),
}));
vi.mock('@/services/api-client', () => ({ getAuthRequestEpoch: () => state.epoch }));
vi.mock('@/services/cart-api', () => {
  return {
    cartTransport: new Proxy(
      {},
      {
        get: (_, key) =>
          typeof state.transport[key as string] === 'function'
            ? (...args: unknown[]) => state.transport[key as string](...args)
            : undefined,
      },
    ),
  };
});
vi.mock('@/services/cart-storage', () => ({
  loadCart: vi.fn(async () => null),
  saveCart: vi.fn(),
  clearStoredCart: vi.fn(),
}));
vi.mock('@/services/toast-service', () => ({ toastService: { danger: vi.fn() } }));

import { CartProvider, useCartContext } from '@/contexts/cart.context';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const line = (id: string, quantity: number) => ({
  id,
  title: id,
  description: '',
  price: 'UZS 100',
  quantity,
});
const SNAPSHOT: CartSnapshot = {
  items: [line('part_1', 2), line('part_2', 1)],
  appliedPromoCode: null,
};

/** The server as it is once an order has taken the cart. */
const consumed = () => {
  state.transport.clear();
};

let value: ReturnType<typeof useCartContext>;
const Probe = () => {
  value = useCartContext();
  return null;
};
const render = async () => {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(createElement(CartProvider, null, createElement(Probe)));
  });
  return tree;
};
const restore = async () => {
  let result: unknown;
  await act(async () => {
    result = await value.restoreCart();
  });
  return result as typeof value.items;
};

beforeEach(() => {
  state.authenticated = true;
  state.owner = 'user-a';
  state.epoch = 0;
  state.transport = new MockCartTransport({
    items: SNAPSHOT.items.map((i) => ({ ...i })),
    appliedPromoCode: null,
  }) as unknown as Record<string, any>;
});

test.each(['resolve', 'reject'] as const)(
  'a pending restore stops after an owner switch when the first add %s',
  async (outcome) => {
    const tree = await render();
    consumed();
    let resolve!: (item: typeof SNAPSHOT.items[number]) => void;
    let reject!: (error: Error) => void;
    const pending = new Promise<typeof SNAPSHOT.items[number]>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    const addA = vi.fn(() => pending);
    state.transport.addItem = addA;
    let restoring!: Promise<unknown>;
    await act(async () => { restoring = value.restoreCart(); });
    expect(addA).toHaveBeenCalledOnce();

    const next = new MockCartTransport({ items: [], appliedPromoCode: null });
    const addB = vi.spyOn(next, 'addItem');
    const promoB = vi.spyOn(next, 'applyPromo');
    const fetchB = vi.spyOn(next, 'fetch');
    state.transport = next as unknown as Record<string, any>;
    state.owner = 'user-b';
    state.epoch++;
    await act(async () => {
      tree.update(createElement(CartProvider, null, createElement(Probe)));
    });
    const readsBeforeOldAnswer = fetchB.mock.calls.length;
    await act(async () => {
      if (outcome === 'resolve') resolve(SNAPSHOT.items[0]);
      else reject(new Error('previous session ended'));
      await restoring;
    });
    expect(addB).not.toHaveBeenCalled();
    expect(promoB).not.toHaveBeenCalled();
    expect(fetchB).toHaveBeenCalledTimes(readsBeforeOldAnswer);
    expect(value.items).toEqual([]);
    expect((await next.fetch()).items).toEqual([]);
    await act(async () => tree.unmount());
  },
);

test('an auth invalidation stops restore before React has cleaned up the old owner', async () => {
  const tree = await render();
  consumed();
  let answer!: (snapshot: CartSnapshot) => void;
  state.transport.fetch = vi.fn(() => new Promise<CartSnapshot>((resolve) => { answer = resolve; }));
  const add = vi.spyOn(state.transport, 'addItem');
  let restoring!: Promise<unknown>;
  await act(async () => { restoring = value.restoreCart(); });
  state.epoch++;
  await act(async () => {
    answer({ items: [], appliedPromoCode: null });
    await restoring;
  });
  expect(add).not.toHaveBeenCalled();
  expect(state.transport.fetch).toHaveBeenCalledOnce();
  await act(async () => tree.unmount());
});

test('a retained restore action cannot start reads or writes after auth invalidation', async () => {
  const tree = await render();
  consumed();
  const retained = value.restoreCart;
  const fetch = vi.spyOn(state.transport, 'fetch');
  const add = vi.spyOn(state.transport, 'addItem');
  state.epoch++;
  await act(async () => { await retained(); });
  expect(fetch).not.toHaveBeenCalled();
  expect(add).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('puts every line back on the server, at the right quantities', async () => {
  const tree = await render();
  consumed();

  const items = await restore();

  const server = await state.transport.fetch();
  expect(server.items.map((i: { id: string; quantity: number }) => [i.id, i.quantity])).toEqual([
    ['part_1', 2],
    ['part_2', 1],
  ]);
  expect(items.map((i) => [i.id, i.quantity])).toEqual([
    ['part_1', 2],
    ['part_2', 1],
  ]);
  expect(value.items).toHaveLength(2);
  await act(async () => tree.unmount());
});

test('repeating it adds nothing, so a second failed payment does not double the cart', async () => {
  const tree = await render();
  consumed();

  await restore();
  await restore();
  await restore();

  const server = await state.transport.fetch();
  expect(server.items.map((i: { quantity: number }) => i.quantity)).toEqual([2, 1]);
  await act(async () => tree.unmount());
});

test('tops up a line that is partly there, and leaves more than was wanted alone', async () => {
  const tree = await render();
  consumed();
  await state.transport.addItem({ productId: 'part_1', title: '', description: '', price: '' });
  await state.transport.addItem({ productId: 'part_2', title: '', description: '', price: '', quantity: 5 });

  await restore();

  const server = await state.transport.fetch();
  expect(server.items.map((i: { id: string; quantity: number }) => [i.id, i.quantity])).toEqual([
    ['part_1', 2],
    ['part_2', 5],
  ]);
  await act(async () => tree.unmount());
});

test('a part no longer sold stays out, and does not stop the others', async () => {
  const tree = await render();
  consumed();
  const addItem = state.transport.addItem.bind(state.transport);
  state.transport.addItem = vi.fn((input: { productId: string }) =>
    input.productId === 'part_1' ? Promise.reject(new Error('sold out')) : addItem(input),
  );

  const items = await restore();

  expect(items.map((i) => i.id)).toEqual(['part_2']);
  await act(async () => tree.unmount());
});

test('a sourced offer cannot go back by part id, so it is not tried', async () => {
  state.transport = new MockCartTransport({
    items: [{ ...line('item_offer', 1), sourced: true }, line('part_1', 1)],
    appliedPromoCode: null,
  }) as unknown as Record<string, any>;
  const tree = await render();
  consumed();
  const add = vi.spyOn(state.transport, 'addItem');

  await restore();

  expect(add.mock.calls.map(([input]) => (input as { productId: string }).productId)).toEqual(['part_1']);
  await act(async () => tree.unmount());
});

test('a promo on the cart goes back too', async () => {
  state.transport = new MockCartTransport({
    items: [{ ...line('part_1', 1), price: 'UZS 100000000' }],
    appliedPromoCode: null,
  }) as unknown as Record<string, any>;
  const tree = await render();
  await act(async () => {
    value.applyPromoCode('WELCOME10');
  });
  expect(value.appliedPromo?.code).toBe('WELCOME10');
  consumed();

  await restore();

  expect((await state.transport.fetch()).appliedPromoCode).toBe('WELCOME10');
  expect(value.appliedPromo?.code).toBe('WELCOME10');
  await act(async () => tree.unmount());
});

test('offline, the lines stay on screen for now, with no error thrown at the buyer', async () => {
  const tree = await render();
  state.transport.fetch = vi.fn().mockRejectedValue(new Error('offline'));

  const items = await restore();

  expect(items.map((i) => i.id)).toEqual(['part_1', 'part_2']);
  expect(value.pendingIds.size).toBe(0);
  await act(async () => tree.unmount());
});

test('a guest has no server cart to restore', async () => {
  state.authenticated = false;
  const tree = await render();
  const fetch = vi.spyOn(state.transport, 'fetch');

  await restore();

  expect(fetch).not.toHaveBeenCalled();
  await act(async () => tree.unmount());
});

test('holds back a delivery quote while it runs', async () => {
  const tree = await render();
  consumed();
  let answer!: () => void;
  const fetch = state.transport.fetch.bind(state.transport);
  state.transport.fetch = vi.fn(
    () => new Promise((resolve) => (answer = () => resolve(fetch()))),
  );

  let restoring!: Promise<unknown>;
  await act(async () => {
    restoring = value.restoreCart();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(value.pendingIds.size).toBe(1);

  state.transport.fetch = vi.fn(fetch);
  await act(async () => {
    answer();
    await restoring;
  });
  expect(value.pendingIds.size).toBe(0);
  await act(async () => tree.unmount());
});
