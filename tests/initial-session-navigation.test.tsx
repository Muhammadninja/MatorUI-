import React, { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  profile: null as { id: string } | null,
  isAuthenticated: false,
  isHydrating: true,
  epoch: 0,
}));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => auth }));
vi.mock('@/services/api-client', () => ({ getAuthRequestEpoch: () => auth.epoch }));
vi.mock('@/services/cart-api', () => ({
  cartTransport: { fetch: async () => ({ items: [], appliedPromoCode: null }) },
}));
vi.mock('@/services/cart-storage', () => ({
  loadCart: async () => null,
  saveCart: vi.fn(),
  clearStoredCart: vi.fn(),
}));
vi.mock('@/services/toast-service', () => ({ toastService: { danger: vi.fn() } }));
vi.mock('@/services/favorites-api', () => ({ createFavoritesTransport: () => undefined }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@/services/likes-storage', async (original) => {
  const actual = await original<typeof import('@/services/likes-storage')>();
  return {
    ...actual,
    favoritesStorage: new actual.FavoritesStorage({
      getItem: async () => null,
      setItem: async () => undefined,
    }),
  };
});

import { CartProvider } from '@/contexts/cart.context';
import { useSessionContextValue } from '@/contexts/session-context-value';
import { LikesProvider, useLikesContext } from '@/contexts/likes.context';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let tree: ReactTestRenderer | undefined;
let mounts = 0;
let unmounts = 0;
let likes: ReturnType<typeof useLikesContext>;
function NavigatorProbe() {
  likes = useLikesContext();
  useEffect(() => {
    mounts++;
    return () => {
      unmounts++;
    };
  }, []);
  return null;
}
function App() {
  return (
    <CartProvider>
      <LikesProvider>
        <NavigatorProbe />
      </LikesProvider>
    </CartProvider>
  );
}
async function render() {
  await act(async () => {
    if (tree) tree.update(<App />);
    else tree = create(<App />);
  });
}
beforeEach(() => {
  Object.assign(auth, { profile: null, isAuthenticated: false, isHydrating: true, epoch: 0 });
  mounts = 0;
  unmounts = 0;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
});

test('guest navigation mounts immediately and survives storage hydration', async () => {
  await render();
  expect(mounts).toBe(1);
  auth.isHydrating = false;
  await render();
  expect(mounts).toBe(1);
  expect(unmounts).toBe(0);
  expect(likes.isHydrated).toBe(true);
});

test('cached owner renders while /me is pending and hydration completion keeps navigation mounted', async () => {
  await render();
  auth.profile = { id: 'unit-a' };
  auth.isAuthenticated = true;
  await render();
  expect(mounts).toBe(1);
  expect(likes.isHydrated).toBe(false);
  expect(likes.toggleLike('during-hydration')).toBe(false);
  // Both a refreshed same-owner profile and an offline retained cache settle
  // hydration. Neither may tear down an already mounted native navigator.
  auth.profile = { id: 'unit-a' };
  auth.isHydrating = false;
  await render();
  expect(mounts).toBe(1);
  expect(unmounts).toBe(0);
  expect(likes.isHydrated).toBe(true);
  expect(likes.isLiked('during-hydration')).toBe(false);
});

test('resolving a missing cached owner does not remount navigation', async () => {
  await render();
  auth.profile = { id: 'unit-a' };
  auth.isAuthenticated = true;
  auth.isHydrating = false;
  await render();
  expect(mounts).toBe(1);
  expect(unmounts).toBe(0);
});

test('sign-out and a new auth epoch still discard previous session state', async () => {
  Object.assign(auth, { profile: { id: 'unit-a' }, isAuthenticated: true, isHydrating: false });
  await render();
  await act(async () => {
    likes.toggleLike('a-only');
  });
  expect(likes.isLiked('a-only')).toBe(true);
  Object.assign(auth, { profile: null, isAuthenticated: false, epoch: 1 });
  await render();
  expect(mounts).toBe(1);
  expect(unmounts).toBe(0);
  expect(likes.isLiked('a-only')).toBe(false);
  auth.epoch = 2;
  await render();
  expect(mounts).toBe(1);
  expect(unmounts).toBe(0);
});

test('A -> B -> A rejects late publications from either previous controller', async () => {
  let current!: ReturnType<typeof useSessionContextValue<string>>;
  let key = 'a';
  function Probe() {
    current = useSessionContextValue(key, 'empty');
    return null;
  }
  await act(async () => {
    tree = create(<Probe />);
  });
  const firstA = current[1];
  await act(async () => {
    firstA('old-a');
  });
  key = 'b';
  await act(async () => {
    tree!.update(<Probe />);
  });
  expect(current[0]).toBe('empty');
  const firstB = current[1];
  await act(async () => {
    firstB('b');
  });
  key = 'a';
  await act(async () => {
    tree!.update(<Probe />);
  });
  expect(current[0]).toBe('empty');
  await act(async () => {
    current[1]('new-a');
    firstA('late-a');
    firstB('late-b');
  });
  expect(current[0]).toBe('new-a');
});
