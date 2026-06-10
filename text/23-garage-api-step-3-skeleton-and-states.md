# Step 3 — `garage-skeleton.tsx` + screen renders all five states

## What this step adds

The garage screen now renders one of five distinct UI paths off the
`state` field added in Step 2. The generic `AppLoadingState` spinner
label is replaced by a section-scoped skeleton that mirrors the loaded
geometry. Error gets a designed retry path. Empty stays designed.
Success is unchanged.

## Files changed

| File | Change |
|---|---|
| `components/screens-components/garage/garage-skeleton.tsx` | **New.** Primary card placeholder (~320 tall — image + headline + stats row) + "Also in the garage" eyebrow bar + two secondary tile placeholders (~96 each). Same pulse + radius conventions as the catalogue + top-featured skeletons. |
| `components/screens/garage-screen.tsx` | Migrated to read `state` instead of composing `isLoading + vehicles.length`. Added explicit branches for `idle/loading` → `<GarageSkeleton />`, `error` → centered error UI with retry, `empty` → `<GarageEmptyState />`, default → success render. Removed the now-unused `AppLoadingState` import. Added `AppButton` + `AlertCircle` + theme-context imports for the error path. |

## The five rendered states

| State | UI |
|---|---|
| `loading` / `idle` | `<GarageSkeleton />` — pulsing primary card + tiles inside the safe-area inset |
| `error` | Centered `AlertCircle` + "Couldn't load your garage" + retry button |
| `empty` | `<GarageEmptyState />` + add-vehicle sheet wired |
| `success` | Primary card + "Also in the garage" + secondary tile list |

## Why the skeleton matches the real geometry

The skill principle "skeleton matches the final layout's shape"
applied per-section, as it did for the catalogue and top-featured:

- Skeleton renders inside `pt={topInset}` so it slots under the blur
  header at the same Y position the loaded primary card will occupy.
- Card placeholder is 320 tall — the same approximate height as
  `GaragePrimaryVehicleCard` populated with one image + headline +
  stats. When the data resolves, the skeleton disappears and the real
  card paints in roughly the same vertical space — no layout jump.
- Two tile placeholders below mirror the typical "user has 2-3 secondary
  vehicles" shape. Users with more vehicles see additional tiles after
  load; the skeleton intentionally doesn't try to predict the exact
  count, only the shape.

## Why the error path lives at the screen level, not the header

The previous code rendered `<AppInlineError>` above the success layout
when an error existed. That's the right pattern for transient
mutation failures (the user tried to set-primary and the request 500'd
— show the error inline while keeping their data visible).

But for a FAILED INITIAL LOAD, there's nothing to keep visible —
`vehicles.length === 0` because the fetch never succeeded. The inline
error above a blank empty-state was misleading: it read as "the empty
state is the truth and there's also been an error." The full-screen
error with retry is honest: "we couldn't load anything; tap retry."

Mutation-level errors (set-primary failure on a populated cache) still
flow through `error` → the success path's `<AppInlineError>` could be
re-added later without conflicting with this Step's full-screen error
for initial-load failures. Step 6 covers wiring mutation error UI back
in.

## The retry button calls `clearError()` then `refresh()`

`clearError()` resets the error state so the screen leaves the
`'error'` branch and renders the skeleton during the retry attempt.
`refresh()` issues the new read with its own AbortController (Step 1
plumbing). If it succeeds → `success` or `empty`. If it fails again →
back to `error` with the new message.

This is the same pattern the catalogue retry uses
(`search-catalogue.tsx`) — clearing error then re-fetching means the
loading skeleton appears DURING the retry attempt, not the stale
error. User feels the screen responding.

## Backward compatibility check

Existing screens (`vehicle-detail-screen.tsx`, `add-vehicle-screen.tsx`)
still read `isLoading`, `error`, `vehicles` — these flags weren't
removed in Step 2 and aren't removed here. They keep working.

## What's next

**Step 4** wires `HttpGarageTransport` at runtime — adds a config
module for the API base URL + auth token, switches `garage-service.ts`
to construct the HTTP transport after login. After Step 4 the real
backend is one env-var away from being live.

**Step 5** addresses the `saving` state in `AddVehicleWizard` that's
declared but never set — disables the submit button + spins it while
the mutation is in flight.

**Step 6** closes the remaining gaps: socket events typed for
realtime, delete-error UI on `vehicle-detail-screen`, and inline-error
above the success path for mutation failures (the pattern Step 3
deliberately deferred for clarity).
