# Claude findings follow-up and integration queue

Updated 2026-11-03. Candidate branch `codex/functionality-audit-2026-11-03` is saved in the permanent project Git repository. The checkout moved from `/private/tmp/mator-functionality-audit` to `/Users/muhammadfotihabdullaev/Desktop/matorui/.local/worktrees/functionality-audit`. The `.local` location is ignored by Git and blocked from the parent project's Metro index. It is a frontend worktree only: no backend/database was started.

**Simulator reservation:** Claude owns the shared running simulator. No simulator/computer interaction was performed in this follow-up. Release of that reservation has not been received. No screenshots, account mutations, orders or payments.

## Claude's six findings

| Finding | Candidate result | Evidence | Real/native status |
|---|---|---|---|
| Set active can report success before confirmation | Backend mutation is awaited before updating/persisting the active pin. Rejection propagates; screen shows the existing localized failure, without success/navigation. Same-event taps are guarded. Existing `skipBackend` callers still work after their own confirmed server change. | `contexts/active-vehicle-pin.test.tsx`: rejected operation retains old pin/storage; deferred operation changes scope only after confirmation. Screen handler reviewed. | not-verified; simulator reserved |
| Mark all read reports success early | Hook returns confirmed/failed/ignored only after completion; screen waits. Failed action rolls back and shows localized failure. Duplicate or superseded account actions show no false success/failure. Pending locks are per account. | `tests/account-query-isolation.test.tsx`, `tests/notification-screen-feedback.test.tsx` | not-verified; do not change real unread data solely to manufacture a test |
| Failed notifications look empty | Error branch renders localized load failure and Retry before the empty-list branch. Successful empty feed remains empty. | `tests/notification-screen-feedback.test.tsx` | not-verified; no injected integration failure/mock response |
| Rapid favorite taps can show wrong message | Toggle computes and stores intended set synchronously in a ref, then schedules React state. Return values match add/remove intent before rendering. Storage format and legacy data are unchanged. | `tests/likes-rapid-taps.test.tsx`: batched add/remove/add and existing-item removal | not-verified; global favorites/backend sync issue remains separate |
| Guest private deep links fail | Eight route wrappers keep private children unmounted while restoring auth or in guest mode; use existing sign-in prompt/components. Sign-in opens over the gate, so dismiss returns to it. A→B remounts private screen local state. | `tests/authenticated-route.test.tsx`: 12 tests, including actual route wiring | not-verified; guest routing in combined current app queued |
| Tracking may have blank body; VIN finder lacks exit | Missing tracking ID becomes `not_found`, with shopping recovery and no useless undefined-order refresh. Generic localized request failure replaces raw server text. VIN has a labeled Back action and Home fallback on cold deep link. | `tests/account-query-isolation.test.tsx`, `tests/route-navigation-states.test.tsx` | not-verified. Visible VIN Finder entry placement remains Claude's design decision; existing Garage VIN-add flow is unchanged. |

The eight guarded routes: order-history, track-order, shipping-addresses, edit-profile, checkout, order-confirmation, vehicle-detail and add-vehicle. Public catalog, guest garage/profile and notification empty-state access remain available.

The added auth/error/exit paths reuse current components and theme tokens. No redesign, native configuration, dependency changes or backend edits. The two new notification messages were added in RU/UZ/EN; key coverage passed.

## Earlier frontend fixes: do not apply twice

Compared Git history/source against `codex/frontend-release-readiness` at `273bcf4` and `codex/favorites-sync` at `a4b095e`. None of those branches was merged or cherry-picked into the design worktree.

