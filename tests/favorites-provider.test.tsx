import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  user: { profile: null as { id: string } | null, isHydrating: false, isAuthenticated: false },
  epoch: 0,
  values: new Map<string, string>(),
}));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => mock.user }));
vi.mock('@/services/api-client', () => ({ getAuthRequestEpoch: () => mock.epoch }));
vi.mock('@/services/favorites-api', () => ({ createFavoritesTransport: () => undefined }));
vi.mock('@/services/likes-storage', async (original) => {
  const actual = await original<typeof import('@/services/likes-storage')>();
  return {
    ...actual,
    favoritesStorage: new actual.FavoritesStorage({
      getItem: async (k) => mock.values.get(k) ?? null,
      setItem: async (k, v) => {
        mock.values.set(k, v);
      },
    }),
  };
});
import { LikesProvider, useLikesContext } from '@/contexts/likes.context';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let context: ReturnType<typeof useLikesContext>;
function Consumer() {
  context = useLikesContext();
  return null;
}
const tree = () => (
  <LikesProvider>
    <Consumer />
  </LikesProvider>
);
async function render(root?: ReactTestRenderer) {
  await act(async () => {
    if (root) root.update(tree());
  });
}
describe('favorites provider identity boundaries', () => {
  beforeEach(() => { mock.values.clear(); mock.epoch = 0; });
  it('rejects retained actions immediately on auth invalidation, before React cleanup', async () => {
    mock.user = { profile: { id: 'epoch-a' }, isHydrating: false, isAuthenticated: true };
    let root!: ReactTestRenderer;
    await act(async () => { root = create(tree()); });
    const stale = context.toggleLike;
    mock.epoch++;
    expect(stale('too-late')).toBe(false);
    mock.user = { profile: { id: 'epoch-b' }, isHydrating: false, isAuthenticated: true };
    await render(root);
    expect(context.likedIds.size).toBe(0);
    expect(stale('after-cleanup')).toBe(false);
    mock.user = { profile: { id: 'epoch-a' }, isHydrating: false, isAuthenticated: true };
    await render(root);
    expect(context.likedIds.size).toBe(0);
    await act(async () => root.unmount());
  });

  it('restores guest and account favorites independently after remount, without HTTP', async () => {
    mock.user = { profile: null, isHydrating: false, isAuthenticated: false };
    let root!: ReactTestRenderer;
    await act(async () => { root = create(tree()); });
    await act(async () => { context.toggleLike('guest-only'); });
    mock.user = { profile: { id: 'restart-owner' }, isHydrating: false, isAuthenticated: true };
    await render(root);
    expect(context.likedIds.size).toBe(0);
    await act(async () => { context.toggleLike('owner-only'); });
    await act(async () => root.unmount());
    await act(async () => { root = create(tree()); });
    expect([...context.likedIds]).toEqual(['owner-only']);
    mock.user = { profile: null, isHydrating: false, isAuthenticated: false };
    await render(root);
    expect([...context.likedIds]).toEqual(['guest-only']);
    await act(async () => root.unmount());
  });

  it('clears account rows during auth hydration, switches owners and restores only the same owner', async () => {
    let root!: ReactTestRenderer;
    mock.user = { profile: { id: 'a' }, isHydrating: false, isAuthenticated: true };
    await act(async () => {
      root = create(tree());
    });
    await act(async () => {
      context.toggleLike('private');
    });
    expect(context.likedIds.has('private')).toBe(true);
    mock.user = { profile: { id: 'a' }, isHydrating: true, isAuthenticated: true };
    await render(root);
    expect(context.likedIds.size).toBe(0);
    expect(context.isHydrated).toBe(false);
    mock.user = { profile: { id: 'b' }, isHydrating: false, isAuthenticated: true };
    await render(root);
    expect(context.likedIds.size).toBe(0);
    mock.user = { profile: null, isHydrating: false, isAuthenticated: false };
    await render(root);
    expect(context.likedIds.size).toBe(0);
    mock.user = { profile: { id: 'a' }, isHydrating: false, isAuthenticated: true };
    await render(root);
    expect(context.likedIds.has('private')).toBe(true);
    await act(async () => root.unmount());
  });
});
