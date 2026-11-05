# Mator — Backend API Contract

**Source of truth:** this document is derived from the frontend transport/service code
(`services/*`, `contexts/*`, `hooks/*`, `config/api.ts`) as of the current build. It
describes **exactly what the app sends and expects back**. Where the code and the older
handoff docs (`mocks/*.txt`) disagree, **this document wins** — it reflects shipping code.

> ⚠️ **Read the "Conventions & gotchas" and "New endpoints needed" sections first** —
> several things drifted from the original spec (tax rate, price-as-string, path-root
> asymmetry, response wrappers, and a handful of screens with no backend at all).
>
> **Recent arch changes** (this revision): Catalog moved to **`/v1/catalog/parts`** with new
> **region / GM / price-sort** filter params (§5); a new external **VIN Decode** integration
> (NHTSA, §15) now powers the **VIN-only** garage Add-Vehicle flow (§13).

---

## 1. Environment & transport switching

Every domain ships a **mock** implementation and an **HTTP** implementation, selected at
module load by `config/api.ts`:

- `EXPO_PUBLIC_API_BASE_URL` — when set, transports switch to HTTP. Trailing slash is
  stripped; endpoint paths below are appended verbatim (`${base}${path}`). Unset/empty →
  every domain stays on mocks.
- `EXPO_PUBLIC_HTTP_DOMAINS` — optional comma-separated allowlist of domain keys
  (`catalog, search, top-featured, cart, orders, garage, …`). When set, **only** those
  domains use HTTP; everything else stays mock. Lets the backend bring endpoints online
  one at a time. Unset → base URL enables HTTP for all domains.

### Auth

- `Authorization: Bearer <accessToken>` is injected by `apiClient` from the in-memory
  session (`services/auth-storage`, hydrated from `expo-secure-store`, envelope `auth:v1`).
- Public endpoints (catalog/search/featured) still work for guests — the header is simply
  omitted when there's no token.
- Auth calls (`sign-in/up/refresh`) use `skipAuth` (no token). `sign-out` **does** send the
  header.
- On any **401**, `apiClient` fires a single coalesced refresh; on refresh failure the user
  is signed out.

### HTTP client (`services/api-client.ts`)

- Headers: `Accept: application/json`; `Content-Type: application/json` only when a body is
  present.
- 15s timeout (AbortController); GET/HEAD retry with exponential backoff on 5xx + network
  errors.
- Errors thrown as `ApiError { status, code, message, response }` (reads body `code` /
  `message` / `error`). `204` → `undefined`; non-JSON body tolerated.

---

## 2. Conventions & gotchas (backend must honor these exactly)

1. **Prices are display strings, not numbers.** `price: "UZS 11,008,400"` / `"$486.00"`
   everywhere the UI renders. Numeric fields exist in a few places (`price_uzs`,
   `SearchResult.priceCents`) but the rendered rows use the string. The cart parses the
   string (`/[^0-9.]/g` stripped) to compute subtotal — keep line prices parseable.
2. **Query-param casing & strictness:**
   - Catalog list + parts + Top Featured all hit **`/v1/catalog/parts`** with `page_size`
     (snake_case). The old `/v1/catalog/items?pageSize` endpoint is **retired**.
   - Search: camelCase JSON body.
   - **The parts endpoint strictly rejects unknown query params with `400`** — the filter
     param names in §5 (`region`, `gm_only`, `sort`, …) must match the backend exactly, or
     be added there before the app flips `catalog` to HTTP.
3. **Response wrapper inconsistency:** cart item endpoints return `{ item: CartItem }`
   (wrapped); garage returns `{ vehicle }` / `{ vehicles }`; orders/addresses/payments
   return the **bare** object/array. Match each exactly.
4. **List vs mutation path roots differ** for account resources:
   - Read: `GET /v1/account/addresses`, `GET /v1/account/payment-methods`.
   - Write: `POST/PATCH/DELETE /v1/addresses/…`, `/v1/payment-methods/…`.
5. **Tax = `0.085` (8.5%)** in code (`services/cart-math.ts`) — **not** the 6% in the old
   handoff. Applied to `subtotal − discount`, never to shipping. (Confirm which is correct.)
