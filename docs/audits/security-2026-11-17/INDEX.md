# Mator independent pre-release security assessment — 2026-11-17

**Disposition: NO-GO pending remediation and completion of mandatory verification.** This is a partial evidence-based assessment, not a completed penetration test or certification. No application fixes, deployment, production mutations, payment attempts, brute force or load attacks were performed. Existing workspace edits were preserved.

## Provenance and references

Remote main SHAs verified with git ls-remote:
- Mobile: `caf21e4cc59c1dde27ad9ecfb8d2bf7309e9b34f`
- Backend: `a2f73b0d19400862affe528a46d026665b3e86bf`
- Admin: `5ea7af7309482af74e3d67757432203f009b1775`

Snapshots were archived to `/tmp/mator-security-audit`. Deployed SHAs, running mobile binary, image-pipeline service revision and actual infrastructure configuration are **unknown**. Local documentation/source indicate NestJS/Prisma/PostgreSQL/Redis/BullMQ, external Cloudinary/image services, Next.js Admin and Expo mobile; this is not verified deployment inventory.

References: [OWASP API Top 10 2023](https://api-security.owasp.org/editions/2023/en/0x00-header/), [ASVS 5](https://asvs.owasp.org/), [MASVS](https://github.com/OWASP/masvs). These guide coverage; no complete ASVS level or MASVS conformance is asserted.

## Findings

### SEC-01 — High: bearer credentials duplicated into plaintext mobile storage

Component: Mobile `services/auth-storage.ts`, `saveAuthSession`, `loadAuthSession`; affects all authenticated endpoints through stolen credentials. MASVS-STORAGE / ASVS sensitive-data storage.

Evidence: main writes the complete access/refresh envelope to AsyncStorage key `auth:v2:session` before also writing SecureStore. This happens on successful secure storage as well. `readCopies` and hydration accept that plaintext copy. Existing storage tests pass and explicitly exercise fallback survival. Reproduce using synthetic access/refresh values: call saveAuthSession, read this AsyncStorage key, assert both synthetic credentials are present. Source inspection and mock-storage tests confirm the behavior; device filesystem extraction was not attempted.

Impact: sandbox/backup extraction or other local app-data compromise can yield reusable bearer credentials. This is not a remote unauthenticated exploit by itself.

Remediation: use Keychain/Keystore as the credential store; migrate and delete legacy plaintext envelopes; fail safely when secure persistence fails. Keep only non-sensitive metadata outside secure storage. Coordinate migration and revocation policy.

Regression: after save/refresh/cold boot, plaintext stores contain neither token; unavailable secure storage never creates plaintext fallback; logout removes legacy copies; rotation remains atomic.

Fix status: OPEN; no fixes applied or retested.

### SEC-02 — Critical advisory / deployment exploitability unverified: Admin Next.js dependency

Component: Admin locked Next.js; potential `/_next/image` and framework routes. API8/ASVS dependency security.

Evidence: [Admin npm audit](admin-dependencies.json) reports Next.js Critical including [AVIF image optimizer RCE](https://github.com/advisories/GHSA-2xp9-vwfh-vxw4) and [SVG image optimizer RCE](https://github.com/advisories/GHSA-2464-fhr4-w9xw). Other advisories include Windows-specific RCE and cache poisoning. Do not assume the Windows advisory applies to a Linux deployment. Reproduce metadata check with `npm audit --package-lock-only --omit=dev --json` at the pinned SHA. Source next.config has no explicit image optimizer disable, but reachability and exploit conditions were not demonstrated. No exploit payload was sent.

Impact: potentially server compromise if advisory prerequisites are met; framework denial of service/cache integrity risks also require triage.

Remediation: owner-approved upgrade to a version covering all applicable advisories; inspect actual deployed version, image optimizer use, hosting OS and edge mitigations. Do not rely on middleware alone.

Regression: rerun lockfile audit, production build, admin login/session/CSRF tests and safe isolated advisory-specific regression cases.

Fix status: OPEN advisory, not confirmed production exploitation; no remediation performed.

### SEC-03 — High advisories: Backend/mobile dependency exposure requires triage

Evidence: [Backend audit](backend-dependencies.json): 7 High, 2 Moderate package entries; [mobile audit](mobile-dependencies.json): 29 High, 14 Moderate package entries. Backend includes multer, body-parser and follow-redirects. Mobile includes build tooling and transitive packages; npm production classification does not establish presence in an iOS binary. Counts include dependency chains, not independent exploitable vulnerabilities.

Affected endpoints: potentially upload/body parsing/fetching on Backend; exact reachable paths and build-time vs runtime mobile exposure remain unverified. Reproduce using the same npm audit command on each pinned snapshot.

Impact: advisory-dependent availability/integrity/confidentiality risks. Remediation: inventory deployed dependencies and upgrade reachable vulnerable packages with Backend owner. Regression: audit clean/applicability documented, upload/body-limit tests, redirects and mobile build/launch checks. Fix status: OPEN; no patches or exploit retests.

### SEC-04 — Medium: image worker buffers downloads without an explicit response byte limit

Component: Backend `src/queue/image-processing.processor.ts:231`, private download helper used for Telegram and stored Cloudinary originals; no public direct arbitrary-URL endpoint established.

Evidence: axios arraybuffer request sets timeout but no maxContentLength/maxBodyLength. Reproduce safely in isolation with a mocked oversized response; verify current request config omits a byte ceiling. Static evidence only; oversized network transfer was not run. Source URLs originate in Telegram file lookup or stored original URL, so arbitrary-customer SSRF is **not established**.

Impact: large responses can consume worker memory; actual upstream limits and worker concurrency determine severity. Remediation: bounded streaming/byte ceilings, allowed schemes/hosts and redirect validation, decoded pixel limits. Regression: synthetic response exceeding cap is aborted, redirects to local networks rejected, decompression/pixel limits enforced. Fix status: OPEN static finding; no remediation/retest.

## Checks and evidence

[Machine-readable test results](tests.json), [limited git-history scan](history-scan.json).

- Backend: 77 suites / 1799 tests passed; local HTTP smoke: 8 suites / 95 tests passed.
- Mobile storage/session isolation: 39 tests passed. Admin session/token-store/CSRF: 28 tests passed.
- Initial Backend run used an outdated generated Prisma client and failed; those results are invalid as vulnerability evidence. A client generated from the audited schema into a separate temporary output plus Jest module mapping resolved this: final results above. No database migration performed.
- Existing installed node_modules were reused; this is not a clean dependency installation. Lockfile advisory scans are independent of that limitation.
- Tests use synthetic identities and mocked services/Prisma; HTTP tests open local servers. They do not prove real database concurrency, deployed middleware or full role authorization.
- Passive production: GET `https://api.mator.uz/health` returned HTTP 200, curl TLS verification result 0. No response body/customer data retained. This does not prove security.
- Limited history patterns: AWS access-key IDs, classic GitHub PAT shape, private-key PEM markers. Backend match at `a50b0dc1...`, `.env.example`, was a ten-character placeholder body, not a complete key. No entropy scanner, full credential format coverage, credential validity testing or secret rotation audit completed.

## Mandatory P0 coverage / release gates

| # | Area | Evidence and remaining work |
|---|---|---|
| 1 | BOLA orders/addresses/favorites/cart/customers | Partial: ownership-scoped source and tests; addresses reject another owner, favorites bind mutations/cursors to owner. Full customer A/B/dealer/admin HTTP matrix with real isolated DB is NOT VERIFIED. |
| 2 | Function authorization | Partial: RolesGuard and admin tests; exhaustive customer/dealer/admin endpoint matrix NOT VERIFIED. Dealer listing tests are not dealer permission proof. |
| 3 | OTP | Partial: attempt concurrency, SMS protection, enumeration and privacy tests passed; deployed Redis/IP/rate configuration NOT VERIFIED. |
| 4 | Sessions | SEC-01; token/session tests passed; real revocation, device keychain and installed iOS binary NOT VERIFIED. |
| 5 | Checkout manipulation | Unit/HTTP suites passed for order/cart flows; real DB price/shipping/quantity/payment-status tampering and races NOT VERIFIED. |
| 6 | Webhooks | Payme unit and HTTP transport tests passed with mocks; deployed secrets, provider IP assumptions, real DB replay/idempotency NOT VERIFIED. Other provider parity NOT VERIFIED. |
| 7 | Injection/XSS/mass assignment | Partial source review only; complete route/DTO/query/sink audit and isolated payload tests NOT VERIFIED. |
| 8 | Uploads/storage/images | SEC-03/04; avatar/image client tests partial. Cloudinary permissions, upload presets and decoded image limits NOT VERIFIED. |
| 9 | SSRF | Pipeline client rejects redirects and has timeout; worker URL lineage inspected. Entire external sourcing service/DNS rebinding/egress policy NOT VERIFIED. |
| 10 | Secrets/debug/logs | Limited history scan only; production env/log/debug exposure and complete secret scanning NOT VERIFIED. |
| 11 | PostgreSQL/Redis | Firewall/listen/TLS/ACL/DB roles NOT VERIFIED; no network scan performed. |
| 12 | Admin | Signed httpOnly SameSite cookies and CSRF source/tests reviewed. Cookie TTL 30 days; idle expiry/MFA/audit-log completeness and deployment policy NOT VERIFIED. |
| 13 | Dependencies/history | npm audits completed; SEC-02/03; history scan limited as described. |
| 14 | Abuse/resources | OTP limits and HTTP/admin tests partial; queue quotas/global budgets/worker ceilings NOT VERIFIED; no load tests. |
| 15 | Backup/IR | Actual backup encryption, restore rehearsal, RPO/RTO, alert delivery and incident response NOT VERIFIED. |

## Release recommendation and owner handoff

NO-GO until SEC-01 is resolved, Critical/High dependency advisories are remediated or demonstrably inapplicable, and mandatory authorization/payment/infrastructure gates are evidenced. This recommendation reflects both findings and verification gaps; it does not label every gap a vulnerability.

No Critical application exploit was demonstrated. Critical/High items remaining are SEC-01 and SEC-02/03 with the qualifications above. No remediation was made, so there are no confirmed fix retests. Passing tests are control evidence, not a security guarantee.

Requested prerequisites: a designated staging environment with two customers, dealer and admin test identities; Backend-owner coordinated read-only deployed revision/configuration evidence; image service source/revision; firewall/DB/Redis/Cloudinary access policy; backup/restore and monitoring evidence. Do not send credentials in chat. Follow-up must reproduce BOLA/BFLA and payment replay against isolated persistence and inspect the actual iOS release artifact. Coordinate all fixes with Backend owner before any deployment.
