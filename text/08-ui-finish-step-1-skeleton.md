# UI Finish — Step 1: skeleton geometry + loading padding

## Goal
Make the search loading state visually indistinguishable from the
real search-results list, so the user never sees a layout pop when
results arrive.

## Why this was first
Two related issues caused a visible shift between loading and success:

1. **Skeleton card looked nothing like the real card.** The skeleton
   was built for the old design (rounded card frame, 100×100 thumbnail,
   inner padding, no ribbon placeholder). The real card is now
   edge-to-edge with a single 1px bottom divider, a 150×150 thumbnail
   with a small border-radius, and a ribbon at the flex-end of the
   price line.
2. **Loading had horizontal padding; success did not.** `results-loading.tsx`
   wrapped the skeleton stack in `px={16}`, while `search-results.tsx`
   set `contentContainerStyle={{ paddingHorizontal: 0 }}` on the success
   list. So skeleton rows looked inset, then real rows snapped to the
   screen edge.

## Changes

### `components/screens-components/search/search-result-skeleton.tsx`
Rewritten to mirror the post-redesign `SearchResultRow` geometry:

- Card wrapper: `borderBottomWidth: 1`, `borderColor: tokens.gray300`,
  no border-radius, no horizontal padding. Matches the real card.
- Row: `gap={20}, align="stretch"`. Matches the real row.
- Thumbnail box: `150 × ≥150` with `borderRadius: 8` — same constants as
  `thumbnail.tsx`.
- Text column: `flex: 1`, `paddingBottom: 8`, internal `gap: 8`.
- New: **price line + trailing ribbon placeholder** — `row` with
  `justifyContent: 'space-between'` and `align="flex-end"`, mirroring
  the real `PriceBlock`'s ribbon layout. A small 84×18 block stands in
  for the ribbon shape.
- Removed: rounded card frame, inset padding, the "chevron slot"
  comment from the old skeleton (the real card has no chevron).

### `components/screens-components/search/search-results/results-loading.tsx`
- Dropped `px={16}` from the outer wrapper.
- Wrapped the "Searching for …" label in its own `paddingHorizontal: 16`
  so it stays inside the regular text gutter.
- Removed the inner `gap={14}` between skeleton cards — the real list
  has no gap between rows (cards stack against each other separated by
  the 1px bottom divider).

Net effect: loading state and success state are visually identical
in geometry. The only difference is the shimmer animation.

## What was deliberately NOT changed
- The pulse animation itself (700ms ease in/out, native driver) — it
  was already correct.
- `SKELETON_ROWS = 5` — five rows feels right for an above-the-fold
  loading state.
- The skeleton thumbnail is a flat color, not a sub-skeleton. A real
  product image would never be guessable while loading, so a single
  block reads cleaner than fake content shimmer.

## Verification
- `npx tsc --noEmit` passes.
- Geometry match was verified by side-by-side comparison of:
  - Card wrapper: `borderBottomWidth: 1` + `borderColor: tokens.gray300`
    in both files.
  - Row: `gap={20}` + `align="stretch"` in both.
  - Thumbnail constants: `THUMB_WIDTH = 150`, `THUMB_HEIGHT = 150`,
    `borderRadius: 8` in both.
  - Text column: `flex: 1` + `paddingBottom: 8` in both.

## Next
Step 2 of the UI punch list is in flight: dead color data in
`variant.ts` (each `tagOption` still carries a `color: '#…'` field that
the ribbon hasn't read since the monochrome switch).
