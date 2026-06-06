# Fix 06 — Recent searches persistence

## Goal
When the user focuses the search bar with no text in it, we should
show the queries they ran recently — a one-tap path back into work
they already started. Re-typing a query they ran 30 seconds ago is
friction the smart-search UX promised to remove.

## What changed

- `services/recent-searches-storage.ts` (new)
  - AsyncStorage envelope at key `recent_searches:v1`. Same shape as
    `likes-storage.ts` (versioned envelope, soft-fail on parse).
  - Cap of 8 queries (`MAX_RECENT`).
  - Pure helper `pushRecentSearch(prev, next)`:
    - Trims `next`, drops empty input.
    - Dedupes against `prev` by case-insensitive trimmed match (so
      "Urban" and "urban" don't both sit in the list).
    - Returns `[next, ...filteredPrev]` capped to `MAX_RECENT`.

- `hooks/use-recent-searches.ts` (new)
  - Loads on mount and exposes `isHydrated` so the panel can skip
    rendering the empty state during the first paint and avoid a
    flash of "no recents → recents."
  - `skipNextSave` ref guards against an initial-load roundtrip
    persisting back what we just read.
  - Returns `{ queries, isHydrated, add, remove, clear }`.

- `components/screens-components/search-suggestions-panel.tsx`
  - Recents branch:
    - "Recent" header + "Clear all" link in the same row.
    - Each row is a `clock` icon + the query text + a tap-target X to
      remove that single entry.
    - Tapping the row body fires `onSelectRecent(query)`.
    - Empty recents shows the same panel chrome but a friendly
      "Start typing to search the catalog." prompt.

- `components/screens/explore-screen.tsx`
  - `recents = useRecentSearches()` lives next to `useSearch`.
  - A `useEffect` watches `(search.state, search.query)`. When state
    becomes `success` or `empty` with a non-trivial query (≥ 2 chars),
    we push the query into recents. `loading`, `error`, and `idle`
    are excluded — we don't want to remember a typo the user never
    finished or a network blip.
  - `handleSelectRecent`: sets query → flushes → dismisses keyboard
    → blurs.
  - Recents are only visible when `isFocused && !isSearching` AND the
    bar is empty — keeps the panel from sitting on top of an active
    results list.

## Why this is the right shape

- **Save on commit, not on every keystroke.** Saving every keystroke
  would fill recents with prefixes ("u", "ur", "urb", "urba",
  "urban"). Save the value the user actually got an answer for.
- **Persist the casing the user typed.** Dedupe is case-insensitive
  but display preserves the original — recognition over recall.
- **Per-row remove + Clear all.** Recents are personal data; users
  expect to be able to scrub them without an account-settings detour.
- **Hydration gate.** Without `isHydrated`, the panel renders an
  empty state for one frame, then snaps to the real list — the kind
  of flicker that triggers a "is this broken?" complaint.

## Verification

- `tsc --noEmit` clean.
- 27/27 tests still pass.
- Drive it:
  1. Run a search for `urban` → result shows.
  2. Clear input, blur, focus again → "urban" appears in Recent.
  3. Tap → query reruns, results show.
  4. Long enough? Refocus, swipe X on the row → it disappears.
  5. Tap "Clear all" → entire list gone.
- Restart the app → recents survive (AsyncStorage envelope).

## What this unblocks

- Trending searches (server-pushed) can drop into the same panel as
  another branch alongside "Recent."
- A "Suggested for you" slot (personalized) could share the panel
  template once the backend has user history.
