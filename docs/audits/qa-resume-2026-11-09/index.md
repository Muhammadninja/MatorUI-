# MATOR focused QA resume — 2026-11-09

Work in progress. Deterministic Android loopback/mock evidence only; this is not production verification or release acceptance.

## Starting state

Remote QA tip `df1d0697c44ba143a112da4e9f9de12654a55548` and RC tip `d62ed71114eb39dbe0afe876e789d217dc3edfd2` unchanged at resume. Latest QA run remains failed 42424513328; flow-13 did not execute there. Main advanced to `5261e16b944d59d78d5e2712f6a4309c34c7447a` (phone-change fix); unrelated offline-order-cancel branch exists. Original workspace modifications preserved. Cart worktree contains the pre-existing uncommitted Profile root-slot navigation reset. RC temporary worktree is absent, with its branch preserved.

## Binary under test

Dedicated `com.mator.e2e`, Pixel_9_API_35 / Android API 35 arm64 emulator. EN, light theme. API is the standalone loopback mock from cart worktree; synthetic accounts only. No production mutations.

Preserved APK SHA256: `817364f30268df98aff7f787678033078466d81c62ab1b3ab085f2abee5f06a9`.
Embedded bundle SHA256: `e846cbe58998c8109ac58abcb303d5a8f0e34917eabead0520160018f4f75ee8`.
Embedded bundle equals local generated release bundle. All 311 checked app/component/context/hook/service/theme/utility source-map entries match working-tree source. Source is `df1d069` plus the uncommitted Profile reset; do not label this a clean-commit APK.

## Scenarios

| Scenario | Status | Evidence |
| --- | --- | --- |
| Round 1 flow-12: account isolation, normal cold launch, cold deep link | verified | [JUnit](round-1-flow-12.xml), [scrubbed route log](round-1-flow-12-mock.log), [final Favorites screenshot](round-1-favorites.png) |
| Pre-fix round 1 flow-13 | verified | [JUnit](round-1-flow-13.xml), [mock route log](round-1-flow-13-mock.log), [confirmation screenshot](round-1-checkout.png) |
| Pre-fix round 2 initial startup | error | [JUnit](pre-fix-round-2-flow-12.xml), [empty hierarchy and focus log](pre-fix-blank-startup.log), [blank frame](pre-fix-blank-startup.png); flow-13 not run |
| Post-fix startup and repeated flow acceptance | not-verified | Dedicated APK rebuilt; verification in progress |
| Combined RC SHA | not-verified | Pending reconciliation and acceptance |
| Real-backend order idempotency | not-verified | Unresolved; mock deduplication cannot verify production behavior across retries, restarts or devices |

The Favorites screenshot is authenticated A, final restored favorites state, Android API 35, EN/light, source and data as above. It contains synthetic product data only and no contact fields.

## Targeted baseline checks

Executed on cart worktree before new edits: typecheck passed; routing, environment/release and production transport tests: 46 passed; mock contract tests: 5 passed after allowing loopback binding (initial sandbox run could not start mock); order submission/idempotency and HTTP no-retry tests: 6 passed. These are local test results, not production checks.

## Divergence review

Neither QA nor RC tip contains the other. Merge preview conflicts: CI artifact upload allowlist, useCreateOrder, and error diagnostics. Preserve RC error codes/session safety, dedicated-process diagnostic privacy, exact-source provenance, and QA stable order keys plus all meaningful order-count assertions. Current RC cart excludes delivery until checkout and requires server fee/quote fields; combined mock and flow expectations must follow that contract.

## Reproduced blank startup and focused change

The second pre-fix flow-12 failed before the English language picker on a cleared dedicated app (36 seconds total). The process was resumed, the UI hierarchy was an empty FrameLayout under android:id/content, no JS/native error was logged, and config/catalog reference calls appeared twice. This reproduces the blank startup independently of account switching.

Code review identified navigator remounts during local auth hydration: Likes key changed from auth-pending to guest even for a new guest; restoring a cached profile also changes Cart owner. React Navigation clears nested state on navigator unmount, racing the initial redirect/native stack attachment. This is a code-supported failure mechanism; repeated post-fix execution is required for acceptance.

The checkpointed exploratory implementation keeps the outer Cart and Favorites context providers and screen subtree mounted. Each original keyed state controller is now a sibling of the screen subtree, publishing its memoized value in a layout effect. Existing controller keys, hydration waits, sync-engine stop, and mutation invalidation remain. A synchronously selected empty/non-actionable fallback prevents the previous owner from appearing during transitions. Unique transition tokens reject late publications, including A -> B -> A and deferred state updaters. Sign-out retains the focused root-slot navigation reset.

A discarded mount-gate experiment instead opened Explore on a fresh launch: [JUnit](discarded-gate-startup.xml), [scrubbed hierarchy](discarded-gate-startup.log). Installed React Navigation useOnGetState drops nested linking state when its child navigator is absent; the root then defaults to its tabs anchor. No delayed navigator gate remains in source, and root layout is unchanged. This evidence explains why the final implementation preserves immediate navigator mounting.

