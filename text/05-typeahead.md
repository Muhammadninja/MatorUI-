# Fix 05 — Typeahead suggestions

## Goal
Smart search expects live suggestions as the user types. The mock
`searchTransport.typeahead()` was wired in Fix #1 but unused — the bar
just dispatched the debounced search and waited. We surface those
suggestions in a dropdown panel under the focused bar so the user can
short-circuit to a known product or category mid-typing.

## What changed

- `hooks/use-typeahead.ts` (new)
  - Wraps `searchTransport.typeahead()` with its own 120 ms debounce
    (faster than the 300 ms main-search debounce — the network cost is
    tiny and stale dropdowns feel laggy).
  - Per-prefix `AbortController` cancels the in-flight request when
    the user keeps typing.
  - Late-arrival guard on `livePrefixRef.current` so a slow response
    can't repaint suggestions for a prefix the user has moved past.
  - Soft-fails on error — typeahead is purely additive UX. Failures
    drop suggestions silently rather than render an error chrome.
  - Exposes `clear()` so the parent can wipe stale suggestions when
    the bar blurs (avoids a flash of the previous prefix's
    suggestions on next focus).

- `components/screens-components/search-suggestions-panel.tsx` (new)
  - Pure presentational. Two branches:
    - `prefix` non-empty → typeahead suggestions, each with a search
      icon, label, and a "Product" hint when `kind === 'product'`.
    - `prefix` empty → recents (see Fix #6).
  - Empty-but-loading shows a spinner + "Searching…"; empty-and-done
    shows "No suggestions" so the panel still feels alive.

- `components/screens-components/smart-search-bar.tsx`
  - New prop `onFocusChange?: (focused: boolean) => void`. Hooked up
    to the inner `TextInput`'s `onFocus` / `onBlur` so the parent
    knows when to render the suggestions panel.

- `components/shared/app-text-field/index.tsx` + `form-field-primitives/index.tsx`
  - Added `onFocus?: () => void` to AppTextField's prop type and to
    TextEntryField's `Pick<TextInputProps, …>` set so the focus event
    reaches the underlying TextInput.

- `components/screens/explore-screen.tsx`
  - Tracks `isFocused` state.
  - Conditional render of `<SearchSuggestionsPanel />` under the bar
    when `isFocused && !isSearching` — we don't double-stack the panel
    on top of an already-visible results list.
  - `handleSelectSuggestion` sets the query, `flush()`-es to bypass
    debounce (the user committed via a tap), dismisses the keyboard,
    and blurs the bar.

## Why this is the right shape

- **Separate debounce from main search.** Typeahead is keystroke-fast
  feedback; search is "OK, I'm ready" feedback. Sharing one debounce
  knob couples them and makes one or both feel wrong.
- **Soft-fail.** A typeahead error has no recovery path the user
  cares about — silently drop and let the next keystroke retry.
- **Focus-gated panel.** Mounting the panel only while focused saves
  the typeahead request from firing in the background and makes the
  outside-tap-to-close interaction free (blur → unmount).

## Verification

- `tsc --noEmit` clean.
- 27/27 tests still pass.
- Mock typeahead matches titles by prefix (latency 80 ms). Try
  `urb`, `nor`, `aer`, `tra` — each surfaces the matching catalog
  item as a `kind: 'product'` suggestion.
