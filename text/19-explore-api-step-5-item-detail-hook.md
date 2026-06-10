# Step 5 — `useCatalogDetail(id)` hook + item-detail consumes it

## What this step adds

Item-detail now goes through an async hook for its primary data source
(catalog). Previously it called `getCatalogMockDetail(id)` synchronously
on every render — no loading state, no abort, no error path.

The hook introduces a sixth state on top of the list-hook contract:
`'not_found'`. A detail fetch can succeed (200 OK from the backend)
but legitimately have no item (the id doesn't exist anymore). That's
semantically different from a 5xx network failure — `'not_found'` is
not retry-able the way `'error'` is.

## Files changed

| File | Change |
|---|---|
| `hooks/use-catalog-detail.ts` | **New.** Hook takes `id: string \| null \| undefined`. States: `idle / loading / success / not_found / error`. Returns `{ state, detail, error, refresh }`. |
| `components/screens/item-detail-screen.tsx` | Swapped `getCatalogMockDetail(id)` sync call for `useCatalogDetail(id)`. Top-featured remains a sync fallback when the catalog hook resolves to `'not_found'`. |

## Why `'not_found'` is its own state

The list hooks have `'empty'` for "fetch succeeded with zero items".
The same semantic for detail is "fetch succeeded but item ≠ exists" —
404 from the backend, or `null` from the mock when the id isn't in
the catalog. The UI should treat these differently from a transient
network error:

| State | UI move |
|---|---|
| `error` | Retry button (might be transient) |
| `not_found` | "This item is no longer available" + back-to-list, no retry |

Today item-detail doesn't differentiate visually — it just falls back
through the param chain — but the state distinction is in place so the
proper UI can be added without re-shaping the hook.

## Why item-detail keeps the top-featured fallback synchronous

Item-detail can be opened from two sources: catalog (the search row,
catalogue strip) and top-featured (the grid). The router param only
carries the id — the screen has to discover which service knows about
this item.

A naive two-async resolution (`await catalog`, if not found
`await top-featured`) would block the render twice. By keeping the
top-featured branch synchronous, the user sees either:

- Catalog hit → render immediately when the catalog response arrives.
- Catalog miss → catalog hook resolves to `'not_found'`, top-featured
  sync read fills in, render proceeds.

When top-featured eventually moves to a hook (separate migration), the
fallback can be upgraded with an `await` chain. The current shape is
"single async, sync fallback" — fastest perceived render for the
common case (catalog items).

## What `idle` means here

When the screen mounts without an `id` (router params still resolving
or the URL is bad), the hook stays in `'idle'` and never fetches. The
consumer treats `'idle'` like "no item to show yet" — it does NOT
trigger loading UI. This avoids a brief skeleton flash on routes
where the param resolves a frame after mount.

## What the screen UI still inherits

The screen still falls back to `params.title / .description / .price`
when both data sources miss — same fallback chain as before. That's
intentional: deep-link traffic that already has the data in the URL
shouldn't have to wait for any fetch at all. The hook is additive,
not exclusive.

## What HTTP wiring still needs

Same shared-infra gaps as Steps 1–4. The `fetchCatalogDetail` stub
threads `signal` cleanly into the future `fetch` call shown in the
commented HTTP block. Nothing screen-specific needs to change when the
real HTTP lands.

## What's next

**Step 6** — the final step — addresses the universal `SearchPartCard`
not accepting an `image` prop. Today every card renders the same
`test-image.png`. We surface the catalog's `images[]` field through
the card's props with a clean placeholder fallback when the array is
empty. After Step 6 the landing surface is at ~80% readiness — every
list/detail surface goes through a hook, every section has skeleton +
error + empty states, every card can show real photography when the
backend ships URLs.