Focused startup/session/likes/cart tests: 38 passed; order submission/HTTP retry/cart storage tests: 10 passed; typecheck passed. The new probe spans real Cart and Favorites providers, verifies one screen mount during guest/cached-owner hydration and account changes, blocks Favorites writes during hydration, and proves old-session publications cannot replace current state. The UserProvider offline regression confirms cached profile/session survive rejected /me. Dedicated Android incremental build succeeded in 36s (693 cached tasks); native/production configuration is unchanged.

Current APK SHA256: `f6237f5103f77b81d2ed9f2b8c41e8806481c071d63841cbada94281e9d9a5b0`. All 313 checked app-source-map entries match the working tree. The APK was built before checkpoint commits; its 313 checked app-source-map entries match checkpoint f7f0f02. This is source-content equivalence, not a clean-at-SHA build claim. Required flow pairs restart on this binary; earlier passes are not counted toward final acceptance.

Screenshot metadata: pre-fix blank frame is fresh-launch guest; pre-fix confirmation is authenticated A, total 227190.72. Both are Android API35, EN/default light, df1d069 plus the Profile reset, loopback mock. Product/order identifiers are synthetic and no contact fields appear.

## Local checkpoint — investigation remains open

- `7fccf25`: pre-existing sign-out root-slot reset (one local pair passed, not accepted as final).
- `f7f0f02`: exploratory stable Cart/Favorites controller topology plus regression tests. Navigator remount prevention is verified by unit tests; causality for the native ANR is not established.
- `e094cb4`: evidence-integrity fix: reject screenshots older than the current Maestro execution. Does not change APK contents.
- No checkpoint has been pushed. Original workspace modifications remain untouched.

| APK SHA256 | Source contents | Observed result |
| --- | --- | --- |
| `817364f30268df98aff7f787678033078466d81c62ab1b3ab085f2abee5f06a9` | df1d069 + Profile reset; app-source equivalent to 7fccf25; binary was built before checkpoint | First full pair passed; next fresh launch had empty frame |
| `b8df3f918e29f5d0c5c8294d2a18024ebb3952596e20ee64217c4fb9cbb65e54` | Discarded navigator mount gate + Likes key experiment; never accepted/committed | Wrong initial route; discarded |
| `f6237f5103f77b81d2ed9f2b8c41e8806481c071d63841cbada94281e9d9a5b0` | Stable controllers + Profile reset; 313 app entries equivalent to f7f0f02; built before checkpoint | Language picker drawn but cold probe failed; later native ANR. No final passing pair |

### Failure A: empty startup frame

Exact sequence: preserved APK, Pixel_9_API_35 loaded from saved snapshot, normal animation scales, first flow-12/13 pair passed, then flow-12 launchApp(clearState:true) failed waiting 30s for English picker. [JUnit](pre-fix-round-2-flow-12.xml), [hierarchy/focus](pre-fix-blank-startup.log), [frame](pre-fix-blank-startup.png). Process was alive; no app error line captured. There is no contemporaneous ANR stack proving this is Failure B. Root cause remains under investigation.

### Failure B: native ANR

Exact sequence: stable-controller APK f6237f5 installed on same snapshot-loaded API35 AVD; a fresh-launch probe failed despite a drawn language screen, a subsequent selector-only probe passed, then unchanged flow-12 clear-state launch reached onboarding but failed before Profile sign-in. Android reported an unresponsive app. [Flow JUnit](stable-controller-snapshot-flow12.xml), [scrubbed UI/focus log](stable-controller-snapshot-flow12.log), [cold-probe JUnit](stable-controller-snapshot-startup.xml), [dedicated ANR main thread and pressure](api35-dedicated-anr.log).

ANR at 19:04:58 emulator time: focus input event timed out after 5003ms. Main thread was in Android MeasuredText.Builder.nInitBuilder / StaticLayout / ReactTextView.onMeasure / Fabric SurfaceMountingManager.updateLayout. This locates the stall, not its ultimate cause. Device pressure showed memory some/full avg10 19.07/14.69, CPU some avg10 52.39; system_server 62%, app 35%. Emulator used a 7487 MB saved-snapshot configuration, API35 Play Store arm64 image, 4 cores. Host had ample free pages when sampled later; later device MemAvailable was about 5.2GB. Pressure at failure and later free memory must not be conflated. Maestro client ran on local Java25; CI uses Java17. No evidence yet establishes Fabric bug versus runtime/resource/harness interaction.

### Next controlled reproduction

Cold-boot same AVD without loading/saving snapshot, memory 4096 MB, animations disabled as CI, preserve same f6237f5 APK. The first launch attempt was blocked while the old AVD shut down; retry succeeded. A prematurely started full pair was interrupted at owner instruction to focus on diagnosis (exit130; flow-13 not started), not counted as a failure/pass. Next collect direct ADB startup evidence without Maestro and compare matched conditions before changing application code or running full pairs again.
