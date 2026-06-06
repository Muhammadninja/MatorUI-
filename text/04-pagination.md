# Fix 04 — Pagination via nextPageToken + virtualized list

## Goal
The pre-fix UI rendered every result row at once via
`AppView gap={14}` and a `.map()` — fine for 5 mock items, an
O(n) memory blowup the moment a real backend returns 200+. It also
ignored `response.nextPageToken` entirely. With smart search,
"infinite scroll" is the expected interaction; the hook must
support it and the list must virtualize so scrolling stays at 60 fps
no matter how many pages have been loaded.

## What changed

- `hooks/use-search.ts`
  - New state: `nextPageToken: string | null`, `isLoadingMore: boolean`.
  - New ref pair (`nextPageTokenRef`, `isLoadingMoreRef`) so the
    `loadMore()` closure always reads fresh values without re-creating
    itself.
  - `loadMore()`:
    - No-op if `!token`, if `isLoadingMore`, or if the live query is
      below `MIN_QUERY_LENGTH`. (Three independent guards.)
    - Uses its own `AbortController` so the next debounced `run()`'s
      `abortRef.current?.abort()` doesn't kill an in-flight page.
    - Late-arrival guard on `liveQueryRef.current !== trimmed` drops
      pages that arrived after the user moved on to a new query.
    - Deduplicates the merged page by `id` before appending — defense
      against a backend that returns overlapping pages.
    - Soft-fails: a failed page does NOT flip the screen to `error`.
      The user still has page 1; the next-page request can retry.
      `__DEV__ && console.warn(...)` for visibility.
  - `run()` resets `nextPageToken` to `null` and `isLoadingMore` to
    `false` on every first-page request, so a new query never inherits
    pagination state from the previous one.

- `components/screens-components/search-results.tsx`
  - `state === 'success'` branch now uses `<AppList<SearchResult>>`
    (the FlashList wrapper) instead of `AppView` + `.map()`.
  - New props plumbed through: `onEndReached?: () => void`,
    `isLoadingMore?: boolean`.
  - `onEndReachedThreshold={0.5}` triggers `loadMore` when the user
    scrolls within half a screen of the bottom.
  - `ListHeaderComponent` carries the "N results for X" line so it
    scrolls with the list.
  - `ListFooterComponent` renders a small `ActivityIndicator` only
    while `isLoadingMore` is true.
  - `renderItem` and `keyExtractor` are memoized via `useCallback` so
    FlashList can maximize row recycling.

- `components/screens/explore-screen.tsx`
  - When `isSearching`, results render OUTSIDE of `AppScrollView`.
    Nesting a virtualized list inside a ScrollView breaks recycling
    and emits a yellow-box warning. Top inset (`paddingTop: topOffset`)
    is applied via a wrapping `<View>` so the search bar still floats
    over content.
  - Landing content (quick filters / catalogue / promo / featured)
    still uses `AppScrollView` as before.

- `services/search-service.ts`
  - `DEFAULT_PAGE_SIZE` lowered to `2` for the mock with a comment
    explaining the catalog only has 4 items, so any multi-match query
    needs to span pages to actually exercise infinite scroll in dev.
    The HTTP backend will set its own default.

- `components/shared/app-list/app-list.tsx`
  - Header comment updated: FlashList v2 auto-sizes, so
    `estimatedItemSize` is no longer required (it was removed from the
    props type in 2.x).

## Why this is the right shape

- **Virtualize, then paginate.** Both have to be true for an infinite
  list to stay fast — virtualization caps row count in memory at
  ~screen height; pagination caps the network/data side.
- **`loadMore` uses a separate controller.** Otherwise the next
  debounced search would cancel the page that's mid-flight, even
  though the user hasn't typed yet. Page requests aren't query
  requests — they belong to different abort scopes.
- **Late-arrival guard on query, not page.** A user can race ahead and
  retype mid-page-load; that page is now garbage for the new query.
  Drop it silently.
- **Soft-fail pagination.** If page 2 fails, page 1 is still useful.
  Flipping the screen to a full-screen error would destroy state the
  user already had. Token is retained so the next scroll-to-bottom
  retries naturally.
- **Dedupe before append.** Pagination servers occasionally double up
  one item across page boundaries (cursor races, re-ranks). The list
  silently de-dupes by id so the user never sees ghost rows.

## Verification

- `tsc --noEmit` clean.
- 27 cart-math unit tests still pass.
- Mock page size is 2 — a query like `ev` matches `urban-glide-x` and
  `trail-pro-ev` (1 page); `edition` matches `northline-suv` (no
  pagination); a category-wide query like `electric` would have to be
  added to the mock to test multi-page. (Mock has 4 items total; the
  pagination plumbing is correct but the dev experience is limited
  until the real backend returns ≥ 3 results per query.)

## What this unblocks

- Switching `searchTransport` to the HTTP stub is now a 5-line change
  — the hook already handles tokens, the list already virtualizes,
  the screen already responds to footer state.
- The `ListFooterComponent` slot is a natural place for a future
  "End of results" sentinel when `nextPageToken === null`.
