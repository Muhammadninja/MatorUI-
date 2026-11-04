/** Unit test only; no real account/storage or integration data is changed. */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, test, vi } from 'vitest';
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {} }));
vi.mock('@/contexts/user.context', () => ({ useUserContext: () => ({ profile: null, isAuthenticated: false, isHydrating: false }) }));
vi.mock('@/services/api-client', () => ({ getAuthRequestEpoch: () => 0 }));
vi.mock('@/services/favorites-api', () => ({ createFavoritesTransport: () => undefined }));
vi.mock('@/services/likes-storage', async (original) => {
  const actual = await original<typeof import('@/services/likes-storage')>();
  const values = new Map([['likes:v2', JSON.stringify({ v: 2, owners: { guest: { ids: ['saved'], hasEverLiked: true, version: 0, pending: {} } } })]]);
  return { ...actual, favoritesStorage: new actual.FavoritesStorage({
    getItem: async (key) => values.get(key) ?? null,
    setItem: async (key, value) => { values.set(key, value); },
  }) };
});
import { LikesProvider, useLikesContext } from '@/contexts/likes.context';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
test('rapid taps return the correct message state before rendering and preserve other likes', async () => {
  let api!: ReturnType<typeof useLikesContext>;
  function Probe() { api = useLikesContext(); return null; }
  let tree!: ReactTestRenderer;
  await act(async () => { tree = create(<LikesProvider><Probe /></LikesProvider>); });
  const results: boolean[] = [];
  await act(async () => {
    results.push(api.toggleLike('part'), api.toggleLike('part'), api.toggleLike('part'));
    results.push(api.toggleLike('saved'));
  });
  expect(results).toEqual([true, false, true, false]);
  expect([...api.likedIds]).toEqual(['part']);
  await act(async () => tree.unmount());
});
