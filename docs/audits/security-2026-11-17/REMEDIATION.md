# P0 security remediation — 2026-11-17

Follow-up to [INDEX.md](INDEX.md). All fixes were pushed to `main` in all three repos on 2026-11-17. **Admin is deployed. Backend is pushed but not yet deployed on the API box. Mobile still needs a new App Store build.**

| Repo | Base (origin/main) | Fix commit |
|---|---|---|
| Mobile `matorui` | `caf21e4` | `da9ea23` |
| Backend `mator.uz` | `a2f73b0d` | `de57ab63` |
| Admin `mator-admin` | `5ea7af7` | `5077f5b` |

## Findings

### SEC-01 — High — mobile tokens in plaintext AsyncStorage → **FIXED IN CODE, not shipped**

- **Before:** `saveAuthSession` wrote the full access+refresh envelope to AsyncStorage `auth:v2:session` on every save, and the loader accepted it.
- **Change (`services/auth-storage.ts`):** tokens are stored only in SecureStore as `auth_v4_session` with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`. That means they are readable on a background launch and left out of iCloud/iTunes backups. A new key was needed because expo-secure-store updates the value of an existing item but never its accessibility (`SecureStoreModule.swift` `update()`).
- **Migration:** legacy copies (the AsyncStorage envelope, the `auth_v3_session` item, and the split `auth_v2_*` keys) are read once using the old newest-revision rule. The session is written to v4, read back to confirm, and then every legacy copy is deleted. If that write fails, the user stays signed in for this run, and the existing legacy copy is kept so the next launch can retry. Nothing new is written in plaintext.
- **Keychain unavailable on save:** nothing is written in plaintext. The stale legacy copy is deleted, and the session stays in memory until the next cold boot, which then asks the user to sign in.
- **Logout, account switch and environment wipe:** `clearAuthSession` deletes v4 and every legacy copy. The profile cache (`auth:v2:profile`, which holds no credentials) is cleared through the existing `applyProfile(null)`.
- **Tests:** 23 auth-storage tests and 3 storage-environment tests. They cover: no token in AsyncStorage after save, rotation or cold boot; keychain failure with no fallback; a write that doesn't read back counts as failed; migration from each legacy format; failed-migration retry; cleanup after an interrupted migration; corrupt legacy data; account switch; clear racing a pending save. Full mobile suite: **168 files / 2276 tests pass**; `tsc` clean.
- **Still open:** this fix only reaches users through a new app binary. It has not been checked on a device. Still to do: install over the current App Store build, confirm the user stays signed in after migration, then inspect the app container and confirm `auth:v2:session` is gone. Rollback note: older binaries read v3/AsyncStorage, so downgrading after migration signs the user out.

### SEC-02 — Critical advisory — Admin Next.js → **FIXED AND DEPLOYED**

- **Deployed version:** **15.5.21**, read from the live `https://mator.uz` client chunk (`version:"15.5.21"`). Hosting is Vercel (`server: Vercel`). The repo comment saying "next start behind nginx" is out of date.
- **Advisories affecting 15.5.21:**

| Advisory | Severity | Patched in 15.x | Applicability |
|---|---|---|---|
| GHSA-2xp9-vwfh-vxw4 (AVIF image optimizer RCE) | Critical | 15.5.24 | `/_next/image` is live (GET answered 400 for a disallowed source). On Vercel, image optimization normally runs on Vercel's own infrastructure rather than in the Next server, which **probably** puts it out of reach. **Not demonstrated either way; no payload sent.** |
| GHSA-2464-fhr4-w9xw (SVG image optimizer RCE) | Critical | 15.5.28 | Same as above. `dangerouslyAllowSVG` is not set. |
| GHSA-p293-qw3h-jr36 (CVE-2026-75604) | Critical | 15.5.24 | Windows-hosted servers only. **Not applicable** (Vercel/Linux). |
| GHSA-p3m5-59mp-jv5r (CVE-2026-94482) Server Actions DoS | High | 15.5.28 | Applicable in principle (App Router). |
| GHSA-4jqv-mc3x-m676 / GHSA-mcj8-r9mp-w47p cache poisoning | Medium | 15.5.27 | The first one is for self-hosted apps only; both are patched anyway. |

