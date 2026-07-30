# Mator — Backend Handoff (open gaps blocking the app)

Prepared 2026-07-23. Every item below was verified live against
`https://api.mator.uz` (probes + the OpenAPI at `https://api.mator.uz/docs-json`).
The mobile client and the new operator admin panel are already built to these
contracts — shipping the backend pieces unblocks them with little/no client change.

> Scope note: the address CRUD (`/v1/addresses`) is **already working** after the
> client mapped to the real `CreateAddressDto` (`full_text` required). It is not a
> gap — listed here only so nobody re-opens it.

## Priority summary

| # | Gap | Priority | Why | Blocks |
| --- | --- | --- | --- | --- |
| 1 | Prod OTP code leak + real SMS | **P0 — security** | prod returns the OTP in the API response | Public launch |
| 2 | `payment_type` persistence + admin order endpoints | **P1 — core ops** | cash/terminal orders can't be fulfilled; operators have no tool | Order fulfillment, admin panel |
| 3 | Avatar upload endpoint | **P2** | no way to store a profile photo | Profile avatars |
| 4 | Change-phone endpoint | **P3** | users can't change their login number | "Edit phone" in profile |

Priorities are a recommendation — reorder to taste, but **#1 must land before any
public release.**

---

## 1. P0 — Remove the prod OTP leak & wire real SMS

**Problem.** `POST /v1/auth/phone/request-otp` on **prod** returns the OTP code in
the response body (`dev_otp_code`). Anyone who can call the endpoint for a number
can read its login code — a full auth bypass. It exists because real SMS delivery
isn't wired yet, so the app reads the code from the response.

**Evidence.** Live request-otp on api.mator.uz returns `dev_otp_code` alongside
`request_id`. `text/integration-progress.md` notes SMS (Eskiz/Playmobile) is not
yet connected.

**Do.**
1. Integrate the SMS aggregator (Eskiz / Playmobile) so codes are delivered by SMS.
2. **Stop returning `dev_otp_code` in prod responses.** Keep it only in
   dev/staging behind an explicit flag.

**Acceptance.** Prod `request-otp` response contains no OTP material; a real SMS
arrives; dev keeps the echo for testing.

---

## 2. P1 — `payment_type` persistence + operator order management

This is the biggest piece and has two halves. Full endpoint contract (request/
response shapes, state machine, auth) lives in **`mator-admin/docs/backend-contract.md`** —
build to that. Summary:

### 2a. Persist `payment_type` on orders (prerequisite for everything else here)

**Problem.** Checkout collects `payment_type` (`payme | terminal | cash`) but
`POST /v1/orders` **drops it** and the order model has no payment field, so nothing
downstream can tell an online order from a cash/terminal one.

**Evidence.** Live `cart_snapshot` schema = `{ delivery_method, delivery_address_id,
promo_code, items }` — no payment field. `RawBackendOrder` returns none either.

**Do.** Accept `payment_type` on create, store it, and return it on every order
response (`GET /v1/orders`, `GET /v1/orders/:id`, and the admin endpoints below).

### 2b. Operator order READ endpoints (`GET /v1/admin/orders`)

**Problem.** Order status is only advanced by the payment webhook, which
auto-confirms **payme**. **Cash and terminal** orders take no online payment, so
they need a human to call the customer, **verify stock**, and confirm — but there's
no operator endpoint and no admin order surface (only `/api/admin/sellers/*`).

**Do** (see contract doc for shapes):
- `GET /v1/admin/orders` — operator queue (filter by status/payment, `needs_operator` flag).
- `GET /v1/admin/orders/:id` — detail with **per-line `in_stock` / `stock_qty`**.
- `PATCH /v1/orders/:id/status` — operator transition. ✅ **ALREADY DEPLOYED** with
  server-enforced FSM + operator-role guard (verified 2026-07-24). What's still
  missing is the **read** side below.
- Guard all `/v1/admin/*` on an **operator/admin role**; allow the operator web
  origin via CORS.
- ⚠️ There is **no** `pending_confirmation` status — cash/terminal orders land in
  `pending_payment` and the operator marks `paid`. (Earlier drafts invented
  `pending_confirmation`/`confirmed`/`packed`/`out_for_delivery`; the live enum has none of them.)

**State machine (server-authoritative — REAL, verified live 2026-07-24):**
```
pending_payment  → paid | cancelled | expired
paid             → processing | cancelled
processing       → shipped | cancelled
shipped          → delivered | cancelled
delivered        → (terminal)     cancelled → (terminal)     expired → (terminal)
refunded         → (terminal, payment-side; not reachable via the status PATCH)
```

**Acceptance.** An operator can log in, see the queue, open a cash order, verify
stock, and confirm or cancel(out_of_stock); payme orders still auto-confirm via
the webhook. Emitting the existing `ORDER_STATUS_CHANGED` notification on each
transition is a nice-to-have (updates the customer app).

### 2c. App ↔ admin status sharing — endpoint DEPLOYED, needs an OPERATOR ACCOUNT

