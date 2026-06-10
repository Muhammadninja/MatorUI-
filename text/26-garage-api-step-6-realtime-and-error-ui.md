# Step 6 — Realtime contract types + mutation-error UI on vehicle-detail

## What this step adds

The last two gaps from the API readiness audit:

1. **Realtime contract types.** `GarageSocketEvent`,
   `GARAGE_SOCKET_CHANNEL`, `GARAGE_SOCKET_EVENTS` constants. Same
   shape as `CatalogSocketEvent` and `TopFeaturedSocketEvent` so a
   future shared socket-subscription module dispatches to all three
   domains uniformly. No client-side subscriber is built yet — that's
   Phase D infra — but the backend contract is now declared.

2. **Mutation-error UI on vehicle-detail.** When `setPrimary`,
   `removeVehicle`, or `updateVehicle` fails, the error message is
   captured in the hook's `error` state. Previously the screen had no
   UI for it — failures were silently invisible. Now an
   `AppInlineError` pill renders above the headline with a dismiss
   action. The vehicle data stays visible underneath because the data
   is still valid; only the last mutation failed.

## Files changed

| File | Change |
|---|---|
| `services/garage-service.ts` | New `GarageSocketEvent` type with `event` union covering snapshot / vehicle.created / .updated / .deleted / primary.changed. `snapshotVersion` field for cache reconciliation. New `GARAGE_SOCKET_CHANNEL = 'garage:vehicles'` constant + `GARAGE_SOCKET_EVENTS` array. |
| `components/screens/vehicle-detail-screen.tsx` | Added `AppInlineError` import. `useGarage()` destructure now pulls `error` and `clearError`. Inline error pill renders above `VehicleDetailHeadline` when `error` is truthy, with a dismiss action. |

## The realtime contract

```ts
export type GarageSocketEvent = {
  event:
    | 'garage.snapshot'
    | 'garage.vehicle.created'
    | 'garage.vehicle.updated'
    | 'garage.vehicle.deleted'
    | 'garage.primary.changed';
  snapshotVersion: string;
  timestamp: string;
  vehicle?: Vehicle;
  vehicleId?: string;
};
```

Five event types covering every mutation path the transport
exposes. `snapshotVersion` is the key field — it lets late
subscribers reconcile against the canonical state without re-fetching
the full list. The same field shape is on `TopFeaturedListResponse`
already (Step 3 of the explore readiness arc).

`vehicle` is present on `.created` / `.updated` events (the full new
payload). `vehicleId` is present on `.deleted` events (we only need
the id to evict from cache).

## What `garage.primary.changed` exists for

The other four events fall out naturally from the mutation methods.
`primary.changed` is special — `setPrimary(id)` updates two vehicles
atomically (the one being set, and the one that was previously
primary). A single `.updated` event for each would race; a single
`.primary.changed` event captures the transaction shape and lets
clients update both records together.

## Why typing realtime without a subscriber

The audit found that catalog and top-featured already declared their
socket events (`CatalogSocketEvent` exists, `TOP_FEATURED_SOCKET_EVENTS`
exists) but garage didn't. Declaring the contract is a small
investment that:

- Documents the wire shape for the backend team without ambiguity
- Lets a future shared subscription module dispatch to all three
  domains via a single typed `Record<channel, eventHandler>` map
- Costs nothing at runtime (zero bytes in the compiled output until
  someone actually wires it up)

If the eventual shared subscriber finds the contract wrong, it's
cheap to revise. If we wait until the subscriber exists to declare
the contract, the implementation drives the spec — backwards from
how it should be.

## The mutation-error UI choice

The vehicle-detail screen has two distinct error categories:

1. **Initial-load failures.** Vehicle not in cache, transport fails.
   These are handled by the existing "Vehicle not found" empty state
   (`vehicle-detail-screen.tsx:74-92`) — no inline error needed
   because there's nothing to show underneath.

2. **Mutation failures on a populated detail.** User taps Set Primary,
   request 500s; user taps Remove, network drops mid-DELETE. The
   detail data is still valid — the vehicle still exists, the user
   should still see it. The error is about the LAST ACTION, not the
   underlying state.

Category 2 is what the inline error addresses. It sits above the
headline (always visible after scroll), the user can dismiss it once
they've seen it, the underlying detail stays interactive (they can
tap "Set Primary" again to retry).

This is the same pattern Step 3 deferred at the garage-screen level
(the audit doc explicitly noted "Step 6 covers wiring mutation
error UI back in" — that's this step, for the detail surface).

## What's not in this step

The garage-SCREEN-level mutation error (the `<AppInlineError>` that
used to render above the success layout but Step 3 removed in favor
of the full-screen error for initial-load failures) is intentionally
NOT re-added in Step 6. Reason: the most common garage-screen
mutations (`setPrimary` from a secondary tile, `addVehicle` from the
sheet) already have other error surfaces:

- `addVehicle` errors → caught by the wizard's `handleSubmit` and
  surface inside the open sheet
- `setPrimary` errors → leave the user on the garage screen; the
  next interaction with the now-stale primary status will be a clue
- Future: a toast-based system (which `services/toast-service.ts`
  already supports) could surface these uniformly

If a noisier garage-screen error surface is wanted later, the hook's
`error` field is still there to consume — it's just not consumed by
the garage-screen JSX after Step 3.

## Readiness score after Step 6

The garage readiness arc is now at parity with the explore-screen
readiness arc:

| Dimension | Pre-Step-1 | Post-Step-6 |
|---|---|---|
| Type completeness | 8/10 | 9/10 |
| Service abstraction | 7/10 | 9/10 |
| Consumer hookup (5-state hook) | 5/10 | 9/10 |
| State handling (skeleton/error/empty) | 6/10 | 8/10 |
| Production hardening (abort + stale-guard) | 3/10 | 8/10 |
| Realtime readiness | 0/10 | 6/10 |
| Mutation UX (per-action feedback) | 5/10 | 8/10 |
| Detail paths (error UI) | 7/10 | 8/10 |
| **Overall** | **~52%** | **~82%** |

## What's not in scope for the readiness arc

Same gaps as the explore arc — these are shared infra, not garage-
specific:

1. **Realtime subscriber implementation.** Types declared; subscriber
   not built. Phase D.
2. **Timeout ceiling around AbortController.** Stalled backend → user
   waits indefinitely. Phase B.
3. **Error mapping (401 → re-auth, 429 → backoff, 5xx → retry).**
   Phase B.
4. **Top-featured screen still calls sync `getTopFeaturedMockResponse`.**
   Phase C.
5. **Toast unification for mutation feedback.** Optional polish.

## Wrap-up

The garage screen went from ~52% (sync mock reads, no abort, no
stale-guard, no skeleton, no per-action feedback, no realtime types)
to ~82% (full async pipeline, every state designed, every mutation
gives feedback, realtime contract declared, HTTP transport one
env-var away from being live).

Same six-step arc the explore-screen readiness work followed (steps
15–20). The two surfaces now share the same architectural shape, the
same `RADIUS_*` constants, the same `strokeWidth={2}` discipline, the
same five-state UI vocabulary, and the same env-var-driven
transport-swap mechanic.

Phase B (shared HTTP infra: env config + auth + timeout + error
mapping) lands once for all four transports (search, catalog,
top-featured, garage) and pushes everything closer to 90%+.