6. **Server owns pricing on order create** — the client sends only
   `{ productId, quantity }` selections + a `totalLabel` display hint it may ignore.
7. **Realtime/WebSocket channels are typed but not consumed** (catalog, top-featured,
   garage). No live subscription today.

---

## 3. Auth — `services/auth-api.ts`

```ts
type UserSummary = {
  id: string; firstName: string; lastName: string; email: string; username: string;
  phone?: string | null; avatarUrl?: string | null; memberSince: string; // ISO
};
type RawAuthResponse = {
  accessToken: string; refreshToken: string; expiresIn?: number /* seconds */; user: UserSummary;
};
```

Auth is **passwordless OTP** (phone default, or email). Both sign-in and sign-up are
a two-call flow: request a code, then verify it.

| Method & path | Request | Response |
|---|---|---|
| `POST /v1/auth/otp/request` | `{ channel: 'phone'\|'email', identifier, purpose: 'sign-in'\|'sign-up', firstName?, lastName? }` | `{ otpToken, expiresIn /* s */, devCode? }` |
| `POST /v1/auth/otp/verify` | `{ otpToken, code /* 6 digits */ }` | `RawAuthResponse` (invalid/expired code → `422`) |
| `POST /v1/auth/refresh` | `{ refreshToken }` | `RawAuthResponse` (401/400 → client signs out) |
| `POST /v1/auth/sign-out` | `{ refreshToken }` (auth header sent) | `204` (best-effort) |

- `identifier` is an E.164 phone (`+998…`) or an email address; `channel` says which.
- Sign-up captures `firstName`/`lastName` on the **request** call so `verify` can create the profile.
- `devCode` is a **dev/demo-only** convenience (the code, so mock/E2E builds auto-fill it). A real
  backend MUST NOT return it — the client then requires the user to type the code.
- Client converts `expiresIn` → `expiresAt = now + expiresIn` (unix seconds).

---

## 4. User / Profile — `services/user-api.ts`

| Method & path | Request | Response |
|---|---|---|
| `GET /v1/me` | — | `UserSummary` (fetched on cold-boot; failure → guest) |
| `PATCH /v1/me` | `Partial<Omit<UserSummary,'id'\|'memberSince'>>` | full updated `UserSummary` (optimistic in UI) |

Editable: `firstName, lastName, email, username, phone, avatarUrl`.

---

## 5. Catalog — `services/catalog-service.ts` (domain key `catalog`)

Drives the **Category** and **Search** product rows and **Item Detail**.

```ts
type CatalogItem = {
  id: string;
  badge?: string;            // corner ribbon ("Hot pick","New")
  status: string;            // "Ready to ship","Low stock",…
  title: string;
  description: string;
  price: string;             // DISPLAY string, e.g. "UZS 11,008,400"
  priceLabel: string;        // "Starting at"
  images: string[];          // URLs; mock is []
  specs: { label: string; value: string }[];
  features: string[];
  category: string;          // slug: "sedan"|"suv"|"coupe"|"truck"
  oem?: string;
  region?: 'china'|'europe'|'russia'|'korea'|'usa';  // market of origin (region filter)
};
```

### `GET /v1/catalog/parts` — list  (⚠ moved off `/v1/catalog/items`; snake_case, strict params)

The Catalog list + Category + **Parts** screens now hit **`/v1/catalog/parts`** (the same
endpoint Top Featured uses), NOT the old `/v1/catalog/items`. Param names are the single
source of truth in `PARTS_PARAM` (`services/catalog-service.ts`). **Unknown params → 400**,
so every name below must match exactly.

| App field | Query param | Notes |
|---|---|---|
| `page` | `page` | required |
| `pageSize` | `page_size` | required |
| `search` | `q` | free text |
| `category` | `category` | system / category key |
| `make` | `make` | from the Make → Model flow |
| `model` | `model` | |
| `brand` | `brand` | |
| `regions[]` | `region` | **repeated** — `region=china&region=korea`; keys `china\|europe\|russia\|korea\|usa` |
| `gmOnly` | `gm_only` | `"true"` when the GM-only filter is on (Chevrolet / Ravon / Daewoo …) |
| `sortBy` | `sort` | `price_asc\|price_desc` (the price-range slider was **removed** — sort only) |

