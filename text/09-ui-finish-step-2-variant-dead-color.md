# UI Finish — Step 2: drop the dead `color` field from `variant.ts`

## Goal
Remove a field that's been carried for a while without being read,
so the only place a future developer can change a tag is in one place
(the kind registry in `signal.ts`), not by accidentally tweaking a
hex string in `variant.ts` and wondering why nothing changes.

## Why this was step 2
After the search-result row went monochrome, the ribbon stopped
reading per-tag colors — it now styles itself from `tokens.secondary` /
`tokens.onSecondary`. But each `tagOption` in `variant.ts` was still
carrying:

```ts
{ label: 'Lowest price', color: '#16a34a', Icon: BadgeCheck }
{ label: 'Bestseller',   color: '#d97706', Icon: Award }
{ label: 'Mator Certified', color: '#0ea5e9', Icon: ShieldCheck }
```

Nothing read those hexes. They were dead data — visual lies in the
source, since a future reader would assume "Bestseller is orange" is
part of the design.

## Changes

### `components/screens-components/search/search-result-row/variant.ts`
- `CardVariant.accentTag` type: dropped the required `color: string`
  field. Added a one-line note in the type definition explaining why
  it was removed (ribbon styles from `tokens.secondary` now).
- All three `tagOption` entries: dropped their `color: '#…'` literals.
- `deliveryOptions` was **not** touched — `delivery.color` is still
  read by `delivery-row.tsx` (separate concern, separate step).
- `SUCCESS` and `NEUTRAL` constants kept — they're still used to build
  `deliveryOptions` colors.

## What was deliberately NOT changed
- `delivery: { label, color }` — the delivery row still uses
  `delivery.color` per-card (green for free delivery tiers, gray for
  standard). That's a real visual signal, not dead data. **Step 3 of
  the UI punch list** will decide whether to route those through theme
  tokens (`tokens.success` / `tokens.gray400`) or keep the literal
  hexes.

## Verification
- `npx tsc --noEmit` passes (the `color` field was optional in spirit
  — nothing depended on it).
- `grep -rn 'accentTag\.color\|tag\.color'` across the codebase
  returns zero matches. No live reader was relying on it.

## Net diff
4 lines removed (1 from the type, 3 from the literal entries). One
field of dead intent gone from the design system.

## Next
Step 3 of the UI punch list is in flight:
`delivery-row.tsx` reads hardcoded `#16a34a` / `#737373` via
`variant.ts`. Decide whether those should route through
`tokens.success` / `tokens.gray400` so they follow the theme, or stay
as literal hexes by design.
