/**
 * The brand filter of a scrolled catalogue list (`useCatalogInfiniteList` with
 * `brands`) over GET /v1/catalog/parts as the backend serves it
 * (fixtures/catalog-parts.ts, `brandCatalogue`): the brand goes to the
 * server, which filters the WHOLE catalogue before it counts and pages — so
 * page 1 is 24 Bosch parts, not the 2 the unfiltered first page happens to
 * hold, the total is the brand's 52, and scrolling on reaches every one.
 *
 * Real React Query and the real HTTP transport; only `apiClient.get` is faked.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { brandCatalogue, brandId, FakeCatalog } from './fixtures/catalog-parts';

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

const BOSCH = brandId('Bosch');
const GATES = brandId('Gates');
const MANN = brandId('Mann');
const ALL: CatalogBrowseRequest = { pageSize: 24, sortBy: 'relevance' };
const BOSCH_ONLY: CatalogBrowseRequest = { ...ALL, brands: [BOSCH] };

let catalog: FakeCatalog;
const mounted: ReactTestRenderer[] = [];
beforeEach(() => {
  catalog = new FakeCatalog(brandCatalogue());
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

async function call(fn: () => void) {
  await act(async () => {
    fn();
  });
}

/** Reach the end of the list until the server has no more pages. */
async function scrollToEnd(list: () => UseCatalogInfiniteListValue) {
  for (let i = 0; i < 10 && list().hasMore; i += 1) {
    await call(() => list().loadMore());
    await settle();
  }
}

const ids = (list: UseCatalogInfiniteListValue) => list.items.map((i) => i.id);
const brands = (list: UseCatalogInfiniteListValue) => new Set(list.items.map((i) => i.brand));
/** Every part of the catalogue of the brand named `name`, in listing order. */
const partsOf = (name: string) => catalog.rows.filter((p) => p.brand === name).map((p) => p.id);
/** The brand facet as name → count. */
const facet = (list: UseCatalogInfiniteListValue) =>
  Object.fromEntries(list.brandFacets.map((b) => [b.name, b.count]));

describe('picking a brand', () => {
  test('the unfiltered first page holds 2 of the 52 Bosch parts — the rest come later', async () => {
    const { list } = await mount(ALL);
    expect(list().items.filter((i) => i.brand === 'Bosch')).toHaveLength(2);
    expect(list().total).toBe(130);
    expect(partsOf('Bosch')).toHaveLength(52);
  });

  test('asks the server for the brand, by its id, from page 1 of 24', async () => {
    await mount(BOSCH_ONLY);
    expect(catalog.params()).toMatchObject({ page: '1', page_size: '24', brand: BOSCH });
  });

  test('page 1 is the first 24 Bosch parts, and the total is all 52', async () => {
    const { list } = await mount(BOSCH_ONLY);
    expect(ids(list())).toEqual(partsOf('Bosch').slice(0, 24));
    expect(brands(list())).toEqual(new Set(['Bosch']));
    expect(list().total).toBe(52);
  });

  test('scrolling on appends only Bosch, until every Bosch part is listed', async () => {
    const { list } = await mount(BOSCH_ONLY);
    const totals = [list().total];
    for (const loaded of [48, 52]) {
      await call(() => list().loadMore());
      await settle();
      expect(list().items).toHaveLength(loaded);
      expect(brands(list())).toEqual(new Set(['Bosch']));
      totals.push(list().total);
    }
    expect(ids(list())).toEqual(partsOf('Bosch'));
    // The total never followed the rows loaded.
    expect(totals).toEqual([52, 52, 52]);
    expect(catalog.paramsSince(0).map((p) => [p.page, p.brand])).toEqual([
      ['1', BOSCH],
      ['2', BOSCH],
      ['3', BOSCH],
    ]);
  });

  test('stops after the brand’s last page, and lists no part twice', async () => {
    const { list } = await mount(BOSCH_ONLY);
    await scrollToEnd(list);
    expect(list().hasMore).toBe(false);
    const asked = catalog.calls.length;
    await call(() => list().loadMore());
    await settle();
    expect(catalog.calls).toHaveLength(asked);
    expect(new Set(ids(list())).size).toBe(52);
  });
});

describe('changing the brand starts a new list from page 1', () => {
  test('another brand: its own first page and total, nothing of the old one', async () => {
    const { list, update } = await mount(BOSCH_ONLY);
    await call(() => list().loadMore());
    await settle();
    await update({ ...ALL, brands: [GATES] });
    await settle();
    expect(catalog.params()).toMatchObject({ page: '1', brand: GATES });
    expect(ids(list())).toEqual(partsOf('Gates').slice(0, 24));
    expect(brands(list())).toEqual(new Set(['Gates']));
    expect(list().total).toBe(33);
  });

  test('no brand: the whole catalogue again, from page 1', async () => {
    const { list, update } = await mount(BOSCH_ONLY);
    await call(() => list().loadMore());
    await settle();
    await update(ALL);
    await settle();
    expect(catalog.params()).toMatchObject({ page: '1' });
    expect(catalog.params()).not.toHaveProperty('brand');
    expect(ids(list())).toEqual(catalog.rows.slice(0, 24).map((p) => p.id));
    expect(list().total).toBe(130);
  });

  test('a second brand joins the first in one comma-separated brand param', async () => {
    const { list, update } = await mount(BOSCH_ONLY);
    await update({ ...ALL, brands: [BOSCH, MANN] });
    await settle();
    expect(catalog.params()).toMatchObject({ page: '1', brand: `${BOSCH},${MANN}` });
    await scrollToEnd(list);
    expect(brands(list())).toEqual(new Set(['Bosch', 'Mann']));
    expect(list().items).toHaveLength(62);
    expect(list().total).toBe(62);
  });
});

