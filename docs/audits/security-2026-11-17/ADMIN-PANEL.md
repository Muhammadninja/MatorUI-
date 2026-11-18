# Admin panel (mator-admin) security audit — 2026-11-17

Target: `mator-admin` main `adbf76f`, live on Vercel as `dpl_7WrAuLo3jDSciEvkCHJNDZ7QUVb3` (Next.js 15.5.29). Method: source review plus read-only probes of https://mator.uz. No credentials were used, so nothing was tested as a logged-in operator.

## Architecture as audited

- The admin pages live under the hidden segment `/mtr-ops-ffcb4e84`. Middleware sends anyone without a session to `/login`.
- The browser never holds a backend token. `/backend/*` is a server proxy that reads the signed `mator_session` cookie (HMAC-SHA256, httpOnly, SameSite=Lax, Secure), looks up that session's own admin-realm tokens in Upstash, and forwards them to the fixed upstream `api.mator.uz`. On a 401 it does one coalesced refresh.
- Roles are enforced by the backend (`AdminJwtGuard` + `AdminRoleGuard` on all 116 admin routes; see REMEDIATION.md). The panel adds its own checks for super-admin-only server routes (Blueprint).

## Checks

| Area | Result | Evidence |
|---|---|---|
| Admin pages without a session | ✅ | `/mtr-ops-…/orders` → 307 to `/login` |
| All API routes without a session | ✅ | `/api/auth/me`, `/api/order-status` (GET/POST), `/api/blueprint/*`, `/backend/v1/admin/orders`, `/backend/v1/admins` → 401; `/api/auth/diag` → 404 |
| Forged session cookie | ✅ data / ⚠️ shell | Proxy → 401 `NO_SESSION` and the cookie is cleared. The page shell (public JS only, no data) still renders: see ADM-02 |
| CSRF | ✅ | Every state-changing route (login, logout, invite, accept, order-status, proxy non-GET) checks Origin; a cross-origin login POST → 403. SameSite=Lax underneath |
| Proxy SSRF / host change | ✅ | Upstream is fixed at build time and path segments are `encodeURIComponent`-ed, so the host cannot change |
| Proxy header hygiene | ✅ | Request headers are rebuilt from scratch (no cookie forwarding). Response passes only Content-Type/Cache-Control and never `Set-Cookie`/`Authorization` (covered by tests) |
| Proxy active content | **Fixed** (ADM-01) | |
| Login brute force | ✅ | Backend: 5/min throttle plus `AdminLoginProtection` lockout keyed on a verified client IP. The panel's in-memory 5 per 15 min is per serverless instance only, but it isn't relied on |
| Logout / revocation | ✅ | Logout revokes upstream tokens and deletes the stored pair, which makes the cookie useless to the proxy. A revoked or deactivated admin fails the refresh → session cleared |
| XSS | ✅ | No `dangerouslySetInnerHTML` except two static constants (theme script, landing CSS). React 19 escapes output and blocks `javascript:` hrefs. Public `/catalog` links are `encodeURIComponent`-ed |
| Client bundle secrets | ✅ | Live JS has no keys/tokens/Upstash URLs. `NEXT_PUBLIC_*` = API URL plus two poll intervals |
| Security headers | ✅ (+CSP) | HSTS 2y, `X-Frame-Options: DENY`, nosniff, Referrer-Policy, Permissions-Policy, and now a baseline CSP |
| Preview deployments | ✅ | Vercel SSO protection `all_except_custom_domains`: `*.vercel.app` URLs redirect to login |
| Dependencies | ✅ | Next 15.5.29 (SEC-02). The only remaining advisory is postcss, which runs at build time only |

## Findings

- **ADM-01 — Medium, FIXED and live (`adbf76f`).** The proxy forwarded any upstream `Content-Type` from the panel's own origin. If an HTML/SVG body ever reached it (today the backend limits candidate images to png/jpeg/webp), opening it would run script as the logged-in operator. The proxy now renders only JSON, `text/plain` and PNG/JPEG/WebP; anything else goes out as `application/octet-stream` + `Content-Disposition: attachment`. 4 regression tests added; 221/221 tests pass.
- **ADM-02 — Low, owner config.** `ADMIN_SESSION_SECRET` is not set in Vercel, so the secret lives in Upstash and the Edge middleware can only check that the cookie *looks* right. A forged cookie gets the empty shell (all data is still refused). Fix: set `ADMIN_SESSION_SECRET` (≥32 random chars) in Vercel. Every operator signs in once more afterwards.
- **ADM-03 — Medium, owner decision: session length and MFA.**
  - The cookie lives for 30 days. The real limit is the backend refresh token (7 days, renewed on each refresh), so an idle session dies after about 7 days, but an active one never expires.
  - Admins have no MFA, and SUPER_ADMIN can invite other admins, issue refunds and payouts, and delete inventory.
  - Recommendation: TOTP for SUPER_ADMIN/MANAGER, and an idle timeout of about 12 h.
- **ADM-04 — Low.** The waitlist endpoint is public with a per-instance in-memory rate limit, so unique emails can be added to Upstash without bound (storage/cost only). Optional fix: an Upstash-backed rate limit.
- **ADM-05 — Info, deploy process.** `mator.uz` was pinned to an old deployment by an earlier manual promote, so pushes to main build but don't go live. Each admin deploy today had to be promoted via the API. To restore automatic domain assignment, run one "Promote to Production" from the Vercel dashboard UI, or keep checking `?dpl=` in the live HTML after every push.

## Not verified (needs an operator account)

Logged-in role separation in the UI (OPERATOR vs MANAGER vs SUPER_ADMIN), invite flow end-to-end, refresh-rotation races under real use, and Upstash ACL/token scope.
