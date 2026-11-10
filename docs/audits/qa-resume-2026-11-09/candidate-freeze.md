# Candidate freeze, 2026-11-10

**Frozen application SHA: `5da6971e7e9e6d74926a20ee17437a7290f6cfc5`**
- Branch: `claude/rc-startup-integration`. It's local and **not pushed**. `origin` has no ref by that name.
- Written by Claude at Codex's request, relayed by the owner.
- Claude acknowledges the request: **application edits on this branch are frozen** until Codex reports its verification result in the coordination log of [journey-coverage.md](journey-coverage.md).

## Source status

- `git status --porcelain -- . ':!docs'` shows **0 entries**, so application, test, config, mock and flow sources are clean at the frozen SHA.
- The only changes in the working tree are docs under this folder: `index.md` (modified), `combined-rc-acceptance.md`, `final-iphone-checklist.md`, `journey-coverage.md` and this file. Codex wrote the first four. This file is left untracked on purpose, so the frozen HEAD doesn't move.

## What's included

The candidate is `origin/design/teal-explore-home` (PR #16) plus 28 commits. These are the startup fix merge, the RC mock and flow contract fixes up to `f1e9981`, and the following commits. All of them were authorized by the owner on 2026-11-09 or 2026-11-10.

| Commit | Change | Checks at commit time |
|---|---|---|
| `23905a9` | The Added check stays outlined: `AppIconButton` no longer passes `fill={undefined}` | Regression test fails on the old code. Android mock screenshots: [`added-icon-fix-2026-11-09/`](../added-icon-fix-2026-11-09/) |
| `a948557` | Evidence for that fix only (docs) | — |
| `7af6e8b` | A coming-soon brand tap shows an info toast. The comingSoon modal is removed. The existing en/ru/uz keys are reused | Typecheck, full suite |
| `23881aa` | Empty cart: no catalogue button. The Garage tab uses `CarFront` | Typecheck, full suite |
| `72fc4f7` | Dark-mode liked heart is black on the white row photo. It's the same diff as the main checkout's uncommitted edit, applied cleanly to the same base `8d83a42`, and that copy is left untouched | 72 targeted favorites and catalog tests, typecheck |
| `5da6971` | Push taps are routed from the backend's `data.deeplink` and `order_id`/`vehicle_id`, through the same destination as the in-app feed. The legacy `deeplinkPath` still works | 10 new tests; 28 notification tests |

At `5da6971`: typecheck is clean, **1,778/1,778 tests** pass in 122 files, and token lint is clean.

To Claude's knowledge, no authorized app change is outside this SHA.
- The dark-mode heart edit still sits uncommitted in the main checkout (`codex/favorites-e2e`). It's identical, already included here, and wasn't touched.
- The notification change needs **no backend change** (see below).

## Notification link vs the backend contract

Checked against the backend at `mator.uz` `origin/main` `23083756`:
- The inbox API returns `deeplink_path`, which the app already read.
- Push (`expo.provider.ts`) sends `data: { ...rowData, notification_id, type, deeplink }`.
- The backend's links are tab routes (`/(tabs)/(cart)/order-confirmation` with no id, and `/(tabs)/(garage)/vehicle/<id>`). The feed deliberately replaces those with root routes (`/track-order?orderId=`, `/notification-vehicle?id=`).

So the app now builds the feed's notification from the push data, and stored notifications and older payloads keep working.

**Not covered:**
- A tap that launches the app from a terminated state. The listener used may not receive that launch response. It's untested, and it's an existing limitation.
- Device delivery hasn't been verified, because that needs a real push.

## Builds, emulator and mock

- **Claude:** no build, APK replacement, emulator or mock use while Codex verifies. Claude's last build was `c3f394d8…` at 2026-11-09 23:42, from `23905a9`, and it's **stale** for this SHA. Claude hasn't touched `android/app/build/outputs` since then. A Gradle daemon (pid 4425) from that build may still be idle. Claude will leave it alone unless Codex asks.
- **Codex:** builds and preserves one APK from `5da6971`, verifies its checksum before each ordered 12 → 13 pair, keeps the assertions unchanged, and runs CI at the same source.
- **The owner asked for a separate build directory and an immutable APK location.** Codex is the one building now. Claude suggests `.local/worktrees/rc-build-5da6971/` and a read-only `.local/artifacts/rc/5da6971/`, with the source SHA and SHA-256 recorded.
- **Visual checks:** Claude's pending checks (the icon, coming-soon toast in ru and uz, empty cart, Garage tab and dark-mode heart) wait until Codex reports. They'll then use **Codex's preserved APK**, with no rebuild. Android and iOS will be recorded separately. iOS can't be built locally (Swift 6.3 blocker). An EAS iOS build needs the owner's approval.

## Still pending

PR #16 merging and publication. Real-backend order idempotency. The final iPhone check (November 20 target). Any app edit during verification will be posted in the coordination log before it's made.
