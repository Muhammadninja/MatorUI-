# Step 3 — `fetchTopFeaturedList` stub + `useTopFeaturedList` hook

## What this step adds

Two missing pieces of the top-featured data layer:

1. A real **async transport** (`fetchTopFeaturedList`) — the catalog
   service had one but top-featured didn't.
2. A **consumer-side hook** (`useTopFeaturedList`) with the same
   five-state machine as `useCatalogList`.

Before this step the only way to read top-featured items was a sync
call to `getTopFeaturedMockItems()` (used by `top-featured-screen`) or
a direct import of the `.data.ts` file (used by `SearchTopFeatured`).
Neither went through the service's typed contract, neither was
cancellable, neither had loading/error/empty paths.

## Files changed

| File | Change |
|---|---|
| `services/top-featured-service.ts` | Added `signal?: AbortSignal` to `TopFeaturedListRequest`. Added `MOCK_LATENCY_MS = 320`, a local `delay()` helper, and `fetchTopFeaturedList()` async function. HTTP-stub comments show POST + JSON body + signal threading. |
| `hooks/use-top-featured-list.ts` | **New.** Mirror of `useCatalogList` — same state machine, same abort-on-unmount, same stale-response guard, plus a `availableFilters` field carried through from the response. |

## Contract parity with `useCatalogList`

The two list hooks should look indistinguishable to consumers — same
mental model, same render branches. The only delta is the extra
`availableFilters` field returned from `useTopFeaturedList` because the
top-featured response contract carries it (per
`TopFeaturedListResponse.availableFilters`):

```ts
// Catalogue:
const { state, items, total, error, refresh } = useCatalogList({ … });

// Top featured:
const { state, items, total, error, availableFilters, refresh } =
  useTopFeaturedList({ … });
```

Future filter-sheet wiring on the top-featured screen can read
`availableFilters` directly from the hook — no second fetch needed.

## Why `JSON.stringify(filters)` in the memo dep array

The `request.filters` field is an object, so reference-equality
re-fires on every render even when contents are identical. The
catalogue hook gets away with primitives (`category` is a string).
Top-featured needs the JSON stringification trick to make the memo
stable across renders without forcing consumers to also memo the
object themselves.

The lint-disable comment is intentional — `filtersKey` is a derived
primitive of `request.filters`, the linter doesn't model that.

## `fetchTopFeaturedList`'s mock path duplicates a little code

The mock branch reuses the filter-matching logic that lived in
`getTopFeaturedMockResponse`. Could have called that function and
extracted the result, but the signatures differ:
`getTopFeaturedMockResponse` takes a `TopFeaturedFilters` map (the UI
shape), `fetchTopFeaturedList` takes a `TopFeaturedListRequest` (the
wire shape). Translating between them inside the mock would obscure
what the HTTP transport will actually do. So the mock matches the
filter shape the HTTP path will receive, for honest readiness.

## `getTopFeaturedMockResponse` is still alive

The legacy `getTopFeaturedMockResponse(filters)` function is kept
untouched because the `top-featured-screen` (a separate route, not
audited here) still calls it. Migrating that screen to the new hook
is a follow-up — out of scope for the explore-landing readiness work.

## What HTTP wiring still needs

Same shared-infra gap as Steps 1–2: env-aware `API_BASE`, auth token
wiring, request timeout, error mapping. The top-featured stub now
mirrors the catalog stub, so whichever shared module lands will swap
both at once.

## What's next

**Step 4** swaps `SearchTopFeatured` from its direct `.data.ts`
import to the new hook, builds a matching skeleton, and renders the
five UI states. After Step 4, both major landing blocks are on the
same async contract end-to-end.
