# Product row crashes when a compatibility response has no `badge`

**Owner:** compatibility / catalog code owner. Reported from `feature/chevrolet-vehicle-images` on 2026-11-10. **Not fixed in that branch** (out of scope).

## Symptom
The parts list (`/vehicle-parts`, `components/screens/vehicle-parts-screen.tsx`) shows the red error screen:

```
TypeError: Cannot read property 'color' of undefined
  ProductRow (components/screens-components/catalog/product-row.tsx:168)
```

## Cause
`product-row.tsx` reads `fit?.badge.color` (lines 168 and 170). The optional chain protects only `fit`, not `badge`. When `checkCompatibility()` (`services/compatibility-service.ts`) resolves to an object without `badge`, the row throws during render and takes down the whole list.

The type says `badge` is always present (`badge: { text: string; color: CompatibilityColor }`), but the response is not validated at the boundary. In this case the response came from the local Maestro mock: `POST /v1/catalog/parts/:id/check-compatibility` returned 200 without `badge`. A partial or older production response would do the same.

## Reproduction
1. Run the app against `.maestro/mock-server/standalone-server.mjs`, signed in, with an active Garage vehicle.
2. On the selected-vehicle card, tap "Найти запчасти" ("Find parts"). The list opens and calls `check-compatibility` for each row.
3. The first row whose response has no `badge` crashes the screen.

## Present on the release candidate base
The same code is in `f03e18a` (`git show f03e18a:components/screens-components/catalog/product-row.tsx`, lines 171/173). It was not introduced by the vehicle-image work.

## Suggested fix (for the owner to decide)
- Validate the response in `compatibility-service.ts`. Treat a result without a well-formed `badge` as `null`, which shows no fit badge. This matches the service's documented "unknown → no badge" behaviour.
- And/or guard the read in `product-row.tsx` with `fit?.badge?.color`.
- Add a test where `checkCompatibility` resolves `{ status: 'unknown' }` without `badge`, and the row renders with no badge.