**✅ RESOLVED 2026-07-24 — status write works end-to-end.** `PATCH /v1/orders/:id/status
{ status, note }` is live and **operator-role gated**. The dedicated admin account
`+998502030318` was granted `role: ADMIN`, so the write returns **200** (a plain
`role: "user"` token gets `403 "Forbidden resource"`). Real accepted enum (verified live):
`pending_payment | paid | processing | shipped | delivered | cancelled | expired | refunded`
— NOT the fictional `confirmed|packed|out_for_delivery`, which the API rejects with
`400 "status is not a valid order status"`. FSM enforced server-side (see 2b). Verified:
an order driven `paid→processing→shipped→delivered` all `200`, cancel+note `200`, and the
customer app reflects it within ~15s. Contract: `mator-admin/docs/order-status-write.md`.
**Still owed:** the READ side — `GET /v1/admin/orders` (all customers, not user-scoped),
plus persisting/returning `note` + a status-history endpoint for the audit timeline.

**ACTION NEEDED — grant an operator role (no code, DB/config change):** there is no
operator signup/login endpoint (all 404), and `GET /v1/me` shows `role: "user"`. The
mobile app can only ever mint `role: "user"` tokens. So the backend must **grant the
operator/admin role to an account** — either flip the existing account or (cleaner)
create a dedicated ops account:

- **Account to grant:** `+998903700340` (id `3564fa0b-1645-4ae4-bb35-ffc7214deede`) —
  OR a new dedicated operator account (preferred: keeps the customer app and the
  operator panel from fighting over one token's `tokenVersion`).
- **Change:** set that account's `role` (users table / auth service) from `user` to
  whatever value the guard on `PATCH /v1/orders/:id/status` accepts (`operator` or
  `admin`). Confirm the role name the guard checks.
- **Verify (any shell):** log the account in via OTP, then
  `curl -X PATCH https://api.mator.uz/v1/orders/<orderId>/status -H "Authorization: Bearer <access_token>" -H 'Content-Type: application/json' -d '{"status":"paid"}'`
  → returns **200** with an operator token (`403` with a `user` token). The decoded JWT shows `"role":"ADMIN"`. ✅ Done for `0318`.

Once granted: put that account's `refresh_token` in `mator-admin/.env.local` as
`MATOR_REFRESH_TOKEN`, restart the admin — the PATCH returns 200, and the customer app
reflects the new status within ~15s. **Zero further app/admin code changes.**

**Optional real-time upgrade (WebSocket):** `mator-admin/docs/orders-realtime-ws.md`
specs an `orders` channel on the backend's already-designed (but undeployed)
`wss://api.mator.uz/realtime` socket — command stays HTTP (the PATCH above), the
server broadcasts `order.status.changed`. Not required (15s polling already works);
build only if you want <1s live updates + are deploying `/realtime` anyway.

**The app side is already wired**: the mobile app reads `order.status` from
`GET /v1/orders/:id` and polls it every 15s (`hooks/use-orders.ts`), so a status the
operator sets appears on the customer's tracking screen within ~15s — no app change
needed. The admin sends the **real backend slugs directly** (no mapping layer):
`pending_payment | paid | processing | shipped | delivered | cancelled`, matching the
FSM in 2b. Verified end-to-end 2026-07-24.

---

## 3. P2 — Avatar upload endpoint

**Problem.** There is **no file-upload endpoint anywhere** in the API. The client
uploads correctly (Expo `uploadAsync`, multipart) but `POST /v1/me/avatar` → 404,
so `GET /v1/me` always returns `avatar_url: null`. `text/backend.json` designed
`/v1/me/avatar` but it was never built.

**Evidence.** All 67 live routes scanned — zero multipart/upload/presign endpoints.
`POST /v1/me/avatar` → 404 (probed live). `PATCH /v1/me` *does* accept `avatar_url`
as a string.

**Do.** Add:
```
POST /v1/me/avatar   multipart/form-data, field: file  (jpeg, ≤5MB)
→ 200 { avatar_url: "https://cdn.mator.uz/...", thumbnail_url: "..." }
```
The returned `avatar_url` must be a **public HTTPS URL on an allowed asset host**
(the app loads it with no auth header; `PATCH /v1/me` already validates this — the
original client error was *"avatar_url must be an HTTPS URL on an allowed asset
host"*). EXIF-strip / NSFW-scan server-side as originally specced.

**Acceptance.** Uploading returns a public HTTPS URL; `GET /v1/me` then returns it;
the profile renders it. (Client already handles this end-to-end — no app change
needed. Interim: the app stores the photo device-locally until this ships.)

---

## 4. P3 — Change-phone endpoint

**Problem.** Phone is the login identity and there's **no way to change it**. The
only phone routes are the unified login OTP flow (`request/verify/resend-otp`),
which *upserts by phone* — verifying a new number logs into/creates a **different
account**, it doesn't rename the current one. `PATCH /v1/me` rejects `phone_e164`.

**Do.** Add an authenticated change-phone flow, e.g.:
```
POST /v1/me/phone/request-otp   { new_phone_e164 }   (auth required)
POST /v1/me/phone/confirm        { request_id, code } (auth required)
   → rebinds the CURRENT account to the new number (after uniqueness check)
```

**Acceptance.** A signed-in user changes their phone via OTP without switching
accounts. (Client "edit phone" UI is ready to build once this exists — currently
the field is read-only by design.)

---

## References

- **Admin endpoint contract (full detail):** `mator-admin/docs/backend-contract.md`
- **Auth/profile integration notes:** `text/integration-progress.md`
- **Original design doc (incomplete — verify against `/docs-json`):** `text/backend.json`
- **Live OpenAPI (authoritative):** `https://api.mator.uz/docs-json`