- Response: `ApiCatalogPartsResponse` (see §7) mapped → `CatalogItem`. The mapper derives
  `region` from the part's `region` field, else infers it from the brand, so the region
  facet works even before the backend tags origin.
- **Filter split:** `category / make / model / region / gm_only` go **server-side** (the
  transport sends them; the server filters). `brand / sort / search / in-stock / OEM` are
  refined **client-side** over the fetched page. `catalogListQueryKey` now includes
  `make, model, brand, regions, gmOnly` so distinct filter combinations cache independently.

### `GET /v1/catalog/parts/:id` — detail

- Response: bare `ApiCatalogPart` → mapped to `{ item: CatalogItem }`. **404 → not-found.**
- Detail screen consumes `specs, features, priceLabel, images, oem`.

### Vehicle bestsellers — "Shop parts that fit" (already supported ✅)

The garage active-vehicle hero's **"Shop parts that fit"** button opens
`vehicle-parts-screen.tsx`, which lists the top parts that fit the active car via:

```
GET /v1/catalog/parts?make=<make>&model=<model>&sort=bestseller&page=1&page_size=24
```

**No backend change is required** — the parts endpoint already implements this:
- `sort=bestseller` is an accepted value (`ListPartsQueryDto`) and is ranked by
  `isBestseller → salesCount → reviewCount → ratingAvg → createdAt`
  (`PartsService.buildOrderBy`). The composite degrades gracefully before
  `isBestseller`/`salesCount` are populated (falls through to rating/newest).
- `make` / `model` filter to that vehicle's fitment **and** include universal
  parts (`makeWhere` / `modelWhere`).
- Response is the standard `ApiCatalogPartsResponse` → `mapPartToCatalogItem`,
  so no new client mapper.

Client sends `sortBy: 'bestseller'` (mapped to `sort`). The mock server
(`.maestro/mock-server/standalone-server.mjs`) mirrors this — `make`/`model` (or
`sort=bestseller`) returns the fit list ranked by `units_sold`.

---

## 6. Search — `services/search-service.ts` (domain key `search`)

Powers the smart-search surface (typeahead, filter sheet, did-you-mean). Note: the Mator
`/search` **screen** currently renders catalog rows via `useCatalogList`, so `SearchResult`
below feeds the richer search UI, not the basic product rows.

### `POST /v1/search`

Request body (`SearchRequest` minus `signal`; `requestId` → `X-Request-Id` header):

```ts
{ query: string; limit?: number; pageToken?: string;
  filters?: { categories: string[]; price: 'any'|'under_1k'|'1k_to_10k'|'over_10k';
              minRating: 'any'|'3_plus'|'4_plus' };
  sortBy?: 'relevance'|'price_asc'|'price_desc'|'rating'|'newest';
  vehicleContext?: { brand; model; vehicle_generation?; engine_type?; oem_catalog_scope? };
  // defined but never sent: locale, userId, abVariant
}
```

Response (`SearchResponse`):

```ts
{ query; requestId; results: SearchResult[]; total; nextPageToken?; didYouMean?;
  suggestedRefinements?; facetCounts?: { categories?; price?; minRating? };
  appliedFilters?; suggestedCategories?: string[]; durationMs }

type SearchResult = {
  id; title; description; price /* display */; priceLabel; priceCents?; category;
  badge?; accentTagKind?: 'lowest_price'|'bestseller'; status?; rating?; reviewCount?;
  score; explanation?;
};
```

- **Mock-only:** `rating/reviewCount/accentTagKind` hash-derived; `didYouMean` a 4-entry
  map; default page size 2. `isCheapest` is derived client-side, **not** a server field.

### `GET /v1/typeahead?q&limit`  (limit default 6)

Response: `{ prefix; suggestions: { text; kind: 'query'|'product'; productId? }[] }`.

---

