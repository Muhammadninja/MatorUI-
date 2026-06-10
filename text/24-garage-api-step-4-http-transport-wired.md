# Step 4 — `HttpGarageTransport` wired at runtime + shared config module

## What this step adds

The real HTTP transport is now constructed automatically when the
`EXPO_PUBLIC_API_BASE_URL` env var is set. No code change to flip
between mock and HTTP — just an env-var toggle at build time.

Previously `HttpGarageTransport` was commented out in `garage-api.ts`
and `garage-service.ts` hardcoded `new MockGarageTransport()`. Even
with the perfect HTTP stub, swapping required a manual code edit per
deploy.

This is the first piece of **shared infrastructure** that benefits
every transport in the app — the same `config/api.ts` module will
front the catalog, top-featured, and search transports when they're
upgraded to the same pattern.

## Files changed

| File | Change |
|---|---|
| `config/api.ts` | **New.** Three exports: `getApiBaseUrl()`, `shouldUseHttpTransport()`, `getAuthToken()`. Reads from `process.env.EXPO_PUBLIC_API_BASE_URL`; strips trailing slash. Auth getter is a stub returning `null` today, swap-ready for when real auth lands. |
| `services/garage-api.ts` | `HttpGarageTransport` class uncommented and exported. All methods thread the `AbortSignal`. The auth header is omitted when `getAuthToken()` returns `null`. 404 responses on `get()` translate to `null` (the only mapped HTTP status; everything else throws). |
| `services/garage-service.ts` | New `createGarageTransport()` selector — returns `HttpGarageTransport` when `getApiBaseUrl()` is set, falls back to `MockGarageTransport`. Singleton constructs via the selector instead of the bare mock. |

## The flip-the-env-var contract

To run against a real backend:

```bash
# .env (or wherever your env loader picks up)
EXPO_PUBLIC_API_BASE_URL=https://api.mator.app
```

That's it. The next app launch:

1. `getApiBaseUrl()` returns `'https://api.mator.app'`
2. `createGarageTransport()` constructs `new HttpGarageTransport(baseUrl, getAuthToken)`
3. Every `garageService` call now hits the real backend
4. Stale-guard, abort signal, error handling, retry — all already in
   place from Steps 1–3

To run against the mock:

```bash
# .env
# EXPO_PUBLIC_API_BASE_URL=   (leave empty or unset)
```

Mock transport is constructed; nothing else changes.

## Why `process.env.EXPO_PUBLIC_*`

Expo statically inlines any env var prefixed with `EXPO_PUBLIC_` into
the production bundle. Non-prefixed env vars resolve to `undefined`
in client code. The `EXPO_PUBLIC_API_BASE_URL` name is the standard
Expo convention; using it means existing tooling (Expo CLI,
EAS Build secrets, the EAS dashboard) all recognize it without extra
config.

## Why the auth getter returns `null` today

Real auth isn't wired (the user context has a TODO comment about
this). Returning `null` cleanly means:

- HTTP transport omits the `Authorization` header
- Public endpoints work (catalog, top-featured)
- Auth-required endpoints (garage) will 401, and the error message
  surfaces in the hook's `error` state

When auth lands, swap `getAuthToken()`'s body to read from the auth
context — single-file change, no transport-side rework. The contract
is already in place.

## Why a transport selector function, not a runtime switch UI

The selector is called once at module load. The choice is fixed for
the app session. This matches how every transport in the codebase will
work — env-var-driven, not user-toggleable. If a dev wants to A/B
between mock and HTTP, they can call `garageService.setTransport(new
MockGarageTransport())` from a debug screen; the `setTransport()`
escape hatch is already on the service.

## What still needs to happen on the backend side

The HTTP transport encodes a specific contract that the backend must
match:

| Method | Endpoint | Body | Response |
|---|---|---|---|
| list | `GET /garage/vehicles` | — | `{ vehicles: Vehicle[] }` |
| get | `GET /garage/vehicles/:id` | — | `{ vehicle: Vehicle }` or 404 |
| create | `POST /garage/vehicles` | `VehicleInput` JSON | `{ vehicle: Vehicle }` |
| update | `PATCH /garage/vehicles/:id` | `VehiclePatch` JSON | `{ vehicle: Vehicle }` |
| remove | `DELETE /garage/vehicles/:id` | — | 204 |
| setPrimary | `POST /garage/vehicles/:id/set-primary` | — | `{ vehicles: Vehicle[] }` |

Auth: `Authorization: Bearer <token>` when a token is present.
Errors: any non-2xx returns a text body that becomes the
`Garage API ${status}: ${body}` message in the hook.

The wire shape matches the `Vehicle` / `VehicleInput` / `VehiclePatch`
types in `services/garage-service.ts` byte-for-byte.

## What's next

**Step 5** wires the `saving` state in `AddVehicleWizard`. Today the
state is declared but never set by `handleSubmit` — the submit button
stays enabled while the create mutation is in flight, opening the
door to double-submit. After Step 5 the button disables and shows a
spinner during the mutation, and double-submission is impossible.

**Step 6** closes the realtime gap — declares `GarageSocketEvent` /
`GARAGE_SOCKET_CHANNEL` types (matching what catalog and top-featured
already have) and adds an error+retry UI to `vehicle-detail-screen`
for delete failures.
