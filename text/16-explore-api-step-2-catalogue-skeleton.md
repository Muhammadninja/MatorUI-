# Step 2 — `SearchCatalogue` consumes `useCatalogList`

## What this step adds

The catalogue section of the explore landing now goes through the
real async data path. Before this step `SearchCatalogue` did a
synchronous `getCatalogMockItems()` call and rendered the cards
immediately. There was no loading, error, or empty path because
synchronous data can't fail.

After this step the component renders **one of four UI states** keyed
off the hook's state machine, and the section becomes genuinely
production-ready: the user sees an honest loading state, network
failures get a designed error with retry, and an empty backend doesn't
render a blank section.

## Files changed

| File | Change |
|---|---|
| `components/screens-components/search/search-catalogue-skeleton.tsx` | **New.** Loading shimmer that mirrors `SearchPartCard`'s geometry — 280×280 outline card with image, title bars, price + button line. Three cards visible by default, horizontal scroll preserved. Same pulse/radius conventions as `SearchResultSkeleton`. |
| `components/screens-components/search/search-catalogue.tsx` | Rewritten. Calls `useCatalogList({ page: 1, pageSize: 20 })`. Renders skeleton / error+retry / empty / success based on `state`. The section title still renders in all states so the layout anchor stays put. |

## The four UI states

| State | Render |
|---|---|
| `idle` / `loading` | `<SearchCatalogueSkeleton />` — three pulsing card placeholders, horizontal scroll |
| `error` | `AlertCircle` icon + "Couldn't load catalogue" + error message + retry button |
| `empty` | `PackageOpen` icon + "No catalogue items yet." |
| `success` | Horizontal scroll of `SearchPartCard` items, unchanged from before |

## Why a section-level skeleton, not a global one

The skill's principle "skeleton matches the final layout's shape"
applies per-section, not per-screen. Each landing block has its own
geometry — catalogue is a horizontal 280px-card scroll; top-featured
will be a 2-col grid; suggestions panel is a dropdown list. A single
generic skeleton wouldn't honestly preview any of them. Section-scoped
skeletons let each block's loading state look like the loaded state
will look.

## Why the section title renders in all states

If the title disappears during loading, the page height jumps when the
loaded state arrives and the title returns. Persisting the title across
states keeps the anchor steady — only the swap area below it changes.
Same reasoning as the search-results header rendering before loading
completes.

## The retry button hits `refresh()` not a fresh hook

`useCatalogList.refresh()` reuses the same request shape and increments
the internal sequence — the existing data stays mounted until the new
response lands (or fails again). No flicker, no remount.

## Visual parity with `SearchResultSkeleton`

The catalogue skeleton uses identical conventions:

- `Animated.Value` with two-stage `Animated.loop` for the pulse
- `useNativeDriver: true` for 60fps on a busy main thread
- `RADIUS_*` constants from `radii.ts` — no ad-hoc rounded values
- Two-tone bars (`highlightColor` for prominent rows, `baseColor` for
  secondary) to prevent the whole card looking like one flat block
- Light-mode / dark-mode handled by reading from the theme tokens

If a future contributor wants to tune the loading feel globally, they
edit one constant (`duration: 700`) in one place per skeleton and the
visual continues to match.

## What HTTP wiring still needs (unchanged from Step 1)

Same gap-list as Step 1 — env-aware base URL, auth token wiring,
timeout, error mapping. These benefit search-results + catalogue + the
upcoming top-featured equally; shared infra would land once.

## What's next

**Step 3** brings top-featured up to the same level: add
`fetchTopFeaturedList()` to the service (currently absent), then create
`useTopFeaturedList()` mirroring the catalogue hook.

**Step 4** swaps `SearchTopFeatured` to consume the new hook and adds
its own skeleton, completing the second landing-page block.
