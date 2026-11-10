# Frozen combined candidate — local Android QA

**Final local RC:** `claude/rc-startup-integration` at `f03e18a0af5e832afe3f614aac66fcc5caf7a225`. This includes the earlier Maestro scroll fix and the scoped client idempotency recovery change. CI [42884256820](https://github.com/Muhammadninja/MatorUI-/actions/runs/42884256820) passed Flow-12 and Flow-13, 1/1 each, with mock data on a fresh APK at `e77c124`; that APK predates the client idempotency change. The CI evidence remains valid for the exact `e77c124` build and the Maestro scroll fix, but does not verify the final RC checkout client. No full flow suite or new RC build was run for this handoff.

## Candidate and APK provenance

| Field | Value |
| --- | --- |
| Frozen frontend source SHA | `5da6971e7e9e6d74926a20ee17437a7290f6cfc5` |
| Source branch | `claude/rc-startup-integration`; app, tests, mock and Maestro source clean at the frozen SHA |
| Prior local RC before idempotency client integration | `claude/rc-startup-integration` at `e17c6415e14a8c988df9f1c4a12d61bc9a778257` |
| CI source tested | `e77c12410e5939639273f0f5c082325a0f6d5372`; identical app/build inputs to final RC; post-CI change is the same Maestro-only scroll step |
| Current local RC | `claude/rc-startup-integration` at `f03e18a0af5e832afe3f614aac66fcc5caf7a225`; includes frontend idempotency recovery, so e77 APK is not source-equivalent for checkout |
| Local APK | [`app-release.apk`](../../../../../../../.local/artifacts/rc/5da6971/app-release.apk), pinned read-only (`0444`) |
| Local APK SHA256 | `eeb3c5fd3f9f58435370399d940839874a103536ef01f37998215c45c1d71ed9` |
| Embedded JS bundle SHA256 | `b8ff21b2189b8f4aa810f1c520adf14bc2136f36946f21cf4ca7a454a6dc599c` |
| App bundle/source proof | Embedded APK bundle hash equals generated release bundle; 343 source-map entries under app/components/contexts/hooks/services/themes/utils/locales/config/constants/guards/providers/text/types/mocks matched frozen working-tree files byte-for-byte; 0 mismatches |
| Test package | `com.mator.e2e`, cleartext HTTP enabled only for the disposable loopback E2E app, deep-link scheme `mator-e2e` |
| Device | Pixel_9_API_35, Android API 35, arm64 emulator |
| Local build worktree | `.local/worktrees/rc-build-5da6971`, detached at the frozen SHA |
| Local backend/data | Standalone deterministic loopback mock, `http://127.0.0.1:8080`; synthetic accounts/catalog/orders; no production data or backend mutation |

The formerly requested APK (`9e05a350…`) was not available for source verification. The previously observed replacement APK (`c3f394d8…`) was built from `23905a9`; application code then changed through `5da6971`. Rebuilding this frozen candidate was required to test the current source. The immutable local file's hash and the installed emulator APK hash were both checked as `eeb3c5fd…` before pair 1 and again before pair 2. The pinned file and build-output APK still hash identically after the runs.

The local Gradle command used the workflow's dedicated E2E environment and release task, with `-PreactNativeArchitectures=arm64-v8a` for the arm64 emulator. Expo prebuild used `--platform android --clean --no-install`. Gradle ran under Temurin Java 17.0.18, matching the CI workflow's Java version. The successful full log is [gradle-jdk17.log](gradle-jdk17.log). Two earlier local attempts under Temurin Java 25 failed in CMake with `WARNING: A restricted method in java.lang.System has been called`; their complete logs were not saved. The successful Java 17 build completed 726 Gradle tasks (668 executed, 58 up-to-date) in 2m50s. No source, flow, assertion, dependency, or native project configuration was edited to make the build pass.

## Executed local flows

Flow source commit and mock/fixture source commit were both `5da6971e7e9e6d74926a20ee17437a7290f6cfc5` for both pairs. Flow YAML SHA256s are flow-12 `5c4825682368ab071df5d0f5ab55669811a10c6499635d2373953ebf9ab108ed` and flow-13 `59a5622207b4a1e9532b189cd3b9086f43826e58fe53bddbec3efcf3bacc61f7`; standalone mock server SHA256 is `45210d78f88424fac0c995757501c42dc6a3250835566f187d745ca612fce582`. No assertions were weakened or changed.

| Pair | Scenario | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Flow-12 Favorites/session isolation | **verified**, 1/1, 2m51s | [JUnit](pair-1/flow-12.xml), [mock routes](pair-1/flow-12-mock.log), [authenticated A Favorites after restart](pair-1/flow-12-final-favorites.png) |
| 1 | Flow-13 cart, checkout and order retry | **verified**, 1/1, 3m33s | [JUnit](pair-1/flow-13.xml), [mock routes](pair-1/flow-13-mock.log), [order confirmation](pair-1/flow-13-cart-checkout.png) |
| 2 | Flow-12 Favorites/session isolation | **verified**, 1/1, 2m26s | [JUnit](pair-2/flow-12.xml), [mock routes](pair-2/flow-12-mock.log), [authenticated A Favorites after restart](pair-2/flow-12-final-favorites.png) |
| 2 | Flow-13 cart, checkout and order retry | **verified**, 1/1, 4m06s | [JUnit](pair-2/flow-13.xml), [mock routes](pair-2/flow-13-mock.log), [order confirmation](pair-2/flow-13-cart-checkout.png) |

Flow-13 retained its existing amount, order-row, idempotency-key and request/post-count assertions, including failed-before-commit, slow failure with rapid taps, lost-response recovery and cart ownership. Mock results do not establish real-server idempotency.

### First flow-12 wrapper attempt

The first Maestro execution of flow-12 itself passed (JUnit 1/1, 207s), but `scripts/e2e.sh` returned an error after Maestro because the invocation gave an absolute `--test-output-dir` while the wrapper searched its relative `artifacts/` directory for the final screenshot. The wrapper output was `find: artifacts: No such file or directory`. Its JUnit, screenshot and scrubbed Maestro command JSON are retained in [pair-1](pair-1/); see [initial-run-note.md](pair-1/initial-run-note.md). This attempt is not counted as one of the two accepted pairs. The command JSON has synthetic phone values replaced with `[TEST_PHONE]`. The first attempt's mock route log was overwritten by the corrected invocation and is not available; the wrapper failure evidence and pass JUnit remain intact.

All saved text logs and reports were checked for phone numbers, bearer tokens and service token strings. Screenshots show only synthetic catalog/order data and no customer contact or address fields. Screenshot metadata: flow-12 captures the authenticated synthetic A Favorites screen after process restart/deep-link checks; flow-13 captures the synthetic order confirmation after checkout. Both are Android Pixel_9_API_35/API 35, English, light appearance, candidate source `5da6971`, loopback mock data.

## CI run

The remote candidate branch was absent before upload. The current remote `design/teal-explore-home` tip `d62ed71114eb39dbe0afe876e789d217dc3edfd2` is an ancestor of the candidate. A non-force push created only `claude/rc-startup-integration` at `5da6971`; no PR was merged and no release/publication action was taken. Workflow run [42763400382](https://github.com/Muhammadninja/MatorUI-/actions/runs/42763400382) is `e2e-android`, has verified `headSha=5da6971e7e9e6d74926a20ee17437a7290f6cfc5`, and was dispatched with `rebuild_apk=true`. Its provenance step recorded frontend source SHA `5da6971e7e9e6d74926a20ee17437a7290f6cfc5`, mock/Maestro source SHA `5da6971e7e9e6d74926a20ee17437a7290f6cfc5`, and fresh CI APK SHA256 `90e592457ee74be74f60ccfe773b3d156a29d4c7dc7988d0f8a8f1e65a7dae1b` (CI artifact is a separate build from the local arm64 APK).

### CI failure handoff

- **Result:** Flow-12 favorites isolation passed 1/1. Flow-13 cart/checkout failed 1/1. The workflow failed at `2026-11-10 06:18:15 UTC` (job duration 39m48s).
- **First failing command:** `MOCK_LOG=/tmp/mator-e2e-cart-mock.log bash scripts/e2e.sh .maestro/flows/flow-13-cart-checkout.yaml --format junit --output maestro-report-cart.xml --test-output-dir artifacts`.
- **First assertion:** `Assertion is false: id: item-detail-screen is visible` (Maestro reports Flow-13 failed after 3m45s). This is the first observed failing assertion; do not infer its cause from the result alone.
- **Available evidence:** the downloaded `maestro-results` artifact in `/private/tmp/flow13-ci-42763400382/` includes the scrubbed Flow-13 JUnit and mock route log. On failure, the wrapper also appended a scrubbed Android UI hierarchy to that log. No Flow-13 failure screenshot was uploaded. The local pair-1 and pair-2 evidence remains above.
- **Diagnosis:** CI reached B's second catalog add. Its final hierarchy still showed `parts-directory-screen`; `part-card-mann-fuel-filter` was clipped to `[76,2178][1004,2274]` on a 2274-pixel screen, and there was no fuel-filter detail request after the tap. Both local passes did make that detail request. The edge-clipped tap is the supported explanation for the missed navigation; the artifact does not show the exact touch dispatch.
- **Scoped fix:** commit `e77c124` adds `centerElement: true` to `scrollUntilVisible` in `.maestro/subflows/cart-add-from-catalog.yaml`. Maestro's documented option continues scrolling until the target is away from the viewport edge. Cart and checkout assertions and app code are unchanged.
- **Local check:** the exact pinned APK (`eeb3c5fd…`) remained installed; Flow-13 passed 1/1 in 3m10s with the changed subflow on Pixel_9_API_35 and the loopback mock. `npm test -- tests/e2e-mock.test.ts` passed 6/6; `git diff --check` passed. The focused JUnit is `/private/tmp/flow13-local-check.xml` and mock log is `/private/tmp/flow13-local-check.log` (temporary, not saved to the repository).
- **Confirming CI:** isolated branch `codex/flow13-ci-fix` points at `e77c12410e5939639273f0f5c082325a0f6d5372`. [Run 42884256820](https://github.com/Muhammadninja/MatorUI-/actions/runs/42884256820) was dispatched once with `rebuild_apk=true` and succeeded. Flow-12 JUnit: 1/1, 198.5 s; Flow-13 JUnit: 1/1, 291.1 s. The uploaded provenance records both frontend and mock/Maestro source at `e77c12410e5939639273f0f5c082325a0f6d5372`, forced fresh build, and CI APK SHA256 `2d502930c6b7d25d481d088ae549a8616bf9a7f2aa2a65aea1297f62433cf6c7`. The downloaded artifact is in `/private/tmp/flow13-ci-42884256820/`; the durable run artifact includes both JUnit reports, build provenance and final screenshots. No more CI retries are needed for this fix.

## Idempotency handoff after the verified mock CI run

- Backend implementation: `codex/orders-idempotency-release` at `1ae88e3cc53327b6f95b1b168c4802d972fe2dd0`, based on reconciled `23083756c688a7f1ca8709ef7f50a08792b74210`. Release documentation/checklist commit: `f45346f1ae615ea4782c651738ce3364ea042a43`.
- Frontend recovery commit integrated into the local RC: `f03e18a0af5e832afe3f614aac66fcc5caf7a225`. It persists the key and original request together, replays that payload after edits/restart, and fails closed at the 30-day expiry pending reconciliation.
- Focused frontend evidence on the final source: `npm test -- tests/order-submission-safety.test.ts` passed 6/6; `npm run typecheck` passed; `git diff --check` passed. The new remount regression changes current fields and empties the cart, then asserts the original key and request are replayed.
- Isolated PostgreSQL 15.15 backend evidence and migration/deployment checklist are recorded in `Backend/docs/ORDER_IDEMPOTENCY.md` in the separate backend checkout: six selected integration checks passed. The broader concurrency suite is not reported as passing; its unrelated offline-collection fixture failed on a missing `admin_audits_actor_id_fkey` actor fixture.
- Existing Flow-12 CI remains evidence for `e77c124` and the unaffected flow behavior. Flow-13 CI remains evidence for the scroll fix on `e77c124`; it does not verify idempotency recovery in `f03e18a`. Real deployed API behavior remains unverified.

## Remaining acceptance (not verified by mock E2E)

- **Backend owner:** verify idempotency on the deployed backend; record deployed version/build, test cases, and log/request evidence. Production order creation is backend-owner controlled. Missing: real API replay, lost-response, concurrent and conflict evidence.
- **Frontend QA / owner:** final iPhone pass for session persistence, Garage, favorites, cart, exact checkout totals before submission, notification navigation, RU/UZ, and light/dark. Missing: confirmation of the installed iPhone build's source/build provenance and results against `f03e18a`; no device changes/builds were made for this handoff.

## Remaining release gates

- Real-backend production order idempotency remains **not verified**; use the [backend employee steps](../combined-rc-acceptance.md#backend-employee-acceptance-steps-production-order-idempotency).
- Final functional iPhone and localization work remains in the [remaining-gap checklist](../final-iphone-checklist.md). The CI job and these Android mock flows do not replace it.
- PR #16 merge/publication and any store submission remain pending.