- **Change:** `next` 15.5.21 → **15.5.29** (the 15.x backport line; no major upgrade). The lockfile also picks up sharp 0.35.5, nanoid 3.3.20 and source-map-js 1.2.2.
- **Verification:** `tsc` clean, **217/217** admin tests pass (including session/token-store/CSRF), `next build` succeeds.
- **Remaining audit entry:** `postcss` 8.4.31 is pinned inside Next (GHSA-qx2v-qp2m-jg93, -6g55-p6wh-862q, -fxqj-rqcc-2cmp, -r28c-9q8g-f849). Next uses postcss at build time on first-party CSS only, and no attacker-controlled CSS reaches it. **Not reachable at runtime.** The only fix is Next 16 (major); deferred.
- **Deployed:** Vercel deployment `dpl_GWpwLn2DCJXEFvKqkBFU4Ud7wGDG` (commit `5077f5b`).
  - The build finished, but `mator.uz` and `www.mator.uz` stayed on the old deployment `dpl_B2iuy894…`. An earlier manual promote had pinned them there, which stops pushes to main from going live.
  - I promoted the new deployment through the Vercel API, so the old one stays available as a rollback target.
  - **Checked on the live site:** the client chunk reports `version:"15.5.29"`; `/`, `/catalog` and `www` return 200; the admin shell redirects (308) as expected.

### SEC-03 — High dependency advisories → **Backend reachable ones FIXED IN CODE; rest triaged**

The backend fix is a lockfile-only change (no `package.json` ranges changed, 38 lockfile lines):

| Package | Advisory | Before → after | Reachability |
|---|---|---|---|
| multer (via @nestjs/platform-express) | GHSA-q7qp-rjg7-q26m DoS | 2.4.0 → 2.5.0 (platform-express 11.2.7 → 11.2.10) | Reachable on upload endpoints → fixed |
| body-parser (via express/bull-board) | GHSA-27r3-jxmh-p828 DoS | 2.3.0 → 2.4.0 | Reachable → fixed |
| follow-redirects (via axios) | GHSA-q3jh-wrc6-jgq8, -8r9p-f939-6h3c, -mrwp-f3q8-3g9p | 1.16.0 → 1.16.3 | Used by outbound axios calls → fixed |
| deepmerge-ts (via prisma CLI → @prisma/config) | GHSA-ggr8-5vv4-36mx | 7.1.5, unchanged | Used only by the Prisma CLI to merge the developer's own config; not in the HTTP path. The fix needs Prisma 7 (major; prod is pinned to 6.19.3). **Not applicable at runtime; deferred.** |

Remaining backend audit after the fix: 3 High entries (all the deepmerge-ts/prisma chain above) and 2 Moderate.

`npm audit fix` was tried first and reverted: it rewrote about 7.7k lockfile lines, which would have pulled in unrelated changes.

Mobile: 29 High entries were triaged and **no dependency changes were made.**
- Build-time only, not in the iOS bundle: picomatch (no patched version exists), metro, image-size, jest-worker, fdir, tinyglobby, @expo/cli, its zod 3.25.76, and eas-cli. The app's own runtime zod is 4.6.7, which is already patched.
- In the runtime bundle: **decode-uri-component 0.2.2** (through expo-router → query-string 7). Advisories GHSA-qr28-fpjm-wq7f (High) and GHSA-vcc3-ghjq-m6fr (Medium) describe a CPU DoS from crafted percent-encoding. Here that means a malicious deep link the user would have to open could freeze their own app. No server or data impact.
  - The fix is 0.5.1, which is ESM-only and incompatible with how query-string 7 `require`s it. The supported route is expo-router 58 (the Expo SDK 58 major).
  - **Owner decision:** accept this as a low-impact client DoS for release, or upgrade the SDK first.

