# Fix 01 — Expand the search request/response wire shape

## Goal
Make the search API surface big enough to model a real smart-search backend
without having to refactor every caller again when the HTTP transport ships.

## What changed
- `types/search.ts`
  - `SearchRequest` now carries `filters`, `sortBy`, `pageToken`, `requestId`,
    `locale`, `userId`, `abVariant`, `signal`.
  - `SearchResponse` now carries `requestId`, `nextPageToken`, `didYouMean`,
    `suggestedRefinements`, `facetCounts` (categories / price / minRating),
    `appliedFilters`, `suggestedCategories`, `durationMs`.
  - `SearchResult` gained `priceCents` (numeric, authoritative), `rating`,
    `reviewCount`, `explanation`.
  - New types: `SearchSortBy`, `TypeaheadRequest`, `TypeaheadResponse`,
    `TypeaheadSuggestion`.

- `services/search-service.ts`
  - `SearchTransport` interface gained `typeahead()`.
  - `MockSearchTransport.search()` now filters server-side, sorts via
    `sortResults(sortBy)`, pages via `pageToken`, returns `facetCounts`,
    `didYouMean` (mock dictionary), `appliedFilters`, and echoes the
    client `requestId`.
  - `MockSearchTransport.typeahead()` added — title-prefix matches at 80ms
    latency, falls back to category suggestions when no title matches.
  - HTTP stub at bottom updated to a `POST /api/v1/search` body matching
    the new request fields, plus an `X-Request-Id` header.

- `hooks/use-search.ts`
  - Client-side `applyFilters` + local `parsePrice`/`hashCode` deleted.
    Filters travel server-side now.
  - Exposes new fields on the returned value: `facetCounts`, `requestId`,
    `didYouMean`, `appliedFilters`, `sortBy`, `setSortBy`.
  - `setFilters()` and `setSortBy()` re-run the current query immediately
    (no debounce — explicit user actions).
  - AbortError check hardened: handles `DOMException` and plain `Error`
    so it works across all RN runtimes.
  - `filtersRef` / `sortByRef` so the debounced runner can never capture
    stale values.

## What this unblocks
- The HTTP transport is a 5-line uncomment to wire up — every wire field
  the backend will return is already typed and read by the hook.
- Filter sheet can now read `facetCounts` and render "(3)" next to each
  bucket without any further plumbing.
- Empty state can read `didYouMean` and offer "Did you mean *urban*?".
- Analytics events (`result_clicked`, `filter_applied`) can include
  `requestId` for impression-click join on the server.

## Verification
- `tsc --noEmit` clean.
- 27 cart-math unit tests still pass.
- No call site of `useSearch` had to change — the existing surface
  (`query`, `setQuery`, `state`, `results`, `total`, `error`, `filters`,
  `setFilters`, `availableCategories`, `flush`) is preserved.
