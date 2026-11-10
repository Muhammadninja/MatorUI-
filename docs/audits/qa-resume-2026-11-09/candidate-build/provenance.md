# Frozen combined candidate — local Android QA

**Current result:** both required local Android/mock flow pairs passed on the same pinned APK. This verifies the dedicated E2E build and its mock contracts; it does not verify the production backend or establish release readiness. GitHub Actions run [42763400382](https://github.com/Muhammadninja/MatorUI-/actions/runs/42763400382) was dispatched against the exact candidate with a fresh APK build and is **in progress** as of 2026-11-10 05:38:36 UTC.

## Candidate and APK provenance

| Field | Value |
| --- | --- |
| Frozen frontend source SHA | `5da6971e7e9e6d74926a20ee17437a7290f6cfc5` |
| Source branch | `claude/rc-startup-integration`; app, tests, mock and Maestro source clean at the frozen SHA |
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

The remote candidate branch was absent before upload. The current remote `design/teal-explore-home` tip `d62ed71114eb39dbe0afe876e789d217dc3edfd2` is an ancestor of the candidate. A non-force push created only `claude/rc-startup-integration` at `5da6971`; no PR was merged and no release/publication action was taken. Workflow run [42763400382](https://github.com/Muhammadninja/MatorUI-/actions/runs/42763400382) is `e2e-android`, has verified `headSha=5da6971e7e9e6d74926a20ee17437a7290f6cfc5`, and was dispatched with `rebuild_apk=true`. Record its final CI APK SHA and the separate frontend source SHA and mock/Maestro source SHA here after completion. CI is not yet a pass while the run is in progress.

## Remaining release gates

- Real-backend production order idempotency remains **not verified**; use the [backend employee steps](../combined-rc-acceptance.md#backend-employee-acceptance-steps-production-order-idempotency).
- Final functional iPhone and localization work remains in the [remaining-gap checklist](../final-iphone-checklist.md). The CI job and these Android mock flows do not replace it.
- PR #16 merge/publication and any store submission remain pending.
