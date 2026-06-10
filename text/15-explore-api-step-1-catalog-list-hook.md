# Step 1 — `useCatalogList` hook + signal-aware service

## What this step adds

A real consumer-side hook (`useCatalogList`) that wraps the async
`fetchCatalogList()` transport with the same operational guarantees the
search system has had since day one: loading/error/empty state, abort
on unmount, stale-response rejection, soft refetch.

Before this step the catalog was being read **synchronously** from the
mock — `SearchCatalogue` did `const catalogItems = getCatalogMockItems()`
and rendered immediately. There was no loading state, no error path, no
cancellation, no abstraction over the data source. The async
`fetchCatalogList()` already existed but nothing called it.

## Files changed

| File | Change |
|---|---|
| `services/catalog-service.ts` | Added `signal?: AbortSignal` to `CatalogListRequest`. Added `MOCK_LATENCY_MS = 350` and a `delay()` helper that honors abort. `fetchCatalogList` and `fetchCatalogDetail` now await the delay and forward the signal. HTTP-stub comments expanded to show how the signal threads into `fetch`. |
| `hooks/use-catalog-list.ts` | **New.** State-machine hook with `'idle' \| 'loading' \| 'success' \| 'empty' \| 'error'`. |

## The hook contract

```ts
const { state, items, total, error, refresh } = useCatalogList({
  page: 1,
  pageSize: 20,
  category: 'sedan', // optional
});
```

States, ordered by what the consumer renders for each:

| state | UI |
|---|---|
| `idle` | Brief — the moment between mount and the first effect fire. Render skeleton (treat like loading). |
| `loading` | First fetch is in flight. Render skeleton. |
| `success` | Got items. Render the grid/list. |
| `empty` | Got a response with zero items. Render a designed empty state. |
| `error` | Fetch threw. Render an error message + retry button calling `refresh()`. |

## Operational guarantees

- **Abort on unmount.** The cleanup in the `useEffect` aborts the
  in-flight controller — no late callback into a torn-down component.
- **Abort on re-request.** If `request` changes mid-flight, the existing
  request is aborted before the new one starts. No race-to-render.
- **Stale-response guard.** Every fetch increments `requestSeqRef`. When
  a response resolves, its stamped seq is compared to the current seq;
  late arrivals are dropped without touching state.
- **Memoised request shape.** The hook destructures the request into a
  `useMemo` keyed by primitive fields, so consumers passing an inline
  object literal don't re-fire the effect on every render.

## Why model an `'idle'` state

It's tempting to start in `'loading'` since the effect fires
immediately. But there's a real window — one render cycle — between
mount and effect dispatch. Calling that `'loading'` would be a lie; the
fetch hasn't started yet. `'idle'` is honest and the consumer can treat
it the same as `'loading'` visually (both → skeleton).

## What HTTP wiring still needs

The mock now awaits a 350ms delay and threads `AbortSignal`. The HTTP
stub comments in `fetchCatalogList` / `fetchCatalogDetail` show the
exact swap shape. Outstanding for the real cut-over:

1. Env-aware `API_BASE` (the `'/api/v1/catalog'` constant should come
   from a config module).
2. Auth: a `getAuthToken()` getter (likely from `UserContext`).
3. Error mapping (401 → re-auth, 429 → retry-after, 5xx → backoff).
4. Timeout wrapped around the abort signal (e.g. 10s ceiling).

These are the same gaps the search-results readiness audit named for the
search transport. Shared infra would land once and benefit both.

## What's next

**Step 2** swaps `SearchCatalogue` over to `useCatalogList` and adds a
designed skeleton + error state. The hook is in place; nothing consumes
it yet. After Step 2 the catalog section of the landing surface is
genuinely production-ready end to end.
