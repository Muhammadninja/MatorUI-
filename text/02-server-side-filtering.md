# Fix 02 — Server-side filtering + UI surfaces facet counts

## Goal
Stop filtering on the client. Whatever the server says matches *is* what
the user sees. Render per-bucket match counts on every filter chip so
the user can predict what each filter will do before applying it.

## What changed
- Confirmed `applyFilters` and `rawResults` / `rawTotal` are fully gone
  from the codebase (grep returned nothing). Fix #1 already moved the
  filtering to the transport; this fix verifies it stuck and removes any
  lingering surface that depended on the old shape.

- `components/screens-components/search-filters-sheet/search-filters-sheet.tsx`
  - Accepts `facetCounts?: SearchResponse['facetCounts']`.
  - Threads counts through every `FilterChip` via a small `withCount()`
    helper at the bottom of the file:
      - Category chip → `facetCounts.categories[name]`
      - Price chip   → `facetCounts.price[bucket]`
      - Rating chip  → `facetCounts.minRating[bucket]`
  - `withCount(label, count)` returns the plain label when count is
    undefined OR <= 0 — so chips don't claim a falsehood ("Under $1k · 0").
    Selected counts beyond 0 render as `"Label · N"`.
  - "Any" rows are intentionally count-less — the count would always
    match the page total, which adds noise.

- `components/screens/explore-screen.tsx`
  - Passes `facetCounts={search.facetCounts}` to the sheet.

## What this unblocks
- The filter sheet is now *informative* — users can see which filter
  bucket has anything before they apply it.
- Real backend ships → filter behavior unchanged on the client; counts
  just start being non-mock.
- Empty-filter-result UX (fix #3 candidate): we now have enough server
  signal to distinguish "no results because the query is bad" from "no
  results because the filter combination has 0 matches".

## Verification
- `tsc --noEmit` clean.
- 27 cart-math unit tests still pass.
- `grep -r applyFilters` / `rawResults` / `rawTotal` → no matches.
- Filter chip behavior is identical when `facetCounts` is undefined
  (mock prior to a search, or HTTP transport returning a response
  without facets — both fall through `withCount`'s undefined branch).

## Not yet touched (deliberately — next candidates)
- Empty-state UX still doesn't differentiate "empty because filters"
  from "empty because no match" — fix #3.
- No "Did you mean" rendering when `didYouMean` is non-null — fix #3.
- No pagination — `nextPageToken` is parsed by the mock but the UI
  doesn't request page 2 — fix #4.
- No analytics events on filter apply / result click — fix #4.
