# MATOR functionality review — 2026-11-03

This is an isolated frontend change set, **not a completed release certification**. Branch: `codex/functionality-audit-2026-11-03`; base: `9a64a98`; fix commit: `250daf6c2f29a44057d087bbc64a95ee9e85ab9f`. Worktree (permanently saved): `/Users/muhammadfotihabdullaev/Desktop/matorui/.local/worktrees/functionality-audit`. No restyling, dependencies, native configuration, account data, backend code, orders or payments were changed. Follow-up fixes add existing-component auth/error/exit paths and two notification messages in RU/UZ/EN. No screenshots were collected, per the latest instruction.

## Combined integration result

Owner released the simulator and authorized selective integration. Current branch: `integration/approved-design-functionality-2026-11-03`, based on approved `44b7d28` (includes `f04772e`, `4f5d05c`). [Current short smoke results, commit mapping, failures and blockers](COMBINED-SMOKE.md) supersede the pending-integration statuses below. Runtime source `63f82d8`; final recording commit adds only tests/docs. Original functionality/design worktrees remain separate; OTP autofill and unrelated dirty work are excluded. Frontend release readiness is **not established**.

## Latest follow-up

[Claude findings, earlier-fix comparison and queued combined smoke test](FOLLOWUP.md). Functional follow-up commit: `4842c7c`; subsequent account-lock refinement is recorded in Git history. Shared simulator remains reserved for Claude.

## Evidence and versions

- [Real public API evidence](public-api.json): two unauthenticated, read-only searches against `https://api.mator.uz/v1/search`; exact requests and sanitized product IDs/prices retained. No test/mock data used for integration.
- Current app: existing iPhone 16 Pro / iOS 18.3 Simulator. Its visible environment badge said `PRODUCTION · api.mator.uz`. Its JS commit/version could not be established; **it was not running this worktree's changes**. Concurrent navigation prevented reliable functional checks: a search field was observed, then an interaction returned an Add Vehicle screen. Input was stopped to preserve data. No extra simulator/backend/database was started.
- Backend deployment SHA: unknown; search responses do not expose it. Ask backend employee to attach the deployed SHA. Do not substitute local backend source history for the running version.
- Frontend candidate source: base above plus the accompanying fix commit. Native binary was not rebuilt or installed. iOS export is a JS bundle check, not an Xcode/device verification.
- [Validation and measured results](VALIDATION.md), [backend reproduction/handoff](BACKEND.md), [integration coordination](INTEGRATION.md).

Statuses below describe the stated layer only: `verified`, `error`, `blocked`, `not-verified`. Unit regressions use controlled transports and remain separate from real integration evidence.

## Authentication, session restoration, sign-out and account isolation

- [verified — unit] Eight private route guards prevent guest/hydrating screen mounts and reset private local state across accounts. Auth persistence accepts historical `writtenAt` and current `revision` formats; no duplicate auth implementation applied. See [follow-up evidence](FOLLOWUP.md).

- [verified — unit] Account-specific orders/details, addresses, payment methods, shipping quotes and notifications use owner-scoped cache keys; guest auto/manual reads are gated. A→B→guest→A regression uses the same query cache. Old-account notification rollback updates only its original cache. Evidence: `tests/account-query-isolation.test.tsx`.
- [verified — unit] Existing user-session isolation regressions pass in the full suite; no changes to Claude's in-progress `contexts/user.context.tsx`.
- [not-verified — native] Session restoration, token refresh, sign-out and two-account switching against real data in the current app. Concurrent simulator control prevented reliable checking; no real second-account credentials supplied.
- [verified — unit] `services/auth-storage.ts` now saves an atomic encrypted session envelope and compares monotonic revisions across both stores, preventing partial rotations from restoring older/mixed tokens. Legacy reads/migration are retained. Serialized saves/clears prevent a queued sign-out from being undone by an earlier write. Evidence: `services/auth-storage.test.ts` (21 tests after historical-format reconciliation).
- [not-verified — native] New-envelope migration and refresh/cold-start behavior on the real device remain unverified. Existing plaintext AsyncStorage fallback is preserved; OS-level deletion failures remain best effort. No session data was migrated on the running app in this pass.

## Garage persistence and compatibility logic

- [verified — unit] Set-active confirmation/failure behavior is fixed; VIN Finder has Back/Home recovery. See [follow-up evidence](FOLLOWUP.md). Native checks and visible VIN entry placement remain pending.

- [verified — unit] A removed pinned vehicle's generation/trim/engine no longer carries into the replacement vehicle. New test failed before the one-line fix and passes after it. Evidence: `contexts/active-vehicle-pin.test.tsx`.
- [verified — unit] Search re-runs when vehicle scope changes and rejects the old fitment's late response. Evidence: `tests/search-request-lifecycle.test.tsx`.
- [not-verified — real integration] Active vehicle persistence across restart, VIN decode, add/remove vehicle and real fitment correctness. No account garage mutations were made. Existing compatibility tests passed, but cannot establish catalog data correctness.

