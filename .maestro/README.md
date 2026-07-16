# Mator — Maestro E2E Suite (offline / fully mocked)

Production-ready [Maestro](https://docs.maestro.dev) flows for the three Stage-1→3
"AutoZone" journeys, driven entirely against a local mock server so the suite runs
**offline, deterministic, and independent of the in-development backend**.

```
.maestro/
├─ config.yaml                     # workspace config + execution order + env
├─ flows/
│  ├─ flow-01-vin-lookup.yaml       # VIN decode → fitment bar
│  ├─ flow-02-systems-grid.yaml     # 8 systems → tap Brakes → parts directory
│  ├─ flow-03-parts-filter.yaml     # 2 mocked parts → brand filter → reactive list
│  ├─ flow-04-item-detail.yaml      # parts row → Item Detail (mocked catalog detail)
│  ├─ flow-05-add-to-cart-gate.yaml # guest Add-to-cart → auth gate → sign in → Cart
│  ├─ flow-06-checkout.yaml         # Cart → Checkout → Place order → Order Confirmation
│  ├─ flow-07-track-order.yaml      # place order → Track Order timeline
│  ├─ flow-08-cart-ops.yaml         # qty inc/dec + remove → empty cart
│  ├─ flow-09-search.yaml           # Explore search → results → Item Detail
│  └─ flow-10-order-history.yaml    # deep-link Order History → seeded list
├─ subflows/
│  ├─ launch-clean.yaml             # clearState + launch wired to the mock
│  ├─ seed-active-vehicle.yaml      # reusable "active vehicle = Cobalt" precondition
│  ├─ open-item-detail.yaml         # brakes directory → open the Brembo part detail
│  ├─ sign-in-submit.yaml           # submit the gated sign-in (demo creds pre-filled)
│  ├─ add-item-authenticated.yaml   # full guest→gate→sign-in→resume→Cart journey
│  └─ complete-checkout.yaml        # Cart → Checkout → Place order → Confirmation
└─ mock-server/
   ├─ rules.js                      # Maestro Mock Server rules
   └─ standalone-server.mjs         # zero-dep Node fallback (CI/device-reliable)
```

---

## 1. Prerequisites

```bash
curl -Ls "https://get.maestro.mobile.dev" | bash   # install Maestro CLI
maestro --version                                  # verify
```

A running **iOS Simulator** or **Android emulator** with the app installed
(`com.fotih12.mator`). Build a dev client or release build as usual (`eas build`
/ `expo run:ios` / `expo run:android`).

---

## 2. Wiring the app to the mock server  ⚠️ READ — this is the whole game

`config/api.ts`'s `getApiBaseUrl()` reads `EXPO_PUBLIC_API_BASE_URL`; when it
points at the mock, every transport (and the VIN Finder's
`POST /v1/auth/decode-vin`) hits the mock instead of the real backend.

Two hard-won facts this suite depends on (verified live on an Expo **dev build**):

1. **`EXPO_PUBLIC_*` is inlined from `.env` FILES, not the shell.**
   `EXPO_PUBLIC_API_BASE_URL=… npx expo run:ios` does **not** change what
   `getApiBaseUrl()` returns — the shell var only fills the unused `process.env`
   object; the *inlined literal* comes from the `.env` files, where `.env.local`
   (the real backend) wins. The only reliable override is a higher-precedence
   env file. **This repo ships `.env.development.local`** (gitignored via
   `.env*.local`, highest precedence in Expo dev) setting
   `EXPO_PUBLIC_API_BASE_URL=http://localhost:8080`. That file is what makes the
   suite hit the mock. **Delete it (or repoint it) for normal dev against the
   real backend.**

2. **Metro caches the inlined transform; the dev client caches the bundle.** After
   changing an env file: `npx expo start -c` (clears Metro's cache), and force a
   fresh bundle download — a plain reload keeps the stale one. Cleanest guarantee
   is a reinstall: `xcrun simctl uninstall booted com.fotih12.mator` then install.

### The setup that works (dev build)

```bash
# .env.development.local already has EXPO_PUBLIC_API_BASE_URL=http://localhost:8080
npx expo start -c                                   # terminal 1 — keep running
# reinstall the app once so the dev client can't serve a stale bundle:
xcrun simctl uninstall booted com.fotih12.mator
xcrun simctl install  booted "$(find ~/Library/Developer/Xcode/DerivedData -name Mator.app -path '*Debug-iphonesimulator*' | head -1)"
npm run test:e2e                                    # terminal 2 — boots mock, runs 3 flows
```

Verified green: `3/3 Flows Passed`.

Physical device: put your machine's LAN IP in `.env.development.local`
(e.g. `http://192.168.1.20:8080`).

### Release / preview build (recommended for CI — no cache pain, no launcher)

The base URL is baked at build time, so none of the dev-client caching applies:
```bash
EXPO_PUBLIC_API_BASE_URL=http://localhost:8080 eas build --profile preview --local
# install the build, then:  npm run test:e2e
```

### Alt mock backend — Maestro Mock Server (`rules.js`)

Serves the identical contract for Maestro Cloud / the built-in proxy:
`maestro mock-server .maestro/mock-server/rules.js --port 8080`.

---

## 3. The mocked contract

| Flow | Method & path | Mocked response (abridged) |
|------|---------------|----------------------------|
| 1 | `POST /v1/auth/decode-vin` | `{ success: true, car: { make:"CHEVROLET", model:"Cobalt", year:2022 } }` (422 on non-17-char VIN) |
| 3 | `GET /v1/catalog/parts?systemId=brakes` | `{ items: [Brembo Front Brake Pads, Bosch Brake Rotor], total: 2 }` |
| 2 | *(none)* | The 8-system grid is **local config** (`constants/catalog-systems.ts`) — no network needed |
| 4 | `GET /v1/catalog/parts/:id` | single `ApiCatalogPart` (Item Detail); unknown id → **404** → "Product not found" |
| 5 | `POST /v1/auth/otp/request` → `POST /v1/auth/otp/verify` | passwordless sign-in: request returns `{ otpToken, expiresIn, devCode:"123456" }` (client auto-fills the code); verify accepts any 6-digit code → `RawAuthResponse` (422 on a bad code) |
| 5–6 | `GET /v1/account/addresses` · `GET /v1/account/payment-methods` | seeded `Address[]` (2) · `PaymentMethod[]` (2) — **arrays**, ported from `orders-api.ts` |
| 6 | `POST /v1/shipping/quote` | `ShippingOption[]` (3; standard free ≥ $500) |
| 6–7 | `POST /v1/orders` → `GET /v1/orders/:id` | mints `{orderId,eta,totalLabel}`, seeds a detail row so the confirmation + **track-order** `useOrder(id)` resolve (**stateful within a run**) |
| 9 | `GET /v1/catalog/parts?q=<term>` | title/brand substring search across all parts (`q=brake` → 2 hits) |
| 10 | `GET /v1/orders` | 5 seeded orders (`OrderListPage`, ported from `orders-api.ts` `SEED_ORDERS`) |

> **Param-name note:** the spec pins `?systemId=brakes`; the live transport
> (`services/catalog-service.ts`) sends `?category=brakes`. Both mock
> implementations match either key, so the flow is correct regardless of build.

> **Why the mock now serves cart/orders too:** the verified dev build routes
> **every** domain over HTTP (`EXPO_PUBLIC_API_BASE_URL` set, no
> `EXPO_PUBLIC_HTTP_DOMAINS` filter), so checkout hits the mock's
> `/v1/account/*` + `/v1/orders` — not the in-memory `MockOrdersTransport`. The
> catch-all returns an *object* `{items:[]}`, but the orders hooks need *arrays*
> (`payments.items.findIndex`), so those endpoints are served explicitly with
> the real shapes. Cart runs on the client's optimistic state within a session,
> so `/v1/cart` needs no stateful mock for the buy-path flows.

---

## 4. Instrumentation Contract (already wired — this is the map)

Every `testID` these flows use is now present in the app. Table below is the
authoritative selector → component map, so a future refactor knows what the
suite depends on. Each was a ~1-line addition; none changed rendered UI.

| `testID` (flow) | Component | Note |
|-----------------|-----------|------|
| `vin-finder-screen`, `vin-input-field`, `vin-submit-button`, `browse-systems-btn` | **`app/vin-finder.tsx`** (new screen) | minimal real VIN Finder; POSTs `/v1/auth/decode-vin`, then hands off to the catalog |
| `vehicle-fitment-bar`, `fitment-status-indicator` | `app/vin-finder.tsx` (decode banner) **and** `components/screens-components/catalog/vehicle-context-bar.tsx` | both the VIN-result banner and the persistent catalog bar expose these ids |
| `systems-grid` | `components/screens/catalog-systems-screen.tsx` (`FlashList`) | |
| `system-item-<id>` (×8) | `components/screens-components/catalog/master-system-row.tsx` | ids: brakes/maintenance/suspension/electrical/engine/transmission/climate/tuning |
| `parts-directory-screen` | `components/screens/catalog-parts-screen.tsx` (root) | |
| `part-card-<id>` | `components/screens-components/catalog/product-row.tsx` | id from the catalog item id (`part-card-brembo-fp`, …) |
| `floating-filter-btn` | `catalog-parts-screen.tsx` sticky "Filter & Sort" pressable | |
| `filter-sheet`, `filter-brand-<Brand>`, `filter-apply-btn`, `filter-clear-btn` | `components/screens-components/catalog/catalog-filter-sheet.tsx` | brand is a tappable **chip** (`filter-brand-Brembo`), not a text field |
| `part-card-<id>` (buy path) | `product-row.tsx` | on the **image open-pressable** (not the outer row `AppView`) so a Maestro centre-tap lands on `onOpen`, not the dead-zone between pressables |
| `item-detail-screen`, `add-to-cart-btn` | `item-detail-screen.tsx` | success-branch root + sticky Add-to-cart |
| `sign-in-screen`, `auth-send-code-btn`, `auth-verify-btn` | `mator-sign-in-screen.tsx` → `passwordless-auth-screen.tsx` | passwordless OTP; phone pre-filled + code auto-filled from `devCode`, so the flow taps send → verify (no typing). Also: `sign-up-screen`, `auth-channel-phone/-email`, `auth-phone-field`, `auth-email-field`, `auth-otp-field` |
| `cart-screen`, `cart-checkout-btn` | `cart-screen.tsx` | id on both the populated + empty roots |
| `checkout-screen`, `checkout-place-order-btn` | `checkout-screen.tsx` | success-branch root + sticky Place order |
| `order-confirmation-screen`, `confirmation-track-btn` | `order-confirmation-screen.tsx` | success-branch root + "Track order" |
| `track-order-screen` | `track-order-screen.tsx` | outer root (wraps loading/error/success) |
| `cart-item-<id>`, `cart-qty-<id>-inc/-dec`, `cart-remove-<id>` | `cart-screen.tsx` + `app-qty-stepper.tsx` | stepper exposes `${testID}-inc/-dec` via a new optional `testID` prop |
| `explore-search-entry` | `explore-screen.tsx` | sticky-header search pill → `/search` |
| `search-screen`, `search-input` | `mator-search-screen.tsx` | root + the query `TextInput` |
| `order-history-screen` | `order-history-screen.tsx` | outer root; order cards are buttons whose `accessibilityLabel` collapses child text, so assert ids as `.*ORD-xxxx.*` (substring) |

### Navigation model
The flows reach the VIN Finder via the **top-level deep link `mator://vin-finder`**
(reliable — it's a root stack route registered in `app/_layout.tsx`), then use the
in-app **"Browse systems"** button to enter the vehicle-scoped catalog. This avoids
deep-linking into nested tab routes (which is fragile) — see
`subflows/seed-active-vehicle.yaml`.

### Fitment-bar copy
`app/vin-finder.tsx` renders the exact spec string **`🟢 Fitting parts for: 2022
CHEVROLET Cobalt`** in a single `testID="vehicle-fitment-bar"` text node. Flow 1
still asserts a regex substring (emoji-agnostic) **plus** the
`fitment-status-indicator` id rather than the literal glyph — robust to
copy/translation churn (per the output requirement), while the literal is what
actually renders.

### Parts payload shape
The mock returns the backend's `ApiCatalogPart` shape (nested `brand`/`category`,
`oem_numbers`, `price_label`, `in_stock`, `page_size`) — the exact fields
`HttpCatalogTransport.mapPartToCatalogItem()` reads. `brand.name` is what becomes
the filter chip Flow 3 taps, so it must be present.

---

## 5. Selector policy

Every assertion targets a **`testID`** so the suite survives copy and EN/RU
translation changes. Human-readable text is asserted only where the spec pins
exact strings (system RU label, fitment value, brand names) — and even then as
**regex substrings**, never brittle full-string equality.
