# UI Finish — Step 3: route delivery row colors through theme tokens

## Goal
Make the delivery row's green / gray follow the active theme. The
literal hexes (`#16a34a`, `#737373`) baked into `variant.ts` were
identical in light and dark mode — fine on white-ish backgrounds, but
not following the rest of the monochrome system.

Same pattern as the accent-tag kind registry: **data layer emits a
semantic kind, component maps kind → display.** Centralizes the visual
decision in the component, not scattered across mock data.

## Why this was step 3
After step 2 stripped the dead `color` field from accent tags, the only
remaining literal-hex color in the row was `delivery.color`. Two
problems with the previous shape:

1. **Hex never followed the theme.** `#16a34a` is a fixed green —
   visible on white, harder to read on the dark `tokens.card`
   background (`#111111`).
2. **The data layer "owned" a visual choice.** A future designer
   tweaking green would have to find it in `services/`-adjacent mock
   data instead of in a component.

## Changes

### `components/screens-components/search/search-result-row/variant.ts`

- New exported union: `DeliveryKind = 'free' | 'standard'`.
- `CardVariant.delivery` shape changed from
  `{ label: string; color: string }`
  to
  `{ label: string; kind: DeliveryKind }`.
  Comment added explaining why.
- `deliveryOptions` literal entries now carry `kind: 'free' | 'standard'`
  instead of `color: SUCCESS | NEUTRAL`.
- `SUCCESS` and `NEUTRAL` const declarations removed (no remaining
  readers).

### `components/screens-components/search/search-result-row/delivery-row.tsx`

- Imports `useThemeContext`.
- Maps kind → token:
  - `'free'` → `tokens.success` (light: `#0f9d58`, dark: `#22c55e`).
  - `'standard'` → `tokens.gray400` (light: `#9a9a9a`, dark: `#737373`).
- Removes the two `delivery.color` reads (truck icon + label both now
  use the resolved token color via a single local `color` variable).

## What was deliberately NOT changed
- The `Truck` icon, font size (`10`), weight (`semibold`), padding,
  and `numberOfLines={1}` — visual treatment is identical, only the
  color resolution moved.
- The delivery-kind weighting (3 free options : 1 standard option) —
  still 75% free, 25% standard per item.

## Verification
- `npx tsc --noEmit` passes.
- `grep -rn 'delivery\.color\|SUCCESS\|NEUTRAL'` across `components/`
  returns no matches outside the now-irrelevant `deliveryOptions`
  table name. No stale reader.

## Net diff
- `variant.ts`: −5 lines (constants + color literals), +2 lines (kind
  type and comment).
- `delivery-row.tsx`: +3 lines (theme hook + kind→token resolution),
  no removed lines but two `delivery.color` reads replaced with a
  single `color` variable.

## Net effect
- Light mode: visually unchanged (`tokens.success` is `#0f9d58`,
  effectively the same green as the old `#16a34a`).
- Dark mode: green now resolves to `#22c55e` — brighter, more
  readable on the dark card. Standard gray resolves to `#737373` —
  the same dark-mode gray as before, but now consistent with the
  rest of the row's gray tokens.

## Next
The "critical" and "medium" tiers of the UI punch list are now done:
- ✅ Skeleton geometry + loading padding (step 1).
- ✅ Variant dead color data (step 2).
- ✅ Delivery row token routing (step 3).

Remaining items are all **minor / verify, don't fix yet**:
- `RatingRow` vs `DeliveryRow` font size hierarchy (11 vs 10).
- `LikeButton` tap target ≥ 44pt.
- `HighlightedTitle` multi-line behavior.
- Pull-to-refresh wiring.
- `ResultsEmpty` pill styling vs. the monochrome ribbon language.

UI is at a state where API integration can start without leaving
visible regressions on the search results surface.