## Search, filters, sorting, pagination and stale responses

- [verified — unit] Generation checks reject superseded responses, including same-query sort/filter changes and the debounce window. Pagination aborts on invalidation/unmount, locks synchronously, deduplicates IDs within pages, and cannot append an older sort/vehicle page. Filter/sort immediate runs cancel the pending debounce. Evidence: `tests/search-request-lifecycle.test.tsx`.
- [verified — real API] Public query returns existing products, HTTP 200. Evidence: [public-api.json](public-api.json).
- [error — real API] Ascending and descending price sorts returned identical IDs/prices, including 30,000 → 32,000 → 31,000. Evidence and reproduction: [BACKEND.md](BACKEND.md).
- [error — real API] Five returned rows, total 19, `nextPageToken: null`: remaining matches inaccessible through the client's token contract.
- [not-verified — real integration] Category, price/rating filters, OEM search, locale switching and rapid typing in current native app. Earlier reports are historical evidence, not fresh verification.

## Favorites and cart synchronization, quantities and totals

- [verified — unit] Rapid favorite toggles return the synchronous intended state; [follow-up evidence](FOLLOWUP.md). This does not implement or verify account/server synchronization.

- [verified — unit] Existing cart canonical-response, scoped rollback, mutation ordering, storage isolation and subtotal/checkout regressions passed in the full suite. No cart mutation was sent to production.
- [error — code review] Current base favorites use device-wide `likes:v1` with no owner (`contexts/likes.context.tsx`, `services/likes-storage.ts`), so account isolation/server synchronization is not implemented in this branch. Historical `codex/favorites-sync` work must be reviewed against the employee's deployed contract before integration; do not auto-import legacy likes to an account.
- [not-verified — real integration] Favorites add/remove persistence, cart sync across sessions, stock limits, quantities and authoritative server totals. Preserving real account data prevented mutation-based assertions during concurrent control.

## Checkout validation and duplicate submission

- [verified — unit] Synchronous per-hook submission lock sends one order request for concurrent calls; only the first caller receives success and proceeds toward hosted payment/navigation. Success stays locked until reset; reset cannot unlock a pending request; failures can retry. Guest and changed-account continuations are rejected. Evidence: `tests/account-query-isolation.test.tsx`.
- [verified — unit] HTTP writes are no longer automatically replayed after ambiguous network failures. GET retries remain bounded. Evidence: `services/api-client.test.ts`.
- [blocked — real integration] Production order/payment submission is expressly prohibited. No production order or payment created. Frontend lock does not establish backend idempotency across remounts/devices or manual retry after an ambiguous failure; employee must verify server-side protection in its own safe environment.
- [not-verified] Complete address/payment/shipping validation, pending-cart checkout gating, stale selected-address handling and server rejection paths. Checkout screen is concurrently modified by Claude; see integration handoff before changing it. Do not infer validation correctness from the submit guard.

## Performance and cleanup

- [verified — unit measurement] Same-event pagination calls: **2 → 1** next-page requests. Filter Apply during pending debounce: **2 → 1** first-page requests. Deterministic regression, no latency/FPS claim.
- [verified — unit measurement] Twenty completed requests sharing a caller signal retained **20 → 0** client-installed abort listeners (20 adds / 0 removes before; 20 adds / 20 removes after).
- [verified — unit measurement] Ambiguous failed write with default retry budget: **3 → 1** sends. This is duplicate-side-effect prevention, not a throughput benchmark.
- [not-verified] Native render counts, frame times, large-list scrolling, memory profile and repeated-calculation costs. No speculative memoization/list rewrite or dependency changes made.

## Release configuration, logging and errors

- [verified — unit] Notifications now distinguish failure from empty, await mark-all confirmation and show localized errors; missing tracking ID has recovery. See [follow-up evidence](FOLLOWUP.md).

- [verified — unit] Release API payload logging cannot be forced on with the public debug flag. Structured credential/PII values are fully masked; deeply nested/cyclic data is replaced at the depth limit instead of leaking raw subtrees. Evidence: `services/debug-log.test.ts`.
- [verified — unit] Caller abort listeners are removed on completion; native abort/timeout and account-epoch regressions remain passing.
- [verified — static] Existing release environment policy restricts official HTTPS environments and disallows partial HTTP domains/dev OTP in production. No release configuration changed.
- [not-verified] Native release binary, Android, production monitoring/rollback, free-text logging outside structured logger, real offline/error recovery. Logger key masking is not a universal PII scrubber for arbitrary free text.

Outstanding items above remain open. Screenshots, a successful export and unit coverage do not prove functional release readiness.
