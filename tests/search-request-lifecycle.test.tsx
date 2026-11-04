import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const state = vi.hoisted(() => ({ search: vi.fn(), vehicle: undefined as unknown }));
vi.mock('@/services/search-service', () => ({ searchTransport: state }));
vi.mock('@/contexts/active-vehicle.context', () => ({ useSearchVehicleContext: () => state.vehicle }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ i18n: { language: 'ru' } }) }));
import { useSearch } from '@/hooks/use-search';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let tree: TestRenderer.ReactTestRenderer;
let value: ReturnType<typeof useSearch>;
function Probe() { value = useSearch(); return null; }
function deferred() {
  let resolve!: (value: any) => void;
  const promise = new Promise<any>((done) => { resolve = done; });
  return { promise, resolve };
}
function response(id: string, nextPageToken?: string) {
  return { results: [{ id, title: id }], total: 4, durationMs: 1, requestId: id, nextPageToken };
}
beforeEach(async () => {
  vi.useFakeTimers();
  state.search.mockReset();
  state.vehicle = undefined;
  await act(async () => { tree = TestRenderer.create(createElement(Probe)); });
});
afterEach(async () => { await act(async () => tree.unmount()); vi.useRealTimers(); });
async function query() {
  await act(async () => { value.setQuery('filter'); });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}
test('same-query sort changes reject a late first-page response even when transport ignores abort', async () => {
  const old = deferred();
  state.search.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response('sorted'));
  await query();
  await act(async () => { value.setSortBy('price_asc'); });
  await act(async () => { old.resolve(response('stale')); });
  expect(value.results.map((r) => r.id)).toEqual(['sorted']);
});
test('typing invalidates old results immediately during the debounce window', async () => {
  const old = deferred();
  state.search.mockReturnValueOnce(old.promise);
  await query();
  await act(async () => { value.setQuery('new query'); old.resolve(response('stale')); });
  expect(value.results).toEqual([]);
});
test('two loadMore calls in the same event send only one page request', async () => {
  const page = deferred();
  state.search.mockResolvedValueOnce(response('first', 'page2')).mockReturnValue(page.promise);
  await query();
  await act(async () => { value.loadMore(); value.loadMore(); });
  expect(state.search).toHaveBeenCalledTimes(2);
});
test('sort change cancels pagination and prevents stale page append', async () => {
  const page = deferred();
  state.search.mockResolvedValueOnce(response('first', 'page2')).mockReturnValueOnce(page.promise).mockResolvedValueOnce(response('sorted'));
  await query();
  await act(async () => { value.loadMore(); });
  const signal = state.search.mock.calls[1][0].signal;
  await act(async () => { value.setSortBy('price_asc'); });
  expect(signal.aborted).toBe(true);
  await act(async () => { page.resolve(response('stale')); });
  expect(value.results.map((r) => r.id)).toEqual(['sorted']);
});
test('filter changes clear pending debounce instead of sending the same search twice', async () => {
  state.search.mockResolvedValue(response('filtered'));
  await act(async () => { value.setQuery('filter'); });
  await act(async () => { value.setFilters({ categories: ['brakes'], price: 'any', minRating: 'any' }); });
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
  expect(state.search).toHaveBeenCalledTimes(1);
});
test('changing vehicle reruns the query and rejects the former fitment response', async () => {
  const old = deferred();
  state.search.mockReturnValueOnce(old.promise).mockResolvedValueOnce(response('new-car'));
  await query();
  await act(async () => { state.vehicle = { modelId: 'new-model' }; tree.update(createElement(Probe)); });
  await act(async () => { old.resolve(response('stale-car')); });
  expect(state.search).toHaveBeenCalledTimes(2);
  expect(value.results.map((r) => r.id)).toEqual(['new-car']);
});
test('unmount cancels both first-page and pagination resources', async () => {
  const page = deferred();
  state.search.mockResolvedValueOnce(response('first', 'page2')).mockReturnValueOnce(page.promise);
  await query();
  await act(async () => { value.loadMore(); });
  const signal = state.search.mock.calls[1][0].signal;
  await act(async () => { tree.unmount(); });
  expect(signal.aborted).toBe(true);
});
test('overlapping and repeated IDs in a next page append once', async () => {
  state.search.mockResolvedValueOnce(response('first', 'page2')).mockResolvedValueOnce({ ...response('second'), results: [{ id: 'first' }, { id: 'second' }, { id: 'second' }] });
  await query();
  await act(async () => { value.loadMore(); });
  expect(value.results.map((r) => r.id)).toEqual(['first', 'second']);
});
