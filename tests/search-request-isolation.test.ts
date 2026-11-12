import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { SearchResponse } from '@/types/search';

const state = vi.hoisted(() => ({ search: vi.fn(), language: 'ru', vehicle: undefined as unknown }));
vi.mock('@/services/search-service', () => ({ searchTransport: { search: state.search } }));
vi.mock('@/contexts/active-vehicle.context', () => ({ useSearchVehicleContext: () => state.vehicle }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: state.language } }) }));
import { useSearch } from '@/hooks/use-search';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let tree: TestRenderer.ReactTestRenderer | undefined;
beforeEach(() => {
  vi.useFakeTimers();
  state.search.mockReset(); state.language = 'ru'; state.vehicle = undefined;
});
afterEach(async () => {
  await act(async () => tree?.unmount());
  tree = undefined;
  vi.useRealTimers();
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function response(ids: string[], nextPageToken?: string): SearchResponse {
  return { query: 'filter', requestId: 'unit', durationMs: 1, total: 10, nextPageToken,
    results: ids.map((id) => ({ id, title: id, description: '', category: '', price: '1', priceLabel: '1', score: 0 })) };
}
async function renderSearch() {
  let value!: ReturnType<typeof useSearch>;
  function Probe() { value = useSearch(); return null; }
  await act(async () => { tree = TestRenderer.create(createElement(Probe)); });
  const rerender = async () => { await act(async () => tree!.update(createElement(Probe))); };
  await act(async () => value.setQuery('filter'));
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  return { get: () => value, rerender };
}

test('a late first page cannot undo sorting for the same query', async () => {
  const old = deferred<SearchResponse>();
  state.search.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response(['sorted']));
  const screen = await renderSearch();
  await act(async () => screen.get().setSortBy('price_asc'));
  await act(async () => old.resolve(response(['stale'])));
  expect(screen.get().results.map((r) => r.id)).toEqual(['sorted']);
});

test.each(['sort', 'language', 'vehicle'] as const)('a late page cannot contaminate a new %s scope', async (change) => {
  const oldPage = deferred<SearchResponse>();
  state.search.mockResolvedValueOnce(response(['first'], 'page-2'))
    .mockReturnValueOnce(oldPage.promise).mockResolvedValueOnce(response(['new-scope']));
  const screen = await renderSearch();
  await act(async () => { screen.get().loadMore(); });
  if (change === 'sort') await act(async () => screen.get().setSortBy('price_desc'));
  else {
    if (change === 'language') state.language = 'uz';
    else state.vehicle = { make: 'Chevrolet', model: 'Cobalt' };
    await screen.rerender();
  }
  await act(async () => oldPage.resolve(response(['stale-page'])));
  expect(screen.get().results.map((r) => r.id)).toEqual(['new-scope']);
  expect(screen.get().isLoadingMore).toBe(false);
});

test('rapid loadMore calls share one request and duplicates inside a page are dropped', async () => {
  const page = deferred<SearchResponse>();
  state.search.mockResolvedValueOnce(response(['first'], 'page-2')).mockReturnValueOnce(page.promise);
  const screen = await renderSearch();
  await act(async () => { screen.get().loadMore(); screen.get().loadMore(); });
  expect(state.search).toHaveBeenCalledTimes(2);
  await act(async () => page.resolve(response(['first', 'second', 'second'])));
  expect(screen.get().results.map((r) => r.id)).toEqual(['first', 'second']);
});

test('typing invalidates the old query before the debounce runs', async () => {
  const old = deferred<SearchResponse>();
  state.search.mockReturnValueOnce(old.promise);
  const screen = await renderSearch();
  await act(async () => screen.get().setQuery('new query'));
  await act(async () => old.resolve(response(['stale'])));
  expect(screen.get().results).toEqual([]);
});
