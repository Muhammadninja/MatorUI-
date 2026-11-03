# Coordination with Claude

Base `9a64a98`, isolated branch `codex/functionality-audit-2026-11-03`. No changes were integrated into the dirty `design/teal-explore-home` worktree.

At inspection Claude's working changes included `contexts/user.context.tsx`, `components/screens/checkout-screen.tsx`, auth screens/services, garage/detail/explore/notification screens, shared toast, and locales. Those files were not edited here. This candidate changes only functional hooks/services, active-vehicle context, tests and this package. No restyling or dependencies; follow-up adds existing-component guest/error/exit paths.

Before cherry-picking, coordinate these touchpoints:

- Checkout screen calls `useCreateOrder`. Its contract still returns a result for the first successful caller and null on failure; now duplicate/already-success callers also return null. Keep its `if (!result) return` guard. Success remains locked while Payme is open; reset must only be deliberate, never while placing. Address/shipping validation and cart-pending gating require a joint screen review; do not overwrite Claude's version.
- Auth storage now uses `auth_v3_session` atomic encrypted envelopes plus revisioned fallback, retains legacy reads and migrates on save. Test real cold-start/refresh/sign-out before integration; do not erase existing session data. The old plaintext fallback remains.
- Auth context must continue invalidating HTTP request epochs on account/session changes. New read query keys append owner ID; exported key functions remain prefixes, so existing invalidateQueries calls still work. Any direct exact-key cache read/write introduced by design work must include owner.
- Garage active context now preserves fitment overrides only when the same pinned vehicle remains present. Search reruns on changed vehicle scope.
- Production bundles no longer permit `EXPO_PUBLIC_DEBUG_API=1` to enable payload logs. Development can still disable them with `0`.
- Current simulator was being navigated concurrently. Reserve exclusive control before native checks; no new simulators are needed. Do not reload it onto this branch without coordinating the current design session.

Pending native checks must use the existing real API/data. Unit test doubles are used only in tests, never introduced into the application or integration checks. No screenshots needed under the latest instruction.

Latest authoritative integration matrix, overlap inventory, permanent checkout path and smoke queue: [FOLLOWUP.md](FOLLOWUP.md). Do not cherry-pick both historical and current implementations for auth/search/checkout/logging. Simulator reserved for Claude until explicitly released.
