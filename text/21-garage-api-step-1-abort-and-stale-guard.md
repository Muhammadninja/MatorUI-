# Step 1 — `AbortSignal` threading + stale-response guard

## What this step adds

The foundation for the garage API readiness arc. Three layers all get
the same operational discipline that the search-results and
explore-screen audits already established:

- **Transport interface** — every method accepts `signal?: AbortSignal`
- **Mock transport** — honors abort via a delay helper that listens for
  the signal mid-flight
- **HTTP stub** — threads signal to `fetch()` in every endpoint
- **Service layer** — monotonic `refreshSeq` drops stale responses that
  resolve after a newer request has started
- **Consumer hook** — `AbortController` per read; aborts on unmount and
  on every fresh `refresh()` so older fetches don't fight newer ones

Before this step the garage transport had `MOCK_LATENCY_MS = 0` (so
loading state was never visible) and no cancellation anywhere. A slow
`refresh()` that resolved after a fast `setPrimary()` would overwrite
the fresh cache with the stale snapshot, silently undoing the user's
action.

## Files changed

| File | Change |
|---|---|
| `services/garage-api.ts` | `GarageTransport` interface methods all take `signal?: AbortSignal`. `MOCK_LATENCY_MS = 0` → `250` so loading state is visible. New `delay(ms, signal)` helper mirroring the catalog/top-featured implementations. Mock transport methods all thread the signal through. HTTP stub's `request<T>()` and every endpoint thread signal too. |
| `services/garage-service.ts` | New private `refreshSeq` counter. `refresh()` increments seq on issuance, checks it post-await — late arrivals throw `AbortError('Stale refresh superseded')`. `addVehicle` / `updateVehicle` / `removeVehicle` / `setPrimary` all accept and forward the signal. |
| `hooks/use-garage.ts` | New `readAbortRef: AbortController` for the in-flight READ. Aborted on unmount and on every fresh `refresh()` call. New `isAbortError()` helper. `refresh()` and `runMutation()` swallow AbortError silently — they're not user-facing failures. |

## The two distinct guards (and why both are needed)

There's a real distinction between **abort** (cancel the in-flight
request) and **stale-guard** (drop a response that arrives after a
newer one started). Each protects a different failure mode:

| Failure mode | Without abort | Without stale-guard |
|---|---|---|
| User unmounts the garage tab mid-fetch | `setState` on unmounted component (memory leak / React warning) | n/a |
| User taps "Refresh" twice quickly, slow → fast | Both requests run; both call `setState`; final state non-deterministic | Slow response can overwrite the fast one's fresh cache |
| Concurrent `setPrimary` + `refresh` race | Both run; whoever lands last wins | Slow `refresh` can revert a successful `setPrimary` |

The hook handles abort (cleanup, dedup). The service handles stale-
guard (cache integrity, shared across all subscribers). They compose.

## Why mutations get a signal but aren't aborted by the hook

The transport contract documents this in a comment block: mutations
ACCEPT a signal so the caller CAN cancel a slow upload mid-flight, but
the service layer never aborts mutations on its own. Reason: by the
time `create`/`update`/`remove` is in flight, the server may have
already committed the write. Aborting locally would mask that — the UI
would say "nothing happened" but the next refresh would show the
change. Silent state divergence is worse than a slow spinner.

Reads (`refresh`, `get`) are safely abortable — the only cost is a
wasted network round-trip; no state is committed server-side.

## Why mutations' internal refresh IS abortable

Inside `addVehicle()` etc., the service calls `refresh()` after the
write completes to resync the canonical list. If the user unmounts
during that internal refresh, aborting it is fine — the next mount's
first refresh fixes the cache. The mutation result (the created
vehicle) was already returned to the caller before the internal
refresh started.

So the contract is:

- **External read** (`refresh()` called by hook) — abortable
- **External mutation** (`addVehicle()` called by hook) — NOT abortable
- **Internal read** (`refresh()` called inside `addVehicle()`) — inherits
  the mutation's signal, so propagates abort downstream

## The stale-guard implementation detail

```ts
async refresh(signal?: AbortSignal): Promise<Vehicle[]> {
  const seq = ++this.refreshSeq;
  const fresh = await this.transport.list(signal);
  if (seq !== this.refreshSeq) {
    throw new DOMException('Stale refresh superseded', 'AbortError');
  }
  this.vehicles = fresh;
  this.hasLoaded = true;
  this.emit();
  return fresh;
}
```

Note: we throw `AbortError`, not a generic Error or a silent return.
Reason: callers ALREADY have an AbortError handler (because they're
threading signals). Re-using the same error name means the hook's
existing abort-suppression logic catches this case for free — no new
catch branch needed at every callsite.

## `MOCK_LATENCY_MS = 250`

The previous `0` made the loading state untestable in dev — `refresh()`
resolved synchronously and the hook never flipped `isLoading` true long
enough to render the loading UI. `250ms` is short enough that dev
isn't sluggish but long enough to verify the loading path renders.
This matches the catalog (`350`) and top-featured (`320`) latencies
established in the explore-screen readiness arc.

## What's next

**Step 2** introduces the **5-state machine** to the hook
(`idle | loading | success | empty | error`). Today the hook still
returns `isLoading + isMutating + error` as three separate flags — the
garage screen has to manually compose `isLoading && vehicles.length === 0`
to know it's in an empty-loading state. After Step 2 the screen reads
one `state` and renders one of five UI paths, matching the convention
the catalogue + top-featured + search-results audits all share.

**Step 3** ships `garage-skeleton.tsx` — a section-scoped shimmer
mirroring the loaded layout (primary card + secondary tile placeholders)
so the loading state stops being a generic spinner label.
