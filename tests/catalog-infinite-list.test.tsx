/**
 * `useCatalogInfiniteList` over GET /v1/catalog/parts as the backend pages it
 * (fixtures/catalog-parts.ts): page 1 of 24, each next page appended as the
 * list asks, one request at a time, until `next_page` runs out — and any change
 * to the query starting a new list from page 1 that nothing of the old one can
 * leak into, however late its answers arrive.
 *
 * Real React Query and the real HTTP transport; only `apiClient.get` is faked.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { FakeCatalog, partsIn } from './fixtures/catalog-parts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/config/api', () => ({ shouldUseHttpTransport: () => true }));
const get = vi.fn();
vi.mock('@/services/api-client', () => ({
  apiClient: { get: (url: string) => get(url) },
  ApiError: class ApiError extends Error {
    status = 0;
    get isNetworkError() {
      return this.status === 0;
    }
  },
}));

import {
  useCatalogInfiniteList,
  type CatalogBrowseRequest,
  type UseCatalogInfiniteListValue,
} from '@/hooks/use-catalog-list';

/** 60 brake parts (pages of 24, 24, 12) across two models; 30 engine parts. */
const ROWS = [
  ...partsIn('brake-system', 'b', 60, (i) => ({
    make: i % 2 ? 'BYD' : 'Chevrolet',
    model: i % 2 ? 'Song Plus' : 'Cobalt',
    gm: i % 3 === 0,
    title: i % 4 === 0 ? `Brake pad ${i + 1}` : `Brake disc ${i + 1}`,
  })),
  ...partsIn('engine-system', 'e', 30),
];
const BRAKES: CatalogBrowseRequest = {
  pageSize: 24,
  category: 'brake-system',
  sortBy: 'relevance',
};

let catalog: FakeCatalog;
const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  catalog = new FakeCatalog([...ROWS]);
  get.mockReset();
  get.mockImplementation(catalog.get);
});
afterEach(async () => {
  await act(async () => {
    for (const r of mounted.splice(0)) r.unmount();
  });
});

/** Let React Query settle: it resolves over several ticks. */
async function settle() {
  for (let i = 0; i < 5; i += 1) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0));
    });
  }
}

/** Mount the hook for `request`; `update` swaps the request in place. */
async function mount(request: CatalogBrowseRequest) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const box: { value?: UseCatalogInfiniteListValue } = {};
  function Probe({ req }: { req: CatalogBrowseRequest }) {
    box.value = useCatalogInfiniteList(req);
    return null;
  }
  const tree = (req: CatalogBrowseRequest) => (
    <QueryClientProvider client={client}>
      <Probe req={req} />
    </QueryClientProvider>
  );
  let renderer!: ReactTestRenderer;
  await act(async () => {
    renderer = create(tree(request));
  });
  mounted.push(renderer);
  await settle();
  return {
    list: () => box.value!,
    update: async (next: CatalogBrowseRequest) => {
      await act(async () => {
        renderer.update(tree(next));
      });
    },
  };
}

/** Run `fn` against the hook's current value inside `act`. */
async function call(fn: () => void) {
  await act(async () => {
    fn();
  });
}

const ids = (list: UseCatalogInfiniteListValue) => list.items.map((i) => i.id);
/** The ids `request` lists across all its pages, in order (`url`: its request). */
const resultIds = (url: string) => catalog.matching(url).map((p) => p.id);

describe('the first page', () => {
  test('asks for page 1 of 24 and shows those 24 rows', async () => {
    const { list } = await mount(BRAKES);
    expect(catalog.params()).toMatchObject({
      page: '1',
      page_size: '24',
      category: 'brake-system',
    });
    expect(list().state).toBe('success');
    expect(ids(list())).toEqual(resultIds(catalog.calls[0]).slice(0, 24));
    expect(list().hasMore).toBe(true);
  });

  test('reports the total of the whole result, not the rows loaded', async () => {
    const { list } = await mount(BRAKES);
    expect(list().total).toBe(60);
  });

  test('a failed first page is an error the screen can retry', async () => {
    catalog.failNext();
    const { list } = await mount(BRAKES);
    expect(list().state).toBe('error');
    await call(() => list().refresh());
    await settle();
    expect(list().state).toBe('success');
    expect(list().items).toHaveLength(24);
  });
});

