# Step 4 — `SearchTopFeatured` consumes `useTopFeaturedList`

## What this step adds

The second of the two landing-page blocks is now on the async data
contract. `SearchTopFeatured` previously imported the static
`search-top-featured.data` file directly — it didn't go through any
service at all, so the typed contract built into
`top-featured-service.ts` was unused on this surface.

After this step both landing blocks (`SearchCatalogue` and
`SearchTopFeatured`) share the same five-state UI shape, the same
abort/cancel guarantees, and the same skeleton/error/empty visual
treatment.

## Files changed

| File | Change |
|---|---|
| `components/screens-components/search/search-top-featured-skeleton.tsx` | **New.** Loading shimmer for the 2-column grid — four 48%-width compact card placeholders with image, title bars, price + button. Same pulse + radius conventions as the catalogue skeleton. |
| `components/screens-components/search/search-top-featured.tsx` | Rewritten. Switched from raw `TOP_FEATURED_ITEMS` import to `useTopFeaturedList({ page: 1, pageSize: 6, filters: {} })`. Renders skeleton / error+retry / empty / success. Header (title + "View all" affordance) renders in all states so the layout anchor stays put. |

## The four UI states (now identical across both blocks)

| State | Render |
|---|---|
| `idle` / `loading` | Four 48%-width pulsing card placeholders in the wrap row |
| `error` | `AlertCircle` icon + "Couldn't load top featured" + retry button |
| `empty` | `PackageOpen` icon + "Nothing featured right now." |
| `success` | 2-column grid of `SearchPartCard compact` cards |

Compare to Step 2's catalogue states — identical pattern, only the
geometry of the success layout differs (horizontal scroll vs grid).
Consistency at the state-machine level is what makes the page feel
coherent across loading.

## Why pageSize 6 on the landing

The previous static data had 6 hand-picked top-featured items. Keeping
`pageSize: 6` preserves that visual density and prevents the landing
grid from suddenly showing 24 cards (the default request size on the
dedicated `/top-featured` screen). The `View all` affordance routes
to the dedicated screen where the larger page size kicks in.

## The legacy `top-featured-screen` still uses the old path

The dedicated `/top-featured` route (`top-featured-screen.tsx`) still
calls `getTopFeaturedMockResponse(filters)` synchronously. That screen
wasn't in the explore-landing audit scope; migrating it to
`useTopFeaturedList` is a follow-up step. The new hook is designed so
the migration is a drop-in — same response shape, same `availableFilters`
return.

## "View all" affordance preserved in all states

Even during loading, the section header (title + "View all" chevron)
renders so the user knows the section exists and can navigate to the
dedicated screen without waiting for the in-place fetch to resolve.
This is the same pattern Step 2 used for the catalogue title — only
the swap area below the header changes per state.

## What HTTP wiring still needs

Same shared-infra gaps (env-aware base URL, auth, timeout, error
mapping) as Steps 1–3. The top-featured stub mirrors the catalog
stub byte-for-byte in shape; shared infra lands once for all three
endpoints.

## Readiness score after Step 4

Landing surface has now moved from "sync mock reads" to "async hook
consumes with full state machine" on its two primary blocks. Plus the
suggestions panel was already at 70% via the search transport. The
remaining gap is item-detail (still sync) and the universal
`SearchPartCard` not accepting an `image` prop.

## What's next

**Step 5** brings item-detail onto the same hook pattern with
`useCatalogDetail(id)`. After Step 5 every list-or-detail surface that
reads from these two services goes through an async hook with proper
state handling.

**Step 6** finally addresses the per-card image issue — surfaces the
catalog's `images[]` field through `SearchPartCard` so the card can
render real product photography when the backend ships URLs (and falls
back to the placeholder when not).
