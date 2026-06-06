# Fix 03 — Smarter empty states (did-you-mean + filter-empty)

## Goal
The pre-fix empty state was one generic "Nothing found for X" copy for
every reason results were empty. That's a dead end for the user:
- They mistyped → no hint that the server already knows the correction.
- Their filters are too strict → no way to back out without reopening
  the filter sheet and clicking each chip off.
- The query genuinely has no hits → no different from the other two.

Smart search returns `didYouMean` and the UI already knows which
filters are active. We should turn empty states into recoverable
states.

## What changed

- `components/screens-components/search-results.tsx`
  - Four new props on `SearchResultsProps`:
    - `didYouMean?: string | null` — server-suggested correction.
    - `hasActiveFilters?: boolean` — whether any filter chip is on.
    - `onClearFilters?: () => void` — tap target for the "Clear filters" CTA.
    - `onUseSuggestion?: (suggestion: string) => void` — tap target
      for the did-you-mean chip.
  - The `state === 'empty'` branch now picks one of three sub-states
    in priority order:
    1. `didYouMean` set → "No matches for X" + tappable pill with the
       suggestion. Tap → `onUseSuggestion(didYouMean)` runs the
       suggested query.
    2. `hasActiveFilters` true → "No results match your filters" +
       "Clear filters" CTA. Tap → `onClearFilters()` resets the
       filter set to `DEFAULT_FILTERS` and the query re-runs.
    3. Otherwise → original "Nothing found for X — try a different
       word or check the spelling" copy.
  - Dev-only guard on the `durationMs` chip in the results header
    (`__DEV__ && durationMs != null`) so server timing never leaks
    to production users.

- `components/screens/explore-screen.tsx`
  - Threads `didYouMean`, `hasActiveFilters(search.filters)`,
    `onClearFilters` (closes over `search.setFilters(DEFAULT_FILTERS)`),
    and `onUseSuggestion: search.setQuery` through to `SearchResults`.
  - Memoizes `filtersActive` and `clearFilters` so `SearchResults`
    doesn't re-render every time its parent does.
  - Reuses `filtersActive` for the `SmartSearchBar` filter dot so
    the source of truth is computed once.

## Why this is the right shape

- **Empty isn't a single state — it's a category of states.** Treating
  them the same makes a smart-search backend look stupid. Now each
  reason the result set is empty has its own affordance to recover.
- **Tap-to-correct closes the loop.** The user got their typo flagged
  AND fixed in one tap. No retyping.
- **Filter-clear is one tap from anywhere in results.** Previously
  the only way out of an over-filtered state was to open the bottom
  sheet and uncheck every chip individually.

## Verification

- `tsc --noEmit` clean.
- 27 cart-math unit tests still pass.
- Mock dictionary covers `urbon → urban`, `cooupe → coupe`,
  `sedaan → sedan`, `trial → trail` so the did-you-mean branch can be
  driven in dev without a real backend.
- Filter-empty branch can be driven by:
  1. Searching a real query ("urban" → 1 match).
  2. Opening filters → setting Min Rating to 4+ AND Price to Under $1k.
  3. Empty state should show the filter icon + "Clear filters" CTA.
