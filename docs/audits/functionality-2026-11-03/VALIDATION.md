# Validation and measurements

All automated tests below are **unit/component tests with controlled transports**. They are not real API integration tests, and no fixtures/mock transport were started for integration.

## Measured before changing behavior

| Reproduction | Baseline | Candidate | Evidence |
|---|---:|---:|---|
| Two `loadMore()` calls before React renders | 2 next-page sends | 1 | `tests/search-request-lifecycle.test.tsx` |
| Filter Apply while 300ms query debounce is pending | 2 first-page sends | 1 | same file |
| 20 completed GETs sharing caller AbortSignal | 20 adds, 0 removes (20 retained listeners) | 20 adds, 20 removes (0 retained) | `services/api-client.test.ts` |
| Ambiguous network failure, default retry budget, write | 3 sends | 1 | same file; covers POST/PATCH/PUT/DELETE |

Five initial search regressions all failed on the baseline. API regression checks against `git show HEAD:services/api-client.ts` failed 5 cases (four write methods plus listener cleanup), then passed against candidate. Removed-vehicle fitment regression also failed before the one-line fix and passed afterward. These are deterministic operation counts, **not** native latency, heap or FPS measurements. No unmeasured list/render/calculation optimization was made.

## Commands

- `npm test`: final results recorded below.
- `npm run typecheck`: final result recorded below.
- `EXPO_PUBLIC_APP_ENV=production EXPO_PUBLIC_API_BASE_URL=https://api.mator.uz EXPO_NO_DOTENV=1 npx expo export --platform ios --output-dir /private/tmp/mator-functionality-ios-export`: bundle/export check only. Does not install on simulator, rebuild Xcode, or establish native release readiness. Public production URL only; no environment files were printed/copied.
- `git diff --check`: whitespace check.

Real integration evidence is only [public-api.json](public-api.json). Current simulator control was unreliable because screens changed concurrently; no screenshots were collected and no account writes/order/payment submissions were performed. Android not verified. Running backend/frontend deployment SHAs not established.

The existing Vite config warning remains: ESM syntax is loaded as CommonJS by the current config loader. Successful unit runs do not resolve native/runtime compatibility.

## Final executed results

Candidate commit: `250daf6c2f29a44057d087bbc64a95ee9e85ab9f`.

| Check | Result |
|---|---|
| Full `npm test` | exit 0; **960 tests / 73 files passed**, 8.45s runner time |
| `npm run typecheck` | exit 0 |
| Production-configured iOS export | exit 0; `entry-e27ffab8162df2bf886f0a18df6e340c.hbc`, 9.1 MB |
| `git diff --check` | exit 0 |
| Production public API requests | two HTTP 200 responses; functional defects recorded in public-api.json |
| Native candidate testing | not performed; candidate not installed, concurrent current-app control |

The full suite includes existing cart/checkout/session/compatibility regressions. These are unit/component checks, even when a test filename contains `http` or `flow`. No new real integration fixture or mock server was used.

## Follow-up checks after Claude findings (2026-11-03)

`4842c7c` adds the reported functional fixes and historical auth-format reconciliation. Follow-up checks were targeted; the unchanged full suite was **not repeated**.

- `npm test -- services/auth-storage.test.ts contexts/active-vehicle-pin.test.tsx tests/likes-rapid-taps.test.tsx tests/account-query-isolation.test.tsx tests/authenticated-route.test.tsx tests/notification-screen-feedback.test.tsx tests/route-navigation-states.test.tsx services/i18n-key-coverage.test.ts`: **61 passed / 8 files**, exit 0.
- Final pending-notification account-lock refinement: `npm test -- tests/account-query-isolation.test.tsx tests/notification-screen-feedback.test.tsx`: **10 passed / 2 files**, exit 0. These overlap the 61 above; do not add the counts as distinct coverage.
- `npm run typecheck`: exit 0 after the refinement.
- Production-configured `npx expo export --platform ios --output-dir /private/tmp/mator-followup-ios-export` (same public production env flags as above, dotenv disabled): exit 0; final Hermes file `entry-6f28a752564691bfeae20656970ef309.hbc`, 9.1 MB. JS export only; not installed on simulator or native rebuilt.
- `git diff --check`: exit 0.
- React best-practices review: hook ordering, request ownership, account-keyed child remount, synchronous intent/locks, localized labels and recovery actions reviewed. No speculative memoization or list rewrite. Native appearance/accessibility/keyboard unverified.

Simulator/computer actions: **none** in this follow-up, per reservation. Real integration requests: **none newly executed**. Earlier public API evidence remains explicitly dated. No mocks/fixtures were introduced into integration or the running app; controlled test doubles exist only in unit/component tests. Native combined smoke remains queued in [FOLLOWUP.md](FOLLOWUP.md).
