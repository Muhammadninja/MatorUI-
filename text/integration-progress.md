# Backend Integration Progress

_Last updated: 2026-07-17_

Live backend: **`https://api.mator.uz`** (Swagger at `/docs`)
HTTP is gated per-domain via `EXPO_PUBLIC_HTTP_DOMAINS` in `.env` — a domain
uses the real backend only when its key is in that list; otherwise it runs on a
mock. Currently enabled (guest-safe): **`top-featured, categories, catalog, search`**.

---

## Status legend

| Badge | Meaning |
|-------|---------|
| ✅ **LIVE** | Verified against the live backend **and enabled** — working in the app now |
| 🟢 **READY** | App code complete & verified (runtime or against the OpenAPI spec) — only needs the domain flag flipped (waiting on auth) |
| 🟡 **SCAFFOLDED** | App code complete, but the live response shape is **unverified** — needs one real payload to confirm field names |
| 🟠 **UNVERIFIED** | A transport exists but was **not checked** against this backend yet |
| 🔴 **BLOCKED** | Blocked by a backend bug or an endpoint mismatch |

---

## Screen readiness

| # | Screen | Domain(s) | Key endpoint(s) | Status | Enabled? | Blocker / Next step |
|---|--------|-----------|-----------------|--------|----------|---------------------|
| 1 | **Home / Explore** (category grid) | `categories` | `GET /v1/categories` | ✅ LIVE | ✅ | — done |
| 2 | **Category listing** | `catalog` | `GET /v1/catalog/parts?category=` | ✅ LIVE | ✅ | — done |
| 3 | **Item detail** | `catalog` | `GET /v1/catalog/parts/{id}` | ✅ LIVE | ✅ | — done (specs synthesized) |
| 4 | **Search** (+ typeahead, quick-filters) | `search` | `POST /v1/search`, `GET /v1/typeahead`, `GET /v1/search/quick-filters` | ✅ LIVE | ✅ | — done |
| 5 | **Top-Featured** grid | `top-featured` | `GET /v1/catalog/parts` | ✅ LIVE | ✅ | — done |
| 6 | **Shop-by-car** (catalog parts) | `catalog` | `GET /v1/catalog/parts` | ✅ LIVE | ✅ | — done |
| 7 | **Cart** | `cart` | `GET/POST /v1/cart`, `/items`, `/promo`, `/clear` | 🟢 READY (verified) | ❌ | ✅ **Full lifecycle re-verified live with an OTP token (2026-07-17):** GET (empty) → POST `{part_id,qty}` → PATCH `{qty}` (12→36 UZS) → promo → DELETE line → clear — all pass; response `{items, promo, subtotal_uzs, total_uzs}` matches. Screen fully wired; works offline for guests. **Just enable `cart`+`auth`** to activate in-app |
| 8 | **Garage** | `garage` | `GET/POST/PATCH/DELETE /v1/garage/vehicles…` | 🟢 READY (verified) | ❌ | ✅ **Verified live with OTP token (2026-07-17)** — full CRUD works. **Fixed real transport bugs:** create/get/update return the vehicle **DIRECTLY** (app wrongly read `{vehicle}`); set-primary returns **one** vehicle so we now **re-fetch the list**. `color_hex` must be `#RRGGBB` (app already sends valid). UI de-mocked (empty state, car placeholder, 30% image). ⚠️ **CONTRACT GAP — add-vehicle:** backend validates `make_id`/`model_id` against a **seeded catalog** and **only Chevrolet is seeded** (`chevrolet/cobalt\|malibu\|nexia` → 201; `kia`,`hyundai`,`byd`,`chery`… → 400 "Unknown or mismatched"). App offers 9 brands → most would 400. **Backend must seed all makes/models OR expose `GET /v1/garage/makes`+`/models`.** Needs **auth** to enable |
| 9 | ~~**Notification settings**~~ | — | — | ⬜ REMOVED | — | **Removed from the app** per product decision (2026-07-17): screen, route, hook, and preferences transport deleted. (`GET/PATCH /v1/notifications/preferences` still exists on the backend if ever needed again.) |
| 10 | **Notifications feed** | `notifications` | `GET /v1/notifications`, `/{id}/read`, `/read-all`, `/test` (seeder) | 🟢 READY (verified) | ❌ | ✅ **Verified live with OTP token + seeded row (2026-07-17):** shape `{items, next_cursor, unread_count}`, item `{id, type, title, body, read, created_at}` — mapper matches (type→tone, read→unread). mark-read + read-all confirmed (unread 2→1→0). `POST /v1/notifications/test` exists as a dev seeder. **Just enable `notifications`+`auth`** to activate in-app |
| 11 | **Orders / Checkout** | `orders` | `POST/GET /v1/orders`, `/v1/shipping/quote`, `/v1/account/*`, `/v1/payments/*` | 🔴 BLOCKED | ❌ | **App model ≠ backend model — needs product decision + rework, not just wiring:** (a) **No address writes** — backend only has `GET /v1/account/addresses`; app's add/edit/delete addresses (`POST/PATCH/DELETE /v1/addresses`) **don't exist** (404). (b) **No saved cards** — backend has no payment-method CRUD; payment is via **Click/Payme gateway invoices** (`POST /v1/payments/click/invoices` + `/payme/invoices`), a totally different flow than the app's saved-card UI. (c) **Create-order body differs** — backend wants `CreateOrderDto {cart_snapshot, vehicle_id, contact_phone_e164}`; app sends its own shape. (d) **Shipping-quote body differs** — backend wants `{delivery_address_id, region_code, destination}`; app sends `{addressId, subtotal}`. Plus **auth**. |
| 12 | **Profile** | `user` | `GET/PATCH /v1/me` | 🟢 READY (verified) | ❌ | ✅ **Verified live with an OTP token (2026-07-17):** `GET /v1/me` maps correctly (mapper now prefers new `first_name`/`last_name` fields); `PATCH /v1/me {first_name,last_name}` persists. Screen fully de-mocked — real profile + real stat counts, **mock `TEST_USER` removed** (mock now returns empty, never a fake identity). **Just enable `user`+`auth`** to activate in-app |
| 12a | **Liked** (favorites) | `catalog` (+ local likes) | `GET /v1/catalog/parts/{id}` | 🟢 READY (verified) | ✅ (catalog) | ✅ Replaces "Recently viewed". Like **state** is **local** (`LikesContext` → AsyncStorage; no backend favorites endpoint exists). Liked **product data is hydrated live** from the catalog (`useLikedProducts` → `GET /v1/catalog/parts/{id}` per liked id, drops deleted ones). Real `ProductRow` cards + empty state. Works now (catalog is live). ⚠️ **No cross-device sync** — needs a backend favorites endpoint (see backend to-do #6) |
| 13 | **Avatar** | `avatar` | app POSTs `/v1/me/avatar` | 🔴 BLOCKED | ❌ | ⚠️ **Verified live (2026-07-17): `POST /v1/me/avatar` returns 404 — no upload endpoint exists.** Backend has **no file/media upload** at all; it only accepts an avatar **URL** via `PATCH /v1/me {avatar_url}` (verified 200, persists). App does a multipart **file** upload → nowhere to send it. **Fix:** either (a) backend adds a file-upload endpoint returning a URL, or (b) app uploads directly to **Cloudinary** (product images already use it) then `PATCH /v1/me {avatar_url}` — needs a Cloudinary cloud-name + unsigned preset |
| 14 | **Auth / Sign-up + Sign-in** | `auth` | `POST /v1/auth/phone/request-otp`, `/verify-otp`, `/token/refresh` | 🟢 READY | ❌ | **Backend FIXED & verified end-to-end (2026-07-17):** request-otp → verify-otp creates the user + returns tokens; `is_existing_user` distinguishes sign-up vs sign-in; `dev_otp_code` returned in dev. App transport + UI + context already match. Auth is now **passwordless phone-OTP only** (email register/login endpoints removed). **Just enable the `auth` domain.** ⚠️ This unblocks all authed screens (7–13) |
| 15 | **AI Assistant** (chat) | `chat` | app calls `/v1/chatbot…` | 🔴 BLOCKED | ❌ | **Endpoint mismatch**: backend exposes `/v1/ai/sessions…`, not `/v1/chatbot`. Needs remap + verify |

---

## Overall readiness

- **Browse / shopping-discovery path (screens 1–6): ✅ 100% live.**
- **Commerce + account path (cart, garage, orders, notifications, profile): code-ready, ~0% live** — all gated behind the same blocker.
- **Critical path 🟢 UNBLOCKED (2026-07-17):** the auth 500s are **fixed** — phone-OTP sign-up/sign-in is verified end-to-end and issues valid tokens. The blocker that held screens 7–13 is gone; enabling `auth` + each domain now lets them go live and be verified.
- **Front-end de-mocking done:** cart, garage, notifications, **profile + its subscreens** (payment methods, shipping addresses, order history, **Liked**) all now render **real data or a genuine empty state** — no fake seed cars, images, notifications, stats, cards, addresses, orders, or "Pro member" badges. Only real values or honest empty states are shown.

**Rough overall: ~55–60%** — the frontend is largely done; what's left is backend-side (auth + data) and live verification.

---

## What the backend team must do (unblocks everything authed)

1. **🔴 Fix auth 500s** — `POST /v1/auth/phone/request-otp` and `/v1/auth/register` must return 200 (they 500 now). This is the one blocker for screens 7–13.
2. **Seed data** for the test user (no create APIs exist client-side):
   - notifications (a row — see `notifications-service.ts` for the expected shape),
   - a few parts in empty categories (Filters, Batteries…) so grids aren't empty.
3. **Confirm untyped response shapes** — `GET /v1/notifications` and cart aren't in Swagger; share one real payload each so the mappers are confirmed, not guessed.
4. **AI chat** — expose the path the app expects or tell us the canonical one (`/v1/ai/sessions`), so we can remap.
5. **Garage makes/models catalog** — `POST /v1/garage/vehicles` validates `make_id`/`model_id` against a **seeded catalog**, and right now **only Chevrolet is seeded** (everything else → 400 "Unknown or mismatched make_id/model_id"). The app offers 9 brands, so adding any non-Chevrolet vehicle fails. **Fix:** either (a) **seed all makes/models** the app lists (chevrolet, kia, hyundai, byd, chery, lada, toyota, haval, nissan + their models — see `services/uz-vehicle-catalog.ts`), or (b) expose **`GET /v1/garage/makes` + `/v1/garage/models`** so the app shows only backend-valid options. Slug ids ARE accepted for seeded makes, so (a) is the quick unblock.
6. **Favorites/likes endpoint (optional)** — the **Liked** screen works now (like state is local, product data hydrated from the catalog). For **cross-device sync**, expose `GET/POST/DELETE /v1/me/favorites` (or similar); the app would then mirror local likes to the server.

## What the frontend does once auth works
1. Add `auth` + the target domain(s) to `EXPO_PUBLIC_HTTP_DOMAINS`, `npx expo start -c`.
2. Sign in, exercise the screen end-to-end.
3. Tighten any 🟡 mapper from the first real payload.
4. Flip the badge to ✅ here.
