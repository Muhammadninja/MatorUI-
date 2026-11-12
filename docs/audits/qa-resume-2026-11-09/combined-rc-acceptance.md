# Combined RC verification handoff — task dated 2026-11-09

**Current result: local Android acceptance passed; CI is in progress.** Two ordered flow-12 → flow-13 pairs passed on the same pinned APK built from frozen source `5da6971e7e9e6d74926a20ee17437a7290f6cfc5`. See [candidate build provenance and evidence](candidate-build/provenance.md). The local backend is a deterministic loopback mock; this does not establish production behavior or release readiness.

## Requested binary and source provenance

The requested existing combined APK was found at:

`android/app/build/outputs/apk/release/app-release.apk`

in the `claude/rc-startup-integration` worktree. Its SHA256 was verified as:

`9e05a350f3f0c06e79ad3ae5c351181d116e4e61833711a8c6d874b007d9b7c5`

That file was subsequently replaced in the shared worktree. Its original copy was not found in the project worktrees, `/tmp`, or the searched local caches. The prior binary's embedded bundle and original source map are therefore unavailable for a conclusive source comparison. Do not infer who or what replaced it.

At first observation, the RC checkout was at `f1e9981e313547232ed186d3c51bee802616277e` with a local `AppIconButton` source change that was later committed as `23905a9b542519114e47f516b6bbf9dd99e74a34`. Candidate frontend provenance is the application source represented by `23905a9`, but the original APK's source SHA remains **unverified** because its sourcemap could not be inspected. Do not label the binary as an exact-source build of either SHA.

The current replacement APK is `c3f394d8cf980a62303b19c88b231230d3ae57057367c4a53f4e6cc770235dc4`; its embedded JS bundle is `e0bc58df57a04431f4423f02c803767b01ca6418d48f54430fb4bdee32c2b961`. Its current generated sourcemap has 337 app source entries, all byte-equal to tracked files at `23905a9`. The emulator's installed `com.mator.e2e` APK also hashes to `c3f394d8…` (Pixel_9_API_35, API 35). This does not recover or verify the requested `9e05a350…` binary.

The replacement file's full checksum was independently rechecked during the journey inventory. The shared branch had meanwhile advanced to documentation-only `a948557de46ce9ee2d5c0c0d0944132e9387bcf3`, parent `23905a9`; this inventory did not create that commit. Its commit message records the replacement APK's build source as `23905a9`. The original checksum observation above has no separately preserved command log in this package and does not close the original source-provenance gate.

## Scenario status

| Scenario | Status | Evidence |
| --- | --- | --- |
| Requested APK checksum | verified | Full SHA256 recorded above at first observation |
| Requested APK frontend source SHA | blocked | Original binary and its source map are unavailable |
| Flow/mock source SHA for the verified candidate | verified | `5da6971e7e9e6d74926a20ee17437a7290f6cfc5`; flow and mock file hashes in [provenance](candidate-build/provenance.md) |
| Flow-12 then flow-13, pair 1, on the frozen replacement candidate | verified | [Pair-1 JUnit and evidence](candidate-build/provenance.md#executed-local-flows); the initially mis-invoked wrapper attempt is disclosed separately |
| Flow-12 then flow-13, pair 2, on the same APK | verified | [Pair-2 JUnit and evidence](candidate-build/provenance.md#executed-local-flows) |
| Exact-source CI | not-verified | [Run 42763400382](https://github.com/Muhammadninja/MatorUI-/actions/runs/42763400382), correct head SHA and `rebuild_apk=true`; result pending |
| Real-backend order idempotency | not-verified | Loopback mock assertions do not establish server behavior |
| PR #16 merge/publication | not-verified | Pending by owner instruction; no merge, publish, or release action performed in this task |

Previously recorded passing pairs in [the QA resume index](index.md) used a different APK (`a68b3474…`, source `41ab8a3…`) and do not satisfy this combined-RC request. No evidence from those runs is relabeled here.

## APK reuse boundary

The E2E workflow cache key includes application, asset, and native/build inputs; Maestro flows and standalone mock fixtures execute outside the APK. This candidate therefore ran CI with `rebuild_apk=true` after both local pairs passed. The workflow must report frontend source SHA, mock/Maestro source SHA, and APK checksum separately; final CI status and artifact hashes are pending in [run 42763400382](https://github.com/Muhammadninja/MatorUI-/actions/runs/42763400382).

## Backend employee acceptance steps: production order idempotency

Keep this separate from the mock flow result. Use a backend-owned staging environment with a dedicated test account, test payment/shipping configuration, and access to server-side order records. Never use the production checkout for these checks.

1. Confirm the deployed backend commit/build identifier and the actual idempotency contract: key scope, retention window, payload conflict behavior, and response returned for a duplicate key.
2. Submit one valid staged order with a unique key. Record the key hash or redacted key, request correlation ID, resulting order ID, and initial order-row count.
3. Replay the identical request with the same key after a normal response. Require the same order identity/result and exactly one persisted order; verify no second payment authorization or inventory decrement.
4. Replay after forcing an ambiguous client outcome (server commits, response is dropped) and retry from the client with the same stable key. Require one persisted order and the original result.
5. Repeat from a fresh app process and a second device/client using the same account and key. Require one order across processes/devices, with server-side evidence.
6. Send a changed payload with the same key. Verify the documented conflict/rejection behavior and confirm that it neither mutates nor duplicates the original order.
7. Send a valid changed order with a new key. Require exactly one additional order, demonstrating that deduplication is key-scoped rather than globally suppressing legitimate orders.
8. Check concurrent duplicate submissions with the same key; require one durable order under a server-side transaction/unique constraint or equivalent atomic mechanism.
9. Attach sanitized API responses, backend logs/correlation references, and before/after order counts. Remove bearer tokens, phone numbers, addresses, payment data, and other PII. Mark accepted only after backend-owned evidence shows the invariants above.

## Remaining gates

- The exact requested `9e05a350…` APK remains unavailable and source-unverified. The replacement was selected because the old `c3f394d8…` APK source `23905a9` predates later app changes. It is not represented as the requested original binary.
- Two ordered local flow pairs passed with original assertions preserved. The first flow-12 attempt's Maestro test passed but wrapper capture failed due to an absolute artifact path; that attempt and correction are disclosed in [provenance](candidate-build/provenance.md).
- Confirm CI's final frontend source SHA, separate mock/flow SHA, and APK checksum when run 42763400382 completes.
- Obtain backend employee evidence for real order idempotency; the local mock is insufficient.
- Complete the final iPhone check before the targeted November 20 App Review submission. Screenshots alone do not establish release readiness.
- PR #16 merge/publication remains pending; no external message, merge, publish, OTA, store submission, or release action was made.

## Journey inventory

See the [coverage matrix](journey-coverage.md) for expected results, failure cases, existing test paths, requirement sources and missing scenarios. Reviewed flow/mock source is `23905a9b542519114e47f516b6bbf9dd99e74a34`; this is an inspected source version, not an executed flow/mock SHA for the unavailable original APK. The running backend used by these local E2E scenarios is the standalone mock; the currently deployed real backend version was not reverified.