## 7. Top Featured — `services/top-featured-service.ts` (domain key `top-featured`)

> ⚠️ **Intended endpoint `POST /v1/top-featured/list` is NOT live.** Its snapshot is empty
> on the backend, so the HTTP transport **temporarily sources from `GET /v1/catalog/parts`**
> and maps parts → featured items. Treat the featured-snapshot contract as aspirational.

### `GET /v1/catalog/parts?page&page_size[&search]`  (snake_case!)

Real backend response consumed today:

```ts
type ApiCatalogPartsResponse = {
  items: ApiCatalogPart[]; total; page; page_size; next_page: number | null;
};
type ApiCatalogPart = {
  id; title;
  brand?: { id; name } | null;
  category?: { id; name } | null;
  oem_numbers?: string[];
  price_uzs?: number;
  price_label?: string;
  in_stock?: boolean;
  stock_qty?: number;
  images?: string[];
};
```

Mapped to `TopFeaturedItem { id, badge, status, title, description, price, model, brand,
color, condition, images?, oem? }` where `status ← in_stock ? 'In stock' : 'Out of stock'`,
`description ← brand.name · category.name`, `price ← price_label ?? "UZS <price_uzs>"`,
`oem ← oem_numbers[0]`. **`badge, model, color, condition` are empty** (no backing).
`filters.brand` is applied **client-side** by name; other filter dims are mock-only.

---

## 8. Cart — `services/cart-api.ts` + `contexts/cart.context.tsx` (domain key `cart`)

```ts
type CartItem = {
  id; title; description; price /* display */; priceLabel?; badge?; status?;
  imageUrl?; quantity: number;
};
type AddItemInput = { productId; title; description; price; priceLabel?; badge?; status?; imageUrl? };
```

| Method & path | Request | Response | Notes |
|---|---|---|---|
| `GET /v1/cart` | — | `{ items: CartItem[]; appliedPromoCode: string\|null }` | offline-first: overwrites local cache only when `items.length>0` |
| `POST /v1/cart/items` | `AddItemInput` | **`{ item: CartItem }`** | created-or-incremented; add is optimistic (qty+1 local) |
| `PATCH /v1/cart/items/:itemId` | `{ quantity }` | `{ item: CartItem }` | qty≤0 → client calls DELETE instead |
| `DELETE /v1/cart/items/:itemId` | — | `204` | |
| `POST /v1/cart/clear` | — | `204` | |
| `POST /v1/cart/promo` | `{ code }` | `PromoResult` (below) | validated client-side first; server call is fire-and-confirm |
| `DELETE /v1/cart/promo` | — | `204` | |

The UI's add path sends `addItem({ id, title, description, price, imageUrl })`
(`id → productId`); `priceLabel/badge/status` usually undefined. Add happens only **after
the guest auth gate passes**.

```ts
type PromoResult =
  | { ok: true; promo: PromoCode }
  | { ok: false; reason: 'invalid'|'min_subtotal'; minSubtotal?: number };
type PromoCode = { code; label; kind: 'percent'|'fixed'|'free_shipping'; value: number; maxDiscount?: number };
```

> Promo codes live **client-side** (`WELCOME10` 10%, `RIDE25` 25% cap $200, `FREESHIP`).
> The server's rules must mirror this table exactly or the two diverge.

### Cart math (client; backend must mirror) — `services/cart-math.ts`

- `TAX_RATE = 0.085`, `FLAT_SHIPPING = 49`, `FREE_SHIPPING_THRESHOLD = 500`, `PROMO_MIN_SUBTOTAL = 100`.
- `shipping = subtotal>0 ? (subtotal>=500 ? 0 : 49) : 0`
- promo `percent → min(subtotal*value, maxDiscount?)`; `fixed → min(subtotal, value)`; `free_shipping → shipping=0`
- `taxedBase = max(0, subtotal − discount)`; **`tax = taxedBase * 0.085`**; `total = taxedBase + shipping + tax`
- `subtotal = Σ parsePrice(price) * quantity`.

---

## 9. Checkout / Orders — `services/orders-service.ts` (domain key `orders`)