| Earlier work | Overlap with this candidate | Integration disposition |
|---|---|---|
| `eea9b09` auth newest complete session | Both use atomic `auth_v3_session`. Earlier ordering field was `writtenAt`; candidate initially used `revision`. | Keep **one** auth-storage implementation. Candidate now accepts both formats and writes equal fields, retaining serialized save/clear. Nine added cross-format tests cover ordering and migration. Do not cherry-pick the old implementation over it. |
| `a549566` search request isolation | Both implement request generations, immediate invalidation, pagination lock/cancellation and vehicle-scope refresh. | Retain candidate hook/tests; do not layer another generation/debounce implementation. Review old tests for missing scenarios if integrating further historical work. |
| `34ccd8f` checkout safety | Earlier synchronous pending/completed guards and no order retry overlap candidate's session-aware submission lock and HTTP write policy. | Retain one submission lock. Candidate includes the earlier empty-cart guard. Old per-order no-retry patch is redundant under candidate's transport-wide no-write-replay policy. No server idempotency claim. |
| `2e83baa` release payload logging | Both disable release API payload logging. | Keep candidate logger once; it also masks structured PII and the depth-limit subtree. Do not apply a second logging switch. |
| `40416c0` / `d981caa` favorites sync; `7cc1208` / `a4b095e` archive correction | Full owner-scoped sync already exists historically, while this candidate fixes only legacy provider's synchronous return. | Reuse historical full sync once the employee confirms deployed favorites API. Do not build a second sync engine. `7cc1208` and `a4b095e` have identical stable patch ID `e0ea39f87def5f53bf0bbb9dafe7eb6e5ed0979b`; apply one, with its prerequisites. Drop the interim legacy provider change when replacing it with that full provider. Preserve archive-only legacy handling; never auto-import it. |
| `adcf2c4` runtime fixture extraction | Separate historical release cleanup, not part of this candidate. | Do not cherry-pick the whole readiness branch just to obtain these fixes. Review it separately against current services and test imports. Do not start its local HTTP fixture harness. |
| `3054ee0` guest Profile login | Changes guest Profile's login destination; does not guard direct private deep links. | Preserve it. New route guards address a distinct gap and keep its existing sign-in/dismiss flow. |

Auth revision compatibility is unit-verified, not a real token migration on the shared app. Existing plaintext fallback and best-effort storage deletion limitations are unchanged.

## Overlap coordination

Compared the design changes at `4f5d05c` (following `f04772e`) to base `9a64a98`. Shared filenames are notifications-screen, vehicle-detail-screen, track-order-screen, vin-finder, and RU/UZ/EN locales. Our changes target handlers/error-state selection/exit only. Claude's font sizes, gutters, toast presentation and other design changes must remain.

The planned file ownership and simulator reservation were posted in project coordination memory, namespace `coordination`, key `mator-codex-functionality-2026-11-03`. This is a handoff notice, **not an acknowledgement** from Claude. No design worktree edits or integration occurred. Its dirty auth/user/compatibility work is left untouched.

`track-order-screen.tsx` contains a pre-existing literal NUL in a translation fallback, so Git reports it as binary. Review with `git diff --text`; at integration manually combine the three functional changes with Claude's typography changes, rather than choosing one whole file.

## Short combined smoke test — queued

1. Obtain Claude's explicit design completion and simulator release; identify the exact design SHA and all remaining dirty changes. Agree on overlapping hunks and a combined branch. Apply each logical implementation once using the matrix above; preserve design. Keep both source branches for rollback.
2. Run targeted tests for conflict-resolved files, typecheck and an iOS bundle check. If no conflicts/change in unaffected areas, do not rerun the unchanged full suite. Record combined frontend SHA and employee-supplied running backend version.
3. Using only the existing current iOS app + real API/existing data, coordinate loading the combined version on the same simulator. Record the loaded JS SHA; old running-app observations cannot verify the candidate.
4. Read-only smoke: Home → catalog → product → search (change query/sort/filters, pagination where backend supports it), garage/active-vehicle display, favorites/cart display and totals, notifications loaded state, existing order history/tracking, checkout up to review only. Check new VIN Back/fallback and missing-order recovery. No orders or payments.
5. Exercise guest gates only in an already-available guest session or with owner-coordinated session handling; do not discard the owner's current session to manufacture it. Check sign-in dismissal returns to the gate and authenticated access resumes correctly. Cold-start/session migration requires a coordinated existing session; no fabricated credentials or mock responses.
6. Confirmation failures, read-all and favorite/garage mutations remain unit-verified until a safe real-data scenario is available. Do not mark real notifications read, alter saved favorites, or change the active vehicle solely for a test if their original state cannot be restored without side effects. Do not manufacture errors through a mock/local backend. If unavailable, retain not-verified rather than invent coverage.

Remaining blockers: simulator reservation/design acknowledgement, combined integration, running-version identification, actual backend search/favorites contracts and behavior, real session migration, visible VIN entry placement, safe live confirmation-action checks, and native release/Android verification. Earlier screenshots or successful JS exports do not close them.
