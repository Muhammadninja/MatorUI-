# Backend contract — MATOR Certified (admin → app)

Ties the operator panel's dealer **Certify / Lowest-Price** toggles to what the
**customer app** shows. The two surfaces never talk to each other — they share
the backend DB: the admin **writes** the flag, the app **reads** it. This doc is
the read side; the write side is the admin panel's `docs/BACKEND_TASK_DEALERS.md`.

## The link

`POST /v1/admin/dealers/:id/certify { certified }` sets `certified` on the dealer
(a seller). For the app to reflect it, the backend must surface that flag on the
**customer-facing** endpoints. Nothing else on the app side is needed — the app
already maps and renders it (see "App side, already done").

---

## Required: `certified` (+ `lowestPrice`) on the customer-facing seller

Add both booleans to the `seller` object wherever a part/product is returned to
the app. **Snake_case** (the app's customer endpoints are snake_case):

### 1. `GET /v1/catalog/parts` — list items

```jsonc
{
  "items": [
    {
      "id": "part_…",
      "title": "…",
      "price_uzs": 185000,
      "in_stock": true,
      "seller": {
        "id": "d1",
        "name": "AutoPro Parts",
        "rating_avg": 4.8,
        "certified": true,       // ← NEW — MATOR Certified
        "lowest_price": true     // ← NEW — Lowest-price guarantee
      }
    }
  ],
  "total": 1
}
```

### 2. `GET /v1/catalog/parts/:id` — product detail
Same `seller` object with the two new booleans.

### 3. `POST /v1/search` — search results
Each result's seller (or the result itself) must carry `certified` / `lowest_price`
so the badge shows in search too. If search results don't currently embed a
`seller`, add `certified: boolean` / `lowest_price: boolean` at the result level.

**Semantics:** `certified` / `lowest_price` reflect the dealer's *current* admin
flags at query time (resolve from the seller record — don't snapshot per part).
Omit or `false` = no badge. That's it.

---

## Optional: the Explore "MATOR Certified" row — `GET /v1/placements`

The app already has a full transport for this row (`services/placements-service.ts`),
currently on a bundled mock because the endpoint is 404/undeployed and `placements`
isn't in prod `EXPO_PUBLIC_HTTP_DOMAINS`. To light it up with real certified
dealers/categories:

```jsonc
GET /v1/placements → {
  "items": [
    {
      "id": "pl_1",
      "title": "Certified Batteries",
      "subtitle": "MATOR verified sellers",
      "badges": ["certified"],
      "visual": { "monogram": "B", "color": "#2A6FDB", "image_url": null },
      "target": { "kind": "dealer", "id": "d1", "label": "AutoPro Parts" },
      "sponsor": { "name": "AutoPro", "sponsored": false }
    }
  ]
}
```

`target.kind` ∈ `catalogue | category | dealer | search | url` (a certified dealer
uses `{ kind: "dealer", id, label }`; a certified category uses
`{ kind: "catalogue", certified: "oem"|"gm", label }`). Then add `placements` to
prod `EXPO_PUBLIC_HTTP_DOMAINS` — a one-line flag flip, no app code change.

---

## App side — already done (no further work once the fields arrive)

- `CatalogItem` carries `certified` / `lowestPrice` / `sellerName`
  (`services/catalog-service.ts`), mapped from `seller.certified` / `seller.lowest_price`.
- `ProductRow` renders a blue **"MATOR Certified"** badge when `certified` is true;
  hidden otherwise (`components/screens-components/catalog/product-row.tsx`).
- The Explore certified row + `GET /v1/placements` mapper already exist
  (`services/placements-service.ts`).

**Verify:** once the backend returns `seller.certified: true` for a certified
dealer's parts, the badge appears on that part's row with zero app changes. To
also show a per-product **Lowest price** badge or a **"Certified only"** search
filter, ping me — those are small follow-ups on the same field.
```
