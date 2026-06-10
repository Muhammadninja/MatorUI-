# Step 6 — `SearchPartCard` accepts `image` prop with placeholder fallback

## What this step adds

The final piece of the explore-landing readiness work. Every product
card on the landing surface — and the item-detail hero — was
hard-coding `require('@/assets/images/test-image.png')`. The image
shipped to the user was the same dev placeholder regardless of which
product the card represented.

After this step:

- `SearchPartCard` accepts an `image?: string` prop (URL) with an
  `imageSource?: number` escape hatch for static-asset callers, and
  falls back to a single named `PLACEHOLDER_IMAGE` constant when
  neither is present.
- The catalogue strip threads `card.images[0]` from the catalog
  response down to the card.
- The top-featured grid threads `item.images?.[0]` (after the type
  contract was extended to include the optional `images` field).
- The item-detail hero carousel maps `catalogDetail.item.images` to
  `{ uri }` sources, falling back to the single placeholder array
  only when the catalog ships no images.

## Files changed

| File | Change |
|---|---|
| `components/screens-components/search/search-part-card.tsx` | Added `image?: string` and `imageSource?: number` props. Added `PLACEHOLDER_IMAGE` constant. Added a small `resolvedImageSource` resolution: prefer URL string → fall back to `imageSource` → fall back to placeholder. |
| `services/top-featured-service.ts` | `TopFeaturedItem` gains optional `images?: string[]`. Contract is HTTP-ready before the backend ships the field. |
| `components/screens-components/search/search-catalogue.tsx` | Threads `image={card.images[0]}` through to `SearchPartCard`. |
| `components/screens-components/search/search-top-featured.tsx` | Threads `image={item.images?.[0]}` through (optional chaining since the field is still optional on the type). |
| `components/screens/item-detail-screen.tsx` | `heroSources` derived: catalog images → `{ uri }` array; otherwise the single-image `FALLBACK_HERO_IMAGES`. Carousel `sources={heroSources}`. |

## The resolution chain in `SearchPartCard`

```ts
const resolvedImageSource =
  image && image.length > 0
    ? { uri: image }
    : imageSource ?? PLACEHOLDER_IMAGE;
```

Three layers, ordered by likely future state:

1. **URL string** — what the backend will eventually send. Empty
   string is treated as "no image" so backends that prefer empties
   over nulls don't accidentally trigger a broken-image render.
2. **Static asset** — for callers that already have a `require()`
   result. Useful for hand-curated promo cards or pre-loaded assets.
3. **Placeholder constant** — the dev fallback. Lives in one place so
   it's findable / replaceable.

## Why `TopFeaturedItem.images` is optional

The catalog item type has `images: string[]` as required. The
top-featured type doesn't, because the mock data file
(`search-top-featured.data.ts`) doesn't currently carry images. Making
the field required would require either (a) editing every mock entry
to add `images: []` or (b) breaking compile until the data is updated.
Optional + optional-chain at the call site is the lower-disruption path
that still encodes the contract.

When the backend ships URLs and the mock is retired, this can become
required.

## The placeholder image asset stays in the bundle

`PLACEHOLDER_IMAGE` is still `test-image.png`, the same asset that was
previously hard-coded inline. We don't ship a different placeholder
because nothing better exists yet (no "no-image" SVG, no skeleton-style
gray asset). The constant gives us one place to swap it later. If the
design team eventually ships a "no product image" asset, only the
constant changes.

## What's now end-to-end ready

After Step 6, the explore landing surface looks like this:

| Section | Data source | UI states | Image source |
|---|---|---|---|
| Quick filters | Hardcoded (unwired) | Static | n/a |
| Catalogue | `useCatalogList` (async) | skeleton / error / empty / success | `card.images[0]` |
| Top Featured | `useTopFeaturedList` (async) | skeleton / error / empty / success | `item.images?.[0]` |
| Suggestions panel | `searchTransport.typeahead` (async) | typeahead / recents / loading | n/a (icon-only) |
| Item detail | `useCatalogDetail(id)` + sync top-featured fallback | idle / loading / not_found / error / success | `catalogDetail.item.images` |

## Readiness scorecard

Per the original audit dimensions:

| Dimension | Pre-Step-1 | After Step 6 |
|---|---|---|
| Type completeness | 8/10 | 9/10 |
| Service abstraction | 4/10 | 8/10 |
| Consumer hookup (hooks instead of sync mocks) | 2/10 | 9/10 |
| State handling (loading / empty / error) | 1/10 | 8/10 |
| Production hardening (abort / retry) | 2/10 | 6/10 |
| Realtime readiness | 5/10 | 5/10 |
| **Overall** | **~25%** | **~78%** |

## What's not in this set of steps

These are real gaps but they don't fit the "explore landing readiness"
slice. They warrant their own follow-up:

1. **Env-aware base URL** — `'/api/v1/catalog'` and `'/api/v1/top-featured'`
   are hardcoded. Needs a `config/env.ts` module pulling from build-time
   env vars.
2. **Auth token wiring** — both services' HTTP stubs reference
   `Bearer` tokens but no `getAuthToken()` exists.
3. **Timeout** — current abort is only by component-unmount / re-request.
   No 10s ceiling for stalled backends.
4. **Error mapping** — 401/429/5xx all surface as the same generic
   error string. No re-auth redirect, no retry-after.
5. **Realtime listener** — socket channels are declared but no client
   subscriber exists.
6. **Top-featured screen migration** — the dedicated `/top-featured`
   route still uses the sync `getTopFeaturedMockResponse`. Moving it
   to `useTopFeaturedList` is a one-screen follow-up.
7. **Quick filters wiring** — the chips on the explore landing are
   still decorative. They should call `useSearch.setFilters({ … })`
   or be removed.
8. **Promo banner** — still returns `null`. Needs a campaigns service.

Items 1–4 are the same shared-infra gaps the search-results readiness
audit named. They benefit all three transports (search, catalog,
top-featured) equally and should be tackled as a single infra phase.

## What's next

Out of scope for this readiness slice. Logical follow-up streams:

- **Phase B: shared HTTP infra** — env config, auth, timeout, error
  mapping. Once. Benefits all three transports.
- **Phase C: top-featured screen migration** — move `/top-featured`
  off the sync mock onto `useTopFeaturedList`.
- **Phase D: realtime** — implement `useCatalogSocket` /
  `useTopFeaturedSocket` against the declared channels.
- **Phase E: quick filters + promo banner wiring** — closes the last
  two "decorative on the landing" items.
