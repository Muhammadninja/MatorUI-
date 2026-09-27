# Fitment Studio — the backend work, end to end

> **For the backend developer.** Everything below targets the Mator API
> (`api.mator.uz`). The frontend is already built, deployed and waiting — it is
> the operator admin panel, a separate repo (`mator-admin`), not this mobile
> app. This copy lives here so it is easy to hand over; the original is
> `mator-admin/docs/fitment-studio-backend/BACKEND-TODO.md`, and the NestJS +
> Prisma starter referenced throughout sits beside it in that folder
> (`src/`, `prisma/`).

Single source of truth for taking the part-first Fitment Studio from "works on
sample data" to "works".

**Live now:** <https://mator.uz/mtr-ops-ffcb4e84/fitment> (operator login
required). The whole operator flow is built and deployed: a 300-part queue with
search and filters, a node selector, platform presets, keyboard-only operation,
optimistic binds, progress. It runs on a **local 300-row seed** and shows a
`Sample data — binds are not saved` banner, because the two endpoints in §2 and
§3 do not exist yet.

**When those two ship, nothing changes on the frontend.** The banner disappears
on its own the first time the queue request succeeds. There is no follow-up
client task.

---

## 1. Read this first — what you do NOT have to build

| Thing | Status |
|---|---|
| Schema for bindings | **Already correct.** `PartCompatibility(productId, vehicleModelId, nodeId)` with `@@unique` and `@@index([productId])`. A bind is the same row whether the operator arrived from a car or from a part. **No migration** for the binding itself. |
| The car-first module | Written and sitting in `src/` + `prisma/` here (controller, service, DTOs, schema fragment, seed). Merge it if you have not — §2/§3 extend it rather than replacing it. |
| `GET /v1/admin/fitment-studio/vehicles` | Already built, and **still used** — it fills the binder's model grid. Do not remove it. |
| `/nodes`, `/unmapped-parts`, `/bind`, `/unbind`, `/propagate-node` (car-first) | Built, and **no longer called by any screen.** Leave them; their client is kept so the car-first surface could return. Do not extend them for this work. |
| 3D node coordinates | **Dead.** `VehicleNode.positionX/Y/Z` and `position{x,y,z}` placed hotspots in a WebGL scene that was deleted (commit `6132393`). The columns are harmless — the seed fills them — but do not curate, extend or per-body-type them. Node rows are now just an FK target and a category enum. |

Conventions, same as `/v1/admin/orders`: envelope `{ success, data, meta? }`,
camelCase, errors `{ code, message }`, `ADMIN` role.

---

## 2. DECISION — what is "TOP-300"? (blocks §3)

The queue's default tab is `top300`. Nothing in the schema says which parts
those are.

| Option | Cost | Trade-off |
|---|---|---|
| **A. `Product.fitmentPriority Int?`** ← recommended | tiny migration + backfill | Explicit, sortable, a human can promote a part. |
| B. Derive from order lines | no migration, heavier query | "Top 300 by units sold". A new SKU you *want* digitized never enters the queue. |
| C. Category coverage quota | no migration, most logic | Best catalogue balance, most code. |

Recommendation: **A**, first backfill seeded from B.

Until this is decided, ship §3 with `filter=top300` behaving like `unmapped`.
The UI works; the prioritisation just does not mean anything yet.

---

## 3. `GET /v1/admin/fitment/parts-queue` — the conveyor

**Files:** `fitment-studio.controller.ts`, `fitment-studio.service.ts`, new
`dto/get-parts-queue-query.dto.ts`.
**Client:** `src/lib/fitment-queue-api.ts` → `fetchPartsQueue`.

Query: `limit` (default 300, max 500) · `filter` = `top300|unmapped|all` ·
`search?`

```jsonc
{
  "success": true,
  "data": [
    {
      "id": "cuid_xyz",
      "name": "Brake Pad Set, Front",
      "brand": "Sangsin",
      "sku": "SP1234",
      "oem": "GM 96484900",                    // or omit, send oemNumbers[]
      "oemNumbers": ["GM 96484900"],
      "tag": "OEM",                             // OEM | AFTER
      "category": "brakes",                     // catalogue slug
      "suggestedNodeCategory": "FRONT_BRAKES",  // optional but preferred
      "imageUrl": null,
      "mappedVehicleModelIds": [],              // non-empty ⇒ row renders "mapped"
      "nodeKey": null                           // node it was bound at, if mapped
    }
  ],
  "meta": { "total": 300 }
}
```

- [ ] `search` matches **name + brand + sku + oem**, case-insensitive. One `OR`,
      not four round trips.
- [ ] `filter=unmapped` → `compatibilities: { none: {} }`. **Not** scoped to a
      vehicle — part-first has no vehicle in scope, and that is the whole
      difference from the car-first `/unmapped-parts`.
- [ ] `filter=all` → no fitment predicate. `filter=top300` → §2.
- [ ] `mappedVehicleModelIds` must be **all** bindings for that product, as an
      array, not a count, not page-scoped. The binder pre-fills from it when an
      operator reopens a mapped part; with only a count, a mis-binding can never
      be corrected.
- [ ] Send `suggestedNodeCategory` when the category maps cleanly via
      `NODE_ALLOWED_CATEGORIES`. If you omit it the client falls back to its own
      slug table, and when the two disagree the operator gets a node
      pre-selected that §4's guard then rejects with a 400.