describe('the brand rides with every other filter', () => {
  test.each<[string, Partial<CatalogBrowseRequest>, Record<string, string>, number]>([
    ['a main category', { category: 'brake-system' }, { category: 'brake-system' }, 40],
    ['a subcategory', { category: 'brake-discs' }, { category: 'brake-discs' }, 13],
    ['a Chevrolet model', { make: 'Chevrolet', model: 'Cobalt' }, { model: 'Cobalt' }, 17],
    ['a BYD model', { make: 'BYD', model: 'Song Plus' }, { model: 'Song Plus' }, 17],
    ['a Volkswagen model', { make: 'Volkswagen', model: 'Polo' }, { model: 'Polo' }, 18],
    ['a search', { search: 'pad' }, { q: 'pad' }, 27],
    ['GM only', { gmOnly: true }, { gm_only: 'true' }, 10],
    ['OEM only', { oemOnly: true }, { oem_only: 'true' }, 9],
    ['a region', { regions: ['europe'] }, { region: 'europe' }, 25],
    ['a sort', { sortBy: 'price_asc' }, { sort: 'price_asc' }, 52],
  ])('%s', async (_label, other, sent, count) => {
    const { list } = await mount({ ...BOSCH_ONLY, ...other });
    expect(catalog.params(0)).toMatchObject({ page: '1', brand: BOSCH, ...sent });
    await scrollToEnd(list);
    // Exactly the Bosch parts the other filter lists, in the server's order.
    const expected = catalog.matching(catalog.calls[0]).map((p) => p.id);
    expect(expected).toHaveLength(count);
    expect(ids(list())).toEqual(expected);
    expect(brands(list())).toEqual(new Set(['Bosch']));
    expect(list().total).toBe(count);
  });
});

describe('late and concurrent answers', () => {
  test('a late next page of the old brand never lands in the new brand’s list', async () => {
    const { list, update } = await mount(BOSCH_ONLY);
    catalog.holding = true;
    await call(() => list().loadMore()); // Bosch page 2, held
    await update({ ...ALL, brands: [GATES] }); // Gates page 1, held
    const [boschPage2, gatesPage1] = catalog.held;

    await call(() => gatesPage1.release());
    await settle();
    await call(() => boschPage2.release());
    await settle();
    expect(ids(list())).toEqual(partsOf('Gates').slice(0, 24));
    expect(brands(list())).toEqual(new Set(['Gates']));
    expect(list().total).toBe(33);
  });

  test('a late page of the unfiltered list never lands in the brand’s list', async () => {
    const { list, update } = await mount(ALL);
    catalog.holding = true;
    await call(() => list().loadMore()); // every brand, page 2, held
    await update(BOSCH_ONLY); // Bosch page 1, held
    const [allPage2, boschPage1] = catalog.held;

    await call(() => boschPage1.release());
    await settle();
    await call(() => allPage2.release());
    await settle();
    expect(ids(list())).toEqual(partsOf('Bosch').slice(0, 24));
    expect(list().total).toBe(52);
  });

  test('brands picked in quick succession end on the last one, whatever answers last', async () => {
    catalog.holding = true;
    const { list, update } = await mount(BOSCH_ONLY);
    await update({ ...ALL, brands: [GATES] });
    await update({ ...ALL, brands: [MANN] });
    const [bosch, gates, mann] = catalog.held;
    for (const answer of [mann, gates, bosch]) {
      await call(() => answer.release());
      await settle();
    }
    expect(ids(list())).toEqual(partsOf('Mann'));
    expect(list().total).toBe(10);
  });

  test('the end reached again and again while a page loads asks for it once', async () => {
    const { list } = await mount(BOSCH_ONLY);
    catalog.holding = true;
    await call(() => {
      list().loadMore();
      list().loadMore();
      list().loadMore();
    });
    await call(() => list().loadMore());
    expect(catalog.paramsSince(1)).toEqual([expect.objectContaining({ page: '2', brand: BOSCH })]);

    await call(() => catalog.held[0].release());
    await settle();
    expect(ids(list())).toEqual(partsOf('Bosch').slice(0, 48));
  });
});

describe('the brand facet', () => {
  const OFFERED = { Bosch: 52, Gates: 33, Sachs: 26, Mann: 10, Febi: 9 };

  test('offers every brand of the whole catalogue — Sachs too, absent from page 1', async () => {
    const { list } = await mount(ALL);
    expect(brands(list()).has('Sachs')).toBe(false);
    expect(facet(list())).toEqual(OFFERED);
    expect(list().brandFacets.find((b) => b.name === 'Bosch')?.id).toBe(BOSCH);
  });

  test('keeps offering every brand once one is picked', async () => {
    const { list } = await mount(BOSCH_ONLY);
    expect(facet(list())).toEqual(OFFERED);
  });
});
