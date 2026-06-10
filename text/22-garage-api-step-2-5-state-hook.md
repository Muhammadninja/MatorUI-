# Step 2 — Five-state machine on `useGarage`

## What this step adds

A derived `state` field on the `useGarage()` return that maps the
underlying flag combo (`isLoading`, `error`, `vehicles.length`,
`hasLoadedOnce`) to a single `GarageState` discriminated union. Screens
read one variable and render one of five UI paths — same convention as
`useCatalogList`, `useTopFeaturedList`, and the search-results state.

Before this step the garage screen had to manually compose:

```ts
if (isLoading && vehicles.length === 0) {
  // show loading
} else if (error) {
  // show error
} else if (vehicles.length === 0) {
  // show empty
} else {
  // show success
}
```

Five conditions, three flag dependencies, and an ambiguity (what
happens if `error` AND `isLoading` are both true after a retry fires?).
After this step:

```ts
if (state === 'loading' || state === 'idle') return <Skeleton />;
if (state === 'error') return <Error />;
if (state === 'empty') return <EmptyState />;
return <Success />;
```

## Files changed

| File | Change |
|---|---|
| `hooks/use-garage.ts` | New `GarageState` type. `UseGarageState.state` field added to the return. Derivation logic with documented precedence rules (error > loading > idle > empty > success). Existing flags (`isLoading`, `isMutating`, `error`) retained for backward compatibility — `add-vehicle-screen` and `vehicle-detail-screen` keep working unchanged. |

## Precedence rules (and why)

The derivation order matters; mis-ordering produces wrong UI:

```ts
const state: GarageState = error
  ? 'error'
  : isLoading
  ? 'loading'
  : !garageService.hasLoadedOnce()
  ? 'idle'
  : vehicles.length === 0
  ? 'empty'
  : 'success';
```

- **`error` first.** Even mid-retry (`isLoading: true`, `error` still
  truthy until the retry resolves), the screen should stay in the
  error context — the retry button itself triggers the refresh; the
  loading skeleton would feel like the error "vanished" and confuse
  the user about which state they're in.

- **`isLoading` second.** Active in-flight read wins over "no data
  loaded yet" because `isLoading` is the strict superset — every
  fresh-mount fetch sets `isLoading: true`.

- **`!hasLoadedOnce()` third (idle).** This is the gap between mount
  and the effect firing the initial `refresh()`. One render frame,
  briefly. Screens treat it visually like `loading` (show skeleton)
  but the hook reports it honestly.

- **`vehicles.length === 0` fourth (empty).** Only after a successful
  load that returned zero items.

- **`success` last.** Default when data is present and no other state
  applies.

## Backward compatibility

The existing `isLoading` / `isMutating` / `error` flags are still on
the return type. Three screens consume them today:

- `garage-screen.tsx` reads `isLoading`, `error`, mutation methods
- `vehicle-detail-screen.tsx` reads `vehicles`, mutation methods
- `add-vehicle-screen.tsx` reads mutation methods

None break with this change — the new `state` field is additive. Step 3
will migrate `garage-screen.tsx` to read `state` instead, but the
detail and add screens can stay on the flag API as long as they want.

## Why not split into `useGarageList()` + `useGarageMutations()`

The catalogue and top-featured hooks are read-only — they only need the
list shape, so `useCatalogList()` returning `{ state, items, error,
refresh }` is clean. The garage hook is read + write — splitting would
mean every consumer that does both (which is most of them) imports two
hooks and threads two states. The combined hook is the right shape
here; the 5-state field just brings the read half up to parity.

## What's next

**Step 3** ships the skeleton:
`components/screens-components/garage/garage-skeleton.tsx` — a primary
card placeholder + two secondary tile placeholders matching the loaded
geometry. Then `garage-screen.tsx` swaps `AppLoadingState` for the
skeleton and migrates to read `state` instead of `isLoading`.

After Step 3 the garage's loading UX matches the catalogue and
top-featured patterns exactly — section-scoped skeleton, designed
error with retry, designed empty state.
