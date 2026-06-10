# Fix 07 — Search-row signal ribbon + API-ready accent tags

## Goal
Replace the corner ribbon / chip / glass badge churn on the search result
row with **one inline ribbon at the flex-end of the price line**, driven
by a typed signal system that is server-ready: today the mock derives
the accent tag from a hash, tomorrow the backend sends it as
`accentTagKind` and the client renders the same UI without a code
change.

## The ribbon

A small dark price-tag shape with a left-pointing triangular notch.
Lives at `components/screens-components/search/search-result-row/ribbon.tsx`.

- **Single-signal mode** (height 18, notch 6) — one lucide icon + one
  uppercase 9px label. Renders for "Cheapest", a server `badge` string,
  or a single accent tag.
- **Composite mode** (height 22, notch 8) — triggers when 2+ signal
  sources fire. Replaces the icon row with a **single filled gold
  Michelin star** (`#f4c542` on light theme, `#b8860b` on dark) followed
  by the composite label **MATOR PICK**. One strong mark instead of a
  cluster of small ones.

The notch is drawn with a 0×0 view whose right border colors the wedge
— no SVG, no shape library, identical on iOS + Android.

## The signal cascade — Option A, locked in

Single source of truth: `signal.ts` → `resolvePriceSignal()`. Nowhere
else picks a signal.

| Tier | Source | Notes |
|------|--------|-------|
| 1 | `isCheapest` | Derived client-side per visible page via `findCheapestId(results)`. Only one row in the visible page can win this. |
| 2 | `result.badge` | Free-text editorial string from the backend ("Top", "New", "Hot pick"). |
| 3 | `result.accentTagKind` | Typed kind from the backend: `'lowest_price' \| 'bestseller'`. Client maps to label + icon via `ACCENT_KIND_REGISTRY`. Falls back to `variant.ts`'s hash-derived `accentTag` until the backend ships the field. |

Resolution rules:

- 0 matches → no ribbon.
- 1 match → single-signal ribbon (highest tier wins, others are
  intentionally dropped — by product design).
- 2+ matches → composite **MATOR PICK** ribbon. Icons are collected in
  priority order so the cheapest icon leads.

Editor's pick was removed from the kind union and the fallback pool.

## Math check (catalog mocks)

`(hashCode(id) * 7) % 4` indexes into a 4-slot mock table
(`['lowest_price', 'bestseller', null, null]`).

> Note: the math-check below predates the removal of `mator_verified`;
> rows showing kind `mator_verified` should now hash to a different
> slot (or `null`) — the test fixtures still apply structurally, just
> with one fewer kind in the pool.

| id | hash | idx | kind | price | badge |
|---|---|---|---|---|---|
| urban-glide-x   | 46,247,467   | 4 | (none) | $18,400 | — |
| northline-suv   | 1,409,760,512 | 4 | (none) | $29,900 | — |
| aero-coupe-s    | 915,903,288  | 1 | bestseller | $34,200 | — |
| trail-pro-ev    | 256,617,848  | 1 | bestseller | $26,750 | — |
| mator-elite     | 267,069,321  | 2 | mator_verified | $24,500 | — |
| **mator-prime** | **277,406,581** | **2** | **mator_verified** | **$16,900** | **Bestseller** |

`mator-prime` is the cheapest in the catalog, has a server `badge` of
`'Bestseller'`, and hashes to slot 2 (`mator_verified`). All three
signal sources fire → composite **MATOR PICK** ribbon.

`mator-elite` ($24,500) is the single-signal Mator Certified test row.

## API integration — what changed

### `types/search.ts`

- New union: `AccentTagKind = 'lowest_price' | 'bestseller'`. *(originally also included `'mator_verified'`; later removed.)*
- `SearchResult` gains optional `accentTagKind?: AccentTagKind`.
- `badge` comment hardened — it's the free-text editorial path.

### `signal.ts`

- New `ACCENT_KIND_REGISTRY: Record<AccentTagKind, { label, Icon }>` —
  single source for how each kind renders. **Only place** that knows
  how to display a kind. The server contract is `kind`, the display is
  ours.
- `resolvePriceSignal()` now takes `accentTagKind` + `accentTagFallback`.
  Prefers the server kind; falls back to the hash-derived shape only
  when the server didn't send anything.

### `services/search-service.ts`

- `catalogToResult()` derives `accentTagKind` from the same hash the
  client used to derive `accentTag` directly. The mock emits the kind,
  same as the future HTTP transport will. This makes mock and real
  transport behaviourally identical to the client.
- HTTP-stub block updated with a contract note for the backend team:
  what to send, what stays client-side, where to look for the design.

### `variant.ts`

- Editor's pick removed. Pool is now `[lowest_price, bestseller,
  null, null]` (~50% tag rate). *(Originally `[lowest_price, bestseller, mator_verified, null, null]` at ~60%; mator_verified later removed.)*
- Comment clarifies the slot is now a **client-side fallback**, not
  the source of truth — to be deleted once production reliably emits
  `accentTagKind`.

### `search-result-row.tsx`

- Passes `result.accentTagKind` (preferred) AND `variant.accentTag`
  (fallback) into the resolver.

## Migration path

1. **Today** (this commit): client prefers `result.accentTagKind`; mock
   emits it. UI is identical to before. Hash fallback still wired up.
2. **Backend ships `accentTagKind`**: production responses start
   carrying the kind. No client change needed.
3. **Once the field is reliably present**: delete the `accentTag` slot
   from `variant.ts`, drop the `accentTagFallback` parameter from
   `resolvePriceSignal`, and delete the `MOCK_ACCENT_KINDS` table from
   `search-service.ts`. The mock just sets `accentTagKind` to whatever
   the catalog item declares (or omits it).

## What was deleted along the way

| Removed | Why |
|---|---|
| `corner-ribbon.tsx` (diagonal CHEAPEST flag) | Replaced by the inline ribbon at the price row. |
| `accent-tag.tsx` (in-card chip) | The accent tag now flows through the same ribbon as everything else. |
| `glass-chip.tsx` (frosted-glass tag stack on the thumbnail) | The thumbnail no longer carries signals — the ribbon owns the entire signal surface. |
| Editor's pick | Per product. |

## Cross-device notes

- The ribbon is pure flex flow + a notch made from CSS borders. No
  `position: 'absolute'` introduced for any chip / ribbon layout.
- The only `position: absolute` left in `thumbnail.tsx` was the
  overscan-crop trick, and it's been swapped for `transform: [{ scale:
  1.08 }]` — layout-neutral, identical iOS/Android.
- Text in the ribbon uses `includeFontPadding: false` +
  `textAlignVertical: 'center'` + explicit `lineHeight`, so the
  uppercase glyph is true-centered on both platforms.