```ts
type CreateOrderInput = {
  items: { productId; quantity }[];   // selections only — NO prices
  addressId; paymentMethodId; shippingOptionKey; promoCode: string|null;
  note?; totalLabel?;                  // totalLabel = optimistic display hint
};
type CreateOrderResult = { orderId; eta; totalLabel };
```

| Method & path | Request | Response |
|---|---|---|
| `POST /v1/orders` | `CreateOrderInput` | `CreateOrderResult` (server re-validates pricing; empty items → error) |
| `GET /v1/orders?page&pageSize&status` | query (all optional) | `OrderListPage` |
| `GET /v1/orders/:orderId` | — | `OrderDetail` (404 → not-found) |

```ts
type OrderListRow = { id; date; status: 'Processing'|'In Transit'|'Out for delivery'|'Delivered'|'Cancelled';
                      items: number; total /* "$486.00" */; summary /* "Garrett GTX3582R + 2 items" */ };
type OrderListPage = { items: OrderListRow[]; total; page; pageSize };

type OrderDetail = {
  id; status: 'placed'|'packed'|'shipped'|'out_for_delivery'|'delivered'|'cancelled';
  statusLabel; etaWindow; placedAt;
  steps: { key; label; caption /* "Tue · 9:42 AM" */ }[];
  currentStepIndex; destination: Address; courier: Courier|null;
  items: { id; title; quantity; price; imageUrl? }[]; totalLabel;
};
type Courier = { name; company; vehicle; rating; phone?; chatThreadId?; avatarUrl? };
```

Server owns step timestamps, locale/formatting, and `currentStepIndex`.

---

## 10. Addresses — reads `/v1/account/addresses`, writes `/v1/addresses`

```ts
type Address = { id; label; line1; city /* "Brooklyn, NY 11211" */; name?; isDefault? };
type AddressInput = { label; name; line1; city };
```

| Method & path | Request | Response |
|---|---|---|
| `GET /v1/account/addresses` | — | `Address[]` |
| `POST /v1/addresses` | `AddressInput` | `Address` (first created → default) |
| `PATCH /v1/addresses/:id` | `AddressInput` | updated `Address` |
| `DELETE /v1/addresses/:id` | — | `204` (deleting default promotes another) |
| `POST /v1/addresses/:id/default` | — | `204` (single default enforced server-side) |

---

## 11. Payment methods — reads `/v1/account/payment-methods`, writes `/v1/payment-methods`

```ts
type PaymentMethod = { id; brand; last4; exp /* "MM/YY" */; isDefault };
type PaymentMethodInput = { brand; last4; exp };
```

Same CRUD shape as addresses (`GET /v1/account/payment-methods`, `POST/PATCH/DELETE
/v1/payment-methods/:id`, `POST /v1/payment-methods/:id/default`).
> **Security:** the form collects only `brand/last4/exp` — never a PAN. A real integration
> should replace this with a tokenized handle from a PCI vault; **no tokenization field
> exists yet.**

---

## 12. Shipping — `POST /v1/shipping/quote`

```ts
type ShippingQuoteRequest = { addressId; subtotal /* dollars */ };
type ShippingOption = { key /* "standard"|"express"|"same_day" */; label; eta; price /* 0 = free */ };
```

