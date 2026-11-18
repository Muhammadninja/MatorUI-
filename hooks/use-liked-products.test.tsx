import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({ likedIds: new Set<string>(), fetch: vi.fn() }));
vi.mock('@/contexts/likes.context', () => ({ useLikesContext: () => ({ likedIds: state.likedIds }) }));
vi.mock('@/services/catalog-service', () => ({ fetchCatalogDetail: state.fetch }));

import { useLikedProducts } from '@/hooks/use-liked-products';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  state.likedIds = new Set(['part_1']);
  state.fetch.mockReset();
});

async function render() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  let value!: ReturnType<typeof useLikedProducts>;
  function Probe() {
    value = useLikedProducts();
    return null;
  }
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = TestRenderer.create(
      createElement(QueryClientProvider, { client }, createElement(Probe)),
    );
  });
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
  return { value: () => value, unmount: async () => act(async () => tree.unmount()) };
}

test('transient catalog failures stay errors, not an empty favorites list', async () => {
  state.fetch.mockRejectedValueOnce(new Error('offline'));
  const result = await render();
  expect(result.value()).toMatchObject({ state: 'error', error: 'offline' });
  await result.unmount();
});

test('a missing saved part is dropped and may produce the true empty state', async () => {
  state.fetch.mockResolvedValueOnce(null);
  const result = await render();
  expect(result.value()).toMatchObject({ state: 'empty', items: [] });
  await result.unmount();
});