- [ ] **Stable ordering** across calls (e.g. `[priority asc, id asc]`). The
      operator navigates by arrow key and builds muscle memory on position; a
      queue that reshuffles between requests is worse than a slow one.
- [ ] `meta.total` drives the progress bar.
- [ ] No N+1: one `count` + one `findMany` with
      `select: { compatibilities: { select: { vehicleModelId: true } } }`.

```bash
# shape + total
curl -s "$API/v1/admin/fitment/parts-queue?limit=300&filter=unmapped" -H "$AUTH" | jq '.data|length, .meta.total'
# a mapped part carries its bindings as an ARRAY
curl -s "$API/v1/admin/fitment/parts-queue?filter=all&search=SP1234" -H "$AUTH" | jq '.data[0].mappedVehicleModelIds'
# same first 10 ids on two consecutive calls
```

---

## 4. `POST /v1/admin/fitment/bind` — one part, many vehicles

**Files:** controller + service, new `dto/bind-part-fitment.dto.ts`.
**Client:** `src/lib/fitment-queue-api.ts` → `bindPartFitment`.

```jsonc
// request
{ "partId": "cuid_xyz",
  "vehicleModelIds": ["cobalt_id", "gentra_id"],
  "nodeKey": "FRONT_BRAKES" }          // NodeCategory enum

// response
{ "success": true,
  "data": { "boundCount": 2, "oemNumbers": ["GM 96484900"] } }
```

- [ ] Validate `vehicleModelIds`: non-empty, UUIDs, deduped.
- [ ] **REPLACE, not append.** One transaction: delete this product's rows at
      this `nodeId` that are not in `vehicleModelIds`, then
      `createMany({ skipDuplicates: true })`. Without the delete a mis-click is
      permanent from this screen — there is deliberately no per-model unbind in
      the part-first UI.
- [ ] Bulk in ONE call. Do not make the client loop; a part that fits a platform
      (Cobalt + Gentra) is one request, and that is the point of the flip.
- [ ] Category guard (`NODE_ALLOWED_CATEGORIES`): an `oils` product on
      `FRONT_BRAKES` is a `400` with a readable message. The client toasts it
      and rolls the optimistic row back.
- [ ] Echo `oemNumbers` so the operator can confirm the cross-reference without
      leaving the queue.
- [ ] Idempotent — same call twice, same rows, same `boundCount`.
- [ ] All-or-nothing. Partial success is not modelled client-side; a failure
      must change zero rows or the rollback lies.

```bash
# bind 2, then re-bind 1 → the dropped model's row is GONE
curl -s -X POST "$API/v1/admin/fitment/bind" -H "$AUTH" -d '{"partId":"P","vehicleModelIds":["A","B"],"nodeKey":"FRONT_BRAKES"}'
curl -s -X POST "$API/v1/admin/fitment/bind" -H "$AUTH" -d '{"partId":"P","vehicleModelIds":["A"],"nodeKey":"FRONT_BRAKES"}'
# → the queue row for P now shows mappedVehicleModelIds == ["A"]
# guard
curl -s -X POST … -d '{"partId":"<oils product>","vehicleModelIds":["A"],"nodeKey":"FRONT_BRAKES"}'   # 400
```

---

## 5. Auth

- [ ] Both routes behind the same `ADMIN` guard as `/v1/admin/orders`. The admin
      proxy already sends an operator token (account `+998502030318`, role
      `ADMIN`).
- [ ] **403 for a non-admin token, not 404.** The client treats 404/network as
      "not deployed" and silently falls back to the seed; it treats 403 as an
      error worth showing. Returning the wrong one hides a permissions problem
      behind fake data.

## 6. Data chores

- [ ] `VehicleNode`: 7 rows, one per `NodeCategory` — `prisma/seed.fitment.ts`
      does this. `bind` resolves `nodeKey → VehicleNode.id`; without the seed
      every bind 500s.
- [ ] `VehicleModelRef` populated — its ids are what the model chips send. If
      `GET /vehicles` returns empty the grid shows its empty state and nothing
      can be bound.
- [ ] Backfill `fitmentPriority` if you chose §2 option A.

---

## Definition of done

1. `filter=unmapped` returns real products; binding one removes it from that tab
   on the next fetch.
2. Reopening a mapped part shows its existing models pre-selected.
3. Removing a model and re-binding actually deletes the row.
4. A category mismatch returns 400 and the operator sees why.
5. The `Sample data — binds are not saved` banner is gone (client-side, automatic).
6. 300 rows answer fast enough that arrow-key navigation stays smooth.

## Deliberately not modelled — decide when the operator asks

- **Unbind from the queue.** A correction today is a re-bind with a smaller set.
- **Undo a batch.** One wrong preset is 5 bad bindings; recovery is by hand.
- **Audit trail.** Orders have `statusHistory`; fitment has nothing — no record
  of who bound what.
- **Year / trim qualifiers.** Bindings are model-level; engine trims are
  collapsed to one chip in the UI.
- **Left/right, axle position.** A part that differs per corner binds to one node.
- **Conflict warnings.** Two SKUs of one category on the same (model, node) is
  usually a data error worth surfacing.