### SEC-04 — Medium — unbounded image worker download → **FIXED IN CODE, not deployed**

- **New `Backend/src/queue/image-download.ts`:**
  - https only; no credentials, IP-literal hosts or non-default ports.
  - Host must be `api.telegram.org` or `res.cloudinary.com`; `IMAGE_DOWNLOAD_ALLOWED_HOSTS` can add more.
  - At most 2 redirects, each hop re-checked against the same rules.
  - Connections go through the existing public-only DNS lookup (`providerUrlAgent`); `proxy: false`.
  - 20 MB cap on decoded bytes, enforced while streaming (so a gzip bomb is measured after decompression).
  - 20 s connect/idle timeout and a 45 s total deadline.
  - Content-type must be image/jpeg, png, webp or octet-stream, and the bytes must have a real JPEG/PNG/WebP signature with readable dimensions of at most 50 MP.
  - Refusals raise `UnrecoverableError`, so a bad file isn't retried.
- **Memory bound:** worker concurrency (max 10) × 20 MB.
- **FLUX result download** (`image-enhance.service.ts`): same byte cap and image validation, because that result is published to Cloudinary.
- **Tests:** `image-download.spec.ts` covers the URL policy (metadata IP, `cloudinary.com.evil` lookalike, file://, credentials, ports), redirect-hop refusal, HTML/SVG/gzip/empty/truncated bodies, PNG/JPEG/WebP pixel bombs, and a real local-server transfer that is **aborted mid-stream above 20 MB** plus a truncated transfer. All ai+queue specs pass (569).
- **Backend full unit suite:** 7274 pass, 2 fail. Both failures are in `telegram.draft-flow.spec.ts` and fail the same way on untouched main (a guard test that predates `admin-part-photos.service.ts`). `nest build` passes.
- **HTTP smoke:** 26/31 suites pass, the same as untouched main. The other 5 suites need a database and env.

## Section 5 — security verification: NOT PERFORMED

None of the mandatory gates in INDEX.md are evidenced yet, because they need things this session does not have:

- a staging environment with two customers plus dealer and admin test identities. Do not paste credentials into chat; give them via env file or 1Password.
- SSH to the API box. This Mac's key is not in `authorized_keys`, so there is no read-only check of Postgres/Redis listen/ACL/TLS, firewall, pm2 env or backup files.
- Cloudinary console or API access to review upload presets and signing.
- backup and restore-rehearsal evidence.

Still **NOT VERIFIED:** BOLA/IDOR across orders/addresses/favorites/cart, OTP rate limits in the deployed config, session revocation, the admin/dealer authorization matrix, payment tampering and webhook replay against a real DB, DB/Redis access controls, Cloudinary permissions, and backup restoration.

## Section 6 — deployment: PARTIAL

Done: all three repos pushed to main; admin promoted and checked live.

Remaining:
1. Backend: back up the DB on the box, then follow the runbook (`npm ci && prisma generate && npm run build`, then `pm2 restart`; no migrations in this change) → check `/health` → watch the next Telegram draft image succeed.
2. Mobile: EAS production build, device migration check, then App Store submission.


## Verification done without owner inputs (2026-11-17, second pass)

Static review was done on backend main `34c9e701`. Production probes were read-only: GET requests, TCP connect checks, and unsigned webhook calls that the API rejects before touching any data.

| Gate | Result | Evidence |
|---|---|---|
| 1 BOLA (static) | **No defect found** | Inventoried all 253 routes. All 28 user-scoped `:id` routes (addresses, cart, Garage, devices, notifications, orders, cancel, payments, bookings, sourcing offers, AI sessions, favorites) pass `req.user.id`. The service then either filters by `userId` in the query or loads the row and compares the owner, returning 404 on a mismatch. |
| 2 Function authz (static) | **No defect found** | All 116 admin routes use `AdminJwtGuard` + `AdminRoleGuard`. `getAllAndOverride` (handler before class) means method-level role restrictions take effect. Customer JWTs are a different token type and are rejected by the admin guard. |
| Anonymous access (live) | **Pass 10/10** | Private and admin endpoints answer 401/403 without a token (`Backend/scripts/qa/security-authz-check.mjs`, read-only prod mode). |
| 6 Webhooks (live + static) | **Pass** | Payme without auth or with a wrong key → `-32504`; the comparison is constant-time and a blank key is never accepted. Click is disabled (fails closed) and verifies the MD5 sign when enabled. Both check the amount against the order. |
| Exposure (live) | **Pass** | `/metrics` 403, `/docs` and `/admin/queues` 401, the staging OTP inbox 404, legacy email/social login is not registered (404), and CORS does not reflect foreign origins. |
| 11 Network (live) | **Pass, partly** | From the internet, 5432, 6379, 3000, 8000 and 8080 are closed. TLS 1.0/1.1 are refused, the Let's Encrypt certificate is valid until 2026-12-26, and HTTP redirects to HTTPS. Database/Redis ACLs and the host firewall config itself are **not verified** (no SSH). |
| 10 Secrets in history | **No real secret found** | Regex scan of the full history of all 3 repos (Telegram/Cloudinary/OpenAI/Anthropic/Google/AWS/GitHub keys, private keys, DB/Redis URLs, JWTs, generic assignments). All 21 hits are placeholders (`REPLACE_ME`, `USER:PASS@host`, `postgres` in CI). |
| Mobile logging | **Pass** | `debugLog` is off in release builds and redacts tokens, OTP and PII. Account data in AsyncStorage is keyed by owner. Recent searches are device-wide (Low). |

### New findings

- **NEW-01 — High (infrastructure): SSH password login enabled.** Port 2222 (OpenSSH 9.6p1) offers `publickey,password`, and the root password was previously shared in plaintext. **Owner action:** rotate the root password, set `PasswordAuthentication no` and `PermitRootLogin prohibit-password`, and add fail2ban.
- **NEW-02 — Medium: no per-number SMS ceiling.** The only send limit is a 60 s cooldown per number, so one number can be sent 60 SMS/hour (1440/day): SMS bombing, and every message is paid. The `captcha_token` field is accepted but ignored, and the `rateSms` key is declared but unused. This was a deliberate decision in `8a72a473` / `DEPLOYMENT.md`. A fix (5/hour, 10/day per number, 429 `OTP_SEND_LIMIT_REACHED`, 205 auth/redis tests pass) sits on the **unpushed local branch `security/otp-send-cap` (`5fae393a`)** and needs owner/backend-developer sign-off.
- **NEW-03 — Low: Eskiz delivery webhook is unauthenticated.** This is documented. A forged report can only flip one SMS row between delivered and failed. Optional fix: a secret token in `ESKIZ_CALLBACK_URL`.
- **NEW-04 — Info: trust-proxy setting needs checking on the box.** Throttling keys on `request.ip`, which depends on `TRUST_PROXY`. A wrong value lets clients spoof `X-Forwarded-For` (if it trusts too much) or puts every client in one bucket (if it trusts too little). Check on the box: `TRUST_PROXY` should be `1` (nginx only).

### Ready to run once staging accounts exist

```
MATOR_API_BASE=https://<staging> CUSTOMER_A_TOKEN=… CUSTOMER_B_TOKEN=… ADMIN_TOKEN=… \
  node Backend/scripts/qa/security-authz-check.mjs > authz-report.json
```

The script creates objects as customer A, attacks them as customer B (address, vehicle, favorite, cart line, order, payment), tests customer → admin function calls, then cleans up. It refuses to write against production.

## Updated recommendation: **NO-GO**

- SEC-01, SEC-02, SEC-04 and the reachable SEC-03 backend packages are fixed in code and tested, but **none is in production**. SEC-01 also needs a new app binary.
- Every mandatory authorization, payment and infrastructure gate from the audit is still unverified.
- Passing tests are evidence the controls behave as written. They are not proof the system is secure.