Request `{ addressId, subtotal }` → `ShippingOption[]`. The chosen `key` is sent as
`CreateOrderInput.shippingOptionKey`. `subtotal` lets the server flip free-shipping
thresholds (client won't guess). Mock returns standard/$0 · express/$9.99 · same_day/$19.99,
forcing standard→free at subtotal ≥ 500.

---

## 13. Garage / Vehicles — `services/garage-api.ts` (domain key `garage`)

Base `/v1/garage`. **Wire DTO is snake_case with nested `make/model/trim/engine`; responses
are envelope-wrapped.** Client flattens to `Vehicle` and derives `color`, `addedAt`, ids.

```ts
type ServerVehicle = {
  id; user_id?; is_primary: boolean; nickname?: string|null;
  make: { id; name; logo_url?: string|null }; model: { id; name }; year: number;
  trim?: { id; name }|null;
  engine?: { id; name; displacement_cc?; fuel_type? }|null;
  transmission?; drivetrain?; color_hex?; vin?; license_plate?;
  registration_region_code?; mileage_km?; fuel_type?;
  model_3d?: { glb_url; ktx2_textures_url; version; byte_size; checksum_sha256; tuning_variants? }|null;
  created_at; updated_at?;
};
// enums: transmission manual|automatic|cvt|dct|amt · drivetrain fwd|rwd|awd|4wd
//        fuel petrol|diesel|hybrid|phev|ev|cng|lpg
```

| Method & path | Request | Response |
|---|---|---|
| `GET /v1/garage/vehicles` | — | `{ vehicles: ServerVehicle[] }` |
| `GET /v1/garage/vehicles/:id` | — | `{ vehicle }` (404 → null) |
| `POST /v1/garage/vehicles` | `ServerVehicleCreatePayload` (`make_id, model_id, year, color_hex` req; `trim_id, engine_id, vin, license_plate, mileage_km, nickname, is_primary, fuel_type` opt) | `{ vehicle }` (then full list refresh) |
| `PATCH /v1/garage/vehicles/:id` | `Partial<CreatePayload>` (changed keys only) | `{ vehicle }` |
| `DELETE /v1/garage/vehicles/:id` | — | 2xx (list refetched) |
| `POST /v1/garage/vehicles/:id/set-primary` | — | `{ vehicles }` (full re-ordered list) |

Realtime `GarageSocketEvent` on `garage:vehicles` is typed but **not subscribed** yet.

> **Add-Vehicle is now VIN-only.** The garage Add-Vehicle screen no longer takes manual
> Make / Model / Year. The user scans or types a 17-char VIN, the app decodes it via the
> **VIN Decode** integration (§15), and the resolved `make / model / year` populate the
> `POST /v1/garage/vehicles` payload. Offline or an unresolvable VIN ⇒ cannot add (no manual
> fallback today).

---

## 14. AI Chat — `services/chat-api.ts`

Base `/v1/chatbot`. Streaming uses raw `fetch` SSE (`Accept: text/event-stream`) with a
manual bearer header.

| Method & path | Request | Response |
|---|---|---|
| `GET /v1/chatbot/conversations` | — | `AiChatConversationSummary[]` |
| `GET /v1/chatbot/conversations/:id` | — | `AiChatConversationSummary` (404 → null) |
| `DELETE /v1/chatbot/conversations/:id` | — | `204` |
| `POST /v1/chatbot/messages` | `{ conversationId?; message; vehicleContext? }` | **SSE** stream of `ChatStreamEvent` |
| `POST /v1/chatbot/messages/:id/feedback` | `{ kind: 'up'\|'down'; note? }` | `204` |

```ts
type ChatStreamEvent =
  | { type: 'token'; value }
  | { type: 'tool_call_start'; toolCall }
  | { type: 'tool_call_update'; toolCallId; status: 'pending'|'running'|'success'|'error';
      result?: { summary?; deepLink?: { label; href }; payload? }; errorMessage? }
  | { type: 'done'; conversationId; suggestions: string[]; replyId; title; createdAt };
// tool names: lookup_order|search_parts|add_to_cart|apply_promo|check_fitment|identify_part|<string>
```

---

## 15. VIN Decode — external provider (NHTSA vPIC) — `services/vin-decoder-service.ts`

**Not a Mator endpoint** — a decoupled, provider-agnostic client the app calls directly to
turn a 17-char VIN into a clean vehicle record. Used by the garage Add-Vehicle screen (§13)
to auto-fill make / model / year. Provider is swappable via `VinDecodeTransport`.

- **UZ-market first (default engine, `UzMarketVinDecodeTransport`):** VINs are checked
  against `services/uz-vin-catalog.ts` before any network call.
  - **UzAuto (WMI `XWB`):** decoded from an evidence-backed pattern table (exact VDS,
    positions 4–8; each row cites its source). The model year is position 10, with the
    ISO 3779 cycle chosen by the model's year window.
  - **A UzAuto VIN outside the table**, or with an ambiguous year, fails as
    `UNSUPPORTED_VIN`. NHTSA does not carry `XWB`, so there is no fallback for it.
  - **The synthetic `XUF` demo scheme** is kept for QA.
- **Fallback provider (everything else):**
  `GET https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json`
  (public, keyless, global). `Results[0]` fields consumed: `Make, Model, ModelYear,
  DisplacementL, FuelTypePrimary, ErrorCode`. A record with neither make nor model
  (vPIC's answer for an unregistered manufacturer) is `NOT_FOUND`, not a decode.
- **Validation before any network call** (reuses `utils/vin`): trim/uppercase, exactly 17
  chars, ISO 3779 alphabet (no I/O/Q). The position-9 check digit is validated but only
  **enforced** when `requireChecksum` is on (default **off** — UZ-market Chevrolets ship
  non-North-American check digits).
- **Output contract:**
  ```ts
  interface DecodedVehicle {
    make: string; model: string; year: number;
    engineDisplacement: string | null; fuelType: string | null;
    isVerified: boolean;   // ErrorCode "0" AND make+model+year all resolved
    vin: string;           // normalized 17-char
  }
  ```
- **Typed errors** `VinDecodeError { code }`: `INVALID_LENGTH | INVALID_CHARACTERS |
  CHECKSUM_FAILED | NOT_FOUND | UNSUPPORTED_VIN | PROVIDER_ERROR | NETWORK_ERROR | TIMEOUT`. 10s timeout
  (AbortController). `decodeSafe()` returns `{ ok, data|error }` (never throws);
  `decodeMany(vins, concurrency=5)` for bulk catalog seeding.
- **Entry points:** `VinDecoderService.decode(vin)` (static facade over a shared singleton),
  `.decodeSafe`, `.decodeMany`, `.configure({ transport })`, and the `vinDecoder` singleton.

> **Backend consideration:** decoding depends on a **third party** (NHTSA) reachable from the
> device — no Mator server involvement today. For server-side/offline decode, caching,
> rate-limit shielding, or a UZ-specific VIN database, stand up a **`GET /v1/vin/{vin}`**
> proxy and point `VinDecodeTransport` at it (one-line `VinDecoderService.configure` swap).

---

## 16. Static / local-only (⚠ NO backend today) — NEW ENDPOINTS NEEDED

These power live screens but have **no transport** — they're hardcoded constants or device
storage. Each needs a backend endpoint to become real.

| # | Data | Where | Shape | Endpoint needed |
|---|---|---|---|---|
| 1 | **MATOR Certified dealers** | `mocks/mator-catalog.ts` `MATOR_DEALERS` (4), Explore "MATOR Certified" row | `{ id; name; initial; color; orders: string; years: number }` | **`GET /v1/dealers`** — certified storefronts |
| 2 | **Shop-by-category tiles + live counts** | `MATOR_CAT_TILES` (12), Explore grid | `{ name; count: number; color }` | **`GET /v1/categories`** with real per-category `count` |
| 3 | **Brand/make taxonomy + logos** | `services/uz-vehicle-catalog.ts` (`UZ_BRANDS`/`UZ_MODELS`/…), `assets/brands/*` | brands/models/generations/trims/engines; `logoUrl`/`make.logo_url` | **brand-catalog endpoint** (add/update brands, models, **logos**) |
| 4 | **Favorites / likes** | `services/likes-storage.ts` — AsyncStorage `likes:v1` only | `Set<productId>` | **favorites API** (per-user list/add/remove) for cross-device sync |
| 5 | **Top Featured snapshot** | `POST /v1/top-featured/list` intended but empty | `TopFeaturedListResponse` + WS `top_featured:catalog` | populate the real snapshot endpoint (today it falls back to `/v1/catalog/parts`) |
| 6 | **Realtime channels** | catalog `catalog:items`, top-featured `top_featured:catalog`, garage `garage:vehicles` | typed events | WS/subscription backing (types exist, nothing subscribes yet) |

Also mock seed only (demo screens, not contract): `MATOR_PRODUCTS`, `MATOR_ADDRESSES`,
`MATOR_CARDS`, `MATOR_SEED_CART`, `MATOR_VEHICLES`.

---

## 17. Backend action-item summary

1. **Confirm tax rate** — code uses **8.5%** (`0.085`); old handoff said 6%.
2. **Catalog is now `/v1/catalog/parts`** (snake_case `page_size`); retire `/v1/catalog/items`.
   **Honor the filter params** in §5 exactly — `region` (repeated), `gm_only`, `sort`
   (`price_asc|price_desc`), `make/model/brand/category/q` — and don't `400` on them, since
   the endpoint strictly rejects unknown params.
3. **Match response wrappers** — `{ item }` (cart), `{ vehicle(s) }` (garage), bare (orders/addresses/payments).
4. **Match path roots** — account **reads** at `/v1/account/*`, **writes** at `/v1/addresses` & `/v1/payment-methods`.
5. **Server owns pricing** on `POST /v1/orders`; re-validate, ignore client `totalLabel`.
6. **Mirror the promo table** (`WELCOME10/RIDE25/FREESHIP`) or the client will diverge.
7. **Stand up the 6 missing endpoints/systems** in §16 (dealers, categories+counts, brand catalog+logos, favorites, top-featured snapshot, realtime).
8. **Payments:** add a tokenization field; today it sends raw `brand/last4/exp`.
9. **(Optional) VIN proxy** — Add-Vehicle depends on the external NHTSA decoder (§15). If we
   want server-side/offline decode, caching, or a UZ VIN DB, expose **`GET /v1/vin/{vin}`**
   and repoint `VinDecodeTransport`.

---

## Delivery destination, address search and the map

The buyer chooses where the courier goes: any point in the delivery area, wherever they are
themselves. `lat`/`lng` on a saved address are that point, and with them an address needs no
words at all. Delivery is priced by the backend and shown as a price alone.

| Call | Purpose |
|---|---|
| `GET /v1/shipping/coverage` | `{ configured, bounds, geometry }`. `bounds` says where the map opens. `geometry` is the MultiPolygon the backend enforces, so the map can refuse a point outside it at once; the backend still decides. |
| `GET /v1/addresses/suggestions?street=&house=&city=&lang=&mode=&near_lat=&near_lng=` | `{ items, attribution }`. Debounced `autocomplete` while typing, `search` when submitted. Only what was typed and the rough map centre are sent. |
| `GET /v1/addresses/reverse?lat=&lng=&lang=` | `{ address, within_coverage, attribution }`. Once per confirmed point, never while the map moves. Never fails for lack of an address. |
| `POST` / `PATCH /v1/addresses` | `lat`, `lng`, `landmark` as well as the existing fields. `full_text` may be left out with a point. |
| `POST /v1/shipping/quote` | With `delivery_method: 'courier'`: `{ options: [{ type, label, price_uzs, quote_id }], currency }`. |
| `POST /v1/orders` | `confirmed_delivery_uzs` and `delivery_quote_id` from that answer. `409 DELIVERY_QUOTE_STALE` when the pin, a pickup point or the rates have changed; `409 DELIVERY_PRICE_CHANGED` when the price has. Fetch a new quote and confirm again. |

Other refusals, with `code`: `422 COURIER_DELIVERY_UNAVAILABLE` (no area configured; pickup
works), `422 DELIVERY_OUTSIDE_COVERAGE`, `400 DELIVERY_ADDRESS_COORDINATES_INVALID`,
`503 ADDRESS_SEARCH_UNAVAILABLE` (the map still works).

**The map.** `AppMap` over `react-native-maps`: Apple Maps on iOS, which needs no key; Google
Maps on Android, which needs `GOOGLE_MAPS_ANDROID_API_KEY` set at build time (EAS environment
variable). That key is baked into the build, so it is public: restrict it in Google Cloud to
the package `com.mator.myapp` and the app's signing certificate, with a quota. A build without
it offers address search in place of the Android map, since the native map would crash. The
app holds no UzMaps key: it uses no UzMaps tiles, and UzMaps cannot restrict a key to a native
app. Search and reverse geocoding go through the backend.
