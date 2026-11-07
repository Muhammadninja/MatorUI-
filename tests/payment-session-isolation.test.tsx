import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';

const mock = vi.hoisted(() => ({
  owner: 'a',
  epoch: 0,
  items: [{ id: 'x', quantity: 1 }],
  clearCart: vi.fn(),
  restoreCart: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
  clear: vi.fn(),
  invoice: vi.fn(),
  browser: vi.fn(),
  getOrder: vi.fn(),
  onPaid: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('@/contexts/user.context', () => ({
  useUserContext: () => ({ profile: { id: mock.owner }, isAuthenticated: true }),
}));
vi.mock('@/contexts/cart.context', () => ({
  useCartContext: () => ({
    items: mock.items,
    clearCart: mock.clearCart,
    restoreCart: mock.restoreCart,
  }),
}));
vi.mock('@/services/api-client', () => ({ getAuthRequestEpoch: () => mock.epoch }));
vi.mock('@/hooks/use-orders', () => ({ useOrder: () => ({ order: null }) }));
vi.mock('@/services/pending-payment-storage', () => ({
  loadPendingPayment: mock.load,
  savePendingPayment: mock.save,
  clearPendingPayment: mock.clear,
}));
vi.mock('@/services/orders-api', () => ({ ordersTransport: { getOrder: mock.getOrder } }));
vi.mock('@/services/payments-service', () => ({
  paymentsTransport: { startPayment: mock.invoice },
}));
vi.mock('expo-linking', () => ({ createURL: () => 'mator://payment-return' }));
vi.mock('expo-web-browser', () => ({ openAuthSessionAsync: mock.browser }));

import { useCheckoutPayment, useRecoverPayment } from '@/hooks/use-order-payment';
import { PAYMENT_POLL } from '@/services/order-payment';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const record = { orderId: 'order-a', totalLabel: '100 UZS', cartKey: 'x:1' };
const ready = { status: 'ready', checkoutUrl: 'https://checkout.example.test/a' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
let checkout!: ReturnType<typeof useCheckoutPayment>;
let recovery!: ReturnType<typeof useRecoverPayment>;
function CheckoutProbe() {
  checkout = useCheckoutPayment(mock.onPaid);
  return null;
}
function RecoveryProbe() {
  recovery = useRecoverPayment('order-a', mock.refresh);
  return null;
}
type Kind = 'checkout' | 'recovery';
const probe = (kind: Kind) => createElement(kind === 'checkout' ? CheckoutProbe : RecoveryProbe);
async function render(kind: Kind) {
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(probe(kind));
  });
  return tree;
}
const pay = (kind: Kind) => (kind === 'checkout' ? checkout.collect(record) : recovery.pay());
async function switchOwner(tree: TestRenderer.ReactTestRenderer, kind: Kind) {
  mock.owner = 'b';
  mock.epoch++;
  await act(async () => {
    tree.update(probe(kind));
  });
}
function expectNoCompletion() {
  expect(mock.clearCart).not.toHaveBeenCalled();
  expect(mock.clear).not.toHaveBeenCalled();
  expect(mock.restoreCart).not.toHaveBeenCalled();
  expect(mock.onPaid).not.toHaveBeenCalled();
  expect(mock.refresh).not.toHaveBeenCalled();
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.owner = 'a';
  mock.epoch = 0;
  mock.items = [{ id: 'x', quantity: 1 }];
  mock.load.mockReset().mockResolvedValue(null);
  mock.save.mockReset().mockResolvedValue(undefined);
  mock.clear.mockReset().mockResolvedValue(undefined);
  mock.restoreCart.mockReset().mockResolvedValue(mock.items);
  mock.invoice.mockReset().mockResolvedValue(ready);
  mock.browser.mockReset().mockResolvedValue({ type: 'success' });
  mock.getOrder.mockReset().mockResolvedValue({ serverStatus: 'paid' });
  PAYMENT_POLL.delayMs = 0;
});

test.each<Kind>(['checkout', 'recovery'])(
  '%s does not open an old invoice after A switches to B',
  async (kind) => {
    const tree = await render(kind);
    const invoice = deferred<typeof ready>();
    mock.invoice.mockReturnValueOnce(invoice.promise);
    let paying!: Promise<void>;
    await act(async () => {
      paying = pay(kind);
    });
    expect(mock.invoice).toHaveBeenCalledOnce();
    await switchOwner(tree, kind);
    await act(async () => {
      invoice.resolve(ready);
      await paying;
    });
    expect(mock.browser).not.toHaveBeenCalled();
    expect(mock.getOrder).not.toHaveBeenCalled();
    expectNoCompletion();
    if (kind === 'checkout') {
      expect(mock.save).toHaveBeenCalledTimes(1);
      expect(checkout.pending).toBeNull();
      expect(checkout.phase).toBe('idle');
    } else expect(recovery.paying).toBe(false);
    await act(async () => tree.unmount());
  },
);

test.each<Kind>(['checkout', 'recovery'])(
  '%s ignores A browser completion after switching to B',
  async (kind) => {
    const tree = await render(kind);
    const browser = deferred<{ type: string }>();
    mock.browser.mockReturnValueOnce(browser.promise);
    let paying!: Promise<void>;
    await act(async () => {
      paying = pay(kind);
    });
    expect(mock.browser).toHaveBeenCalledOnce();
    await switchOwner(tree, kind);
    await act(async () => {
      browser.resolve({ type: 'success' });
      await paying;
    });
    expect(mock.getOrder).not.toHaveBeenCalled();
    expectNoCompletion();
    await act(async () => tree.unmount());
  },
);

test.each<Kind>(['checkout', 'recovery'])(
  '%s allows only one same-turn payment attempt',
  async (kind) => {
    const tree = await render(kind);
    const invoice = deferred<typeof ready>();
    mock.invoice.mockReturnValueOnce(invoice.promise);
    let first!: Promise<void>, second!: Promise<void>;
    await act(async () => {
      first = pay(kind);
      second = pay(kind);
    });
    expect(mock.invoice).toHaveBeenCalledOnce();
    if (kind === 'checkout') expect(mock.save).toHaveBeenCalledOnce();
    await act(async () => {
      invoice.resolve(ready);
      await Promise.all([first, second]);
    });
    expect(mock.browser).toHaveBeenCalledOnce();
    expect(mock.getOrder).toHaveBeenCalledOnce();
    if (kind === 'checkout') {
      expect(mock.onPaid).toHaveBeenCalledExactlyOnceWith('order-a');
      expect(mock.clearCart).toHaveBeenCalledOnce();
    } else expect(mock.refresh).toHaveBeenCalledOnce();
    await act(async () => tree.unmount());
  },
);

test('checkout stops after pending storage resolves in a new account', async () => {
  const tree = await render('checkout');
  const saved = deferred<void>();
  mock.save.mockReturnValueOnce(saved.promise);
  let paying!: Promise<void>;
  await act(async () => {
    paying = checkout.collect(record);
  });
  await switchOwner(tree, 'checkout');
  await act(async () => {
    saved.resolve();
    await paying;
  });
  expect(mock.invoice).not.toHaveBeenCalled();
  expectNoCompletion();
  await act(async () => tree.unmount());
});

test('recovery cannot clear the new account after a delayed pending-record read', async () => {
  const tree = await render('recovery');
  const loaded = deferred<typeof record>();
  mock.load.mockReturnValueOnce(loaded.promise);
  let paying!: Promise<void>;
  await act(async () => {
    paying = recovery.pay();
  });
  expect(mock.load).toHaveBeenCalledWith('a');
  await switchOwner(tree, 'recovery');
  await act(async () => {
    loaded.resolve(record);
    await paying;
  });
  expectNoCompletion();
  await act(async () => tree.unmount());
});

test('unmounted checkout cannot open a delayed invoice', async () => {
  const tree = await render('checkout');
  const invoice = deferred<typeof ready>();
  mock.invoice.mockReturnValueOnce(invoice.promise);
  let paying!: Promise<void>;
  await act(async () => {
    paying = checkout.collect(record);
  });
  await act(async () => tree.unmount());
  await act(async () => {
    invoice.resolve(ready);
    await paying;
  });
  expect(mock.browser).not.toHaveBeenCalled();
  expectNoCompletion();
});

test('old pending-record hydration does not read A order after B takes over', async () => {
  const loaded = deferred<typeof record>();
  mock.load.mockReturnValueOnce(loaded.promise);
  const tree = await render('checkout');
  await switchOwner(tree, 'checkout');
  await act(async () => {
    loaded.resolve(record);
  });
  expect(mock.getOrder).not.toHaveBeenCalled();
  expect(checkout.pending).toBeNull();
  expectNoCompletion();
  await act(async () => tree.unmount());
});