describe('the next pages', () => {
  test('are appended after the loaded rows, in order, the total unchanged', async () => {
    const { list } = await mount(BRAKES);
    await call(() => list().loadMore());
    await settle();
    expect(catalog.params()).toMatchObject({ page: '2', page_size: '24' });
    expect(ids(list())).toEqual(resultIds(catalog.calls[0]).slice(0, 48));
    expect(list().total).toBe(60);
  });

  test('keep the loaded rows on screen while the next one loads, the spinner on', async () => {
    const { list } = await mount(BRAKES);
    catalog.holding = true;
    await call(() => list().loadMore());
    await settle(); // the answer is held: only React Query's notification lands
    expect(list().isLoadingMore).toBe(true);
    expect(list().state).toBe('success');
    expect(list().items).toHaveLength(24);

    await call(() => catalog.held[0].release());
    await settle();
    expect(list().isLoadingMore).toBe(false);
    expect(list().items).toHaveLength(48);
  });

  test('are asked for once, however often the end of the list is reached', async () => {
    const { list } = await mount(BRAKES);
    catalog.holding = true;
    await call(() => {
      list().loadMore();
      list().loadMore();
      list().loadMore();
    });
    await call(() => list().loadMore());
    expect(catalog.paramsSince(1)).toEqual([expect.objectContaining({ page: '2' })]);
  });

  test('stop after the last page', async () => {
    const { list } = await mount(BRAKES);
    for (let page = 2; page <= 3; page += 1) {
      await call(() => list().loadMore());
      await settle();
    }
    expect(list().items).toHaveLength(60);
    expect(list().hasMore).toBe(false);
    const asked = catalog.calls.length;
    await call(() => list().loadMore());
    await settle();
    expect(catalog.calls).toHaveLength(asked);
    expect(catalog.paramsSince(0).map((p) => p.page)).toEqual(['1', '2', '3']);
  });

  test('stop at an empty page even when next_page promises more', async () => {
    const { list } = await mount(BRAKES);
    get.mockImplementationOnce(async () => ({
      items: [],
      total: 60,
      page: 2,
      page_size: 24,
      next_page: 3,
    }));
    await call(() => list().loadMore());
    await settle();
    expect(list().hasMore).toBe(false);
    expect(list().items).toHaveLength(24);
  });

  test('never show a part twice when the catalogue shifts between two pages', async () => {
    const { list } = await mount(BRAKES);
    // A part listed meanwhile, at the top: page 1's last row moves to page 2.
    catalog.rows.unshift(...partsIn('brake-system', 'new', 1));
    await call(() => list().loadMore());
    await settle();
    const shown = ids(list());
    expect(new Set(shown).size).toBe(shown.length);
    expect(shown).toHaveLength(47);
    expect(shown.slice(0, 24)).toEqual(resultIds(catalog.calls[0]).slice(1, 25));
  });
});

describe('a failed next page', () => {
  test('keeps the rows, raises the flag, and waits for a retry', async () => {
    const { list } = await mount(BRAKES);
    catalog.failNext();
    await call(() => list().loadMore());
    await settle();
    expect(list().loadMoreError).toBe(true);
    expect(list().state).toBe('success');
    expect(list().items).toHaveLength(24);

    // Reaching the end again doesn't hammer a failing server.
    const asked = catalog.calls.length;
    await call(() => list().loadMore());
    await settle();
    expect(catalog.calls).toHaveLength(asked);

    await call(() => list().retryLoadMore());
    await settle();
    expect(catalog.params()).toMatchObject({ page: '2' });
    expect(list().loadMoreError).toBe(false);
    expect(list().items).toHaveLength(48);

    // And scrolling pages on from there.
    await call(() => list().loadMore());
    await settle();
    expect(list().items).toHaveLength(60);
  });
});

describe('a new query starts over from page 1', () => {
  const COBALT: CatalogBrowseRequest = { ...BRAKES, make: 'Chevrolet', model: 'Cobalt' };

  test.each<[string, CatalogBrowseRequest, CatalogBrowseRequest, Record<string, string>]>([
    ['category', BRAKES, { ...BRAKES, category: 'engine-system' }, { category: 'engine-system' }],
    [
      'model',
      COBALT,
      { ...COBALT, make: 'BYD', model: 'Song Plus' },
      { make: 'BYD', model: 'Song Plus' },
    ],
    ['search', BRAKES, { ...BRAKES, search: 'pad' }, { q: 'pad' }],
    ['filter', BRAKES, { ...BRAKES, gmOnly: true }, { gm_only: 'true' }],
    ['sort', BRAKES, { ...BRAKES, sortBy: 'price_asc' }, { sort: 'price_asc' }],
  ])('a new %s', async (_change, before, after, sent) => {
    const { list, update } = await mount(before);
    await call(() => list().loadMore());
    await settle();
    expect(catalog.params()).toMatchObject({ page: '2' });

    await update(after);
    await settle();
    expect(catalog.params()).toMatchObject({ page: '1', page_size: '24', ...sent });
    // The new query's first page and nothing of the old list.
    expect(ids(list())).toEqual(resultIds(catalog.calls.at(-1)!).slice(0, 24));
    expect(list().total).toBe(catalog.matching(catalog.calls.at(-1)!).length);
  });

  test('the old rows stay, dimmed, until the new first page replaces them whole', async () => {
    const { list, update } = await mount(BRAKES);
    const old = ids(list());
    catalog.holding = true;
    await update({ ...BRAKES, sortBy: 'price_desc' });
    expect(list().isRefreshing).toBe(true);
    expect(ids(list())).toEqual(old);

    // Reaching the end of the dimmed rows asks for nothing.
    await call(() => list().loadMore());
    expect(catalog.held).toHaveLength(1);

    await call(() => catalog.held[0].release());
    await settle();
    expect(list().isRefreshing).toBe(false);
    expect(ids(list())).toEqual(resultIds(catalog.held[0].url).slice(0, 24));
  });

  test('a late next page of the old list never lands in the new one', async () => {
    const { list, update } = await mount(BRAKES);
    catalog.holding = true;
    await call(() => list().loadMore()); // brake page 2, held
    await update({ ...BRAKES, category: 'engine-system' }); // engine page 1, held
    const [brakePage2, enginePage1] = catalog.held;

    await call(() => enginePage1.release());
    await settle();
    await call(() => brakePage2.release());
    await settle();
    expect(ids(list())).toEqual(resultIds(enginePage1.url).slice(0, 24));
    expect(list().total).toBe(30);
  });

  test('a late first page of the old list never lands in the new one', async () => {
    catalog.holding = true;
    const { list, update } = await mount(BRAKES); // brake page 1, held
    await update({ ...BRAKES, category: 'engine-system' }); // engine page 1, held
    const [brakePage1, enginePage1] = catalog.held;

    await call(() => enginePage1.release());
    await settle();
    await call(() => brakePage1.release());
    await settle();
    expect(ids(list())).toEqual(resultIds(enginePage1.url).slice(0, 24));
    expect(ids(list()).every((id) => id.startsWith('e-'))).toBe(true);
  });
});
