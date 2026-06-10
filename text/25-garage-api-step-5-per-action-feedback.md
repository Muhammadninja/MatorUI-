# Step 5 — Per-action mutation feedback on vehicle-detail

## What this step adds

Visual feedback on **every individual mutation** triggered from the
vehicle-detail screen. Before this step the user could tap "Set as
primary" or confirm "Remove" and see nothing change for ~250ms+ while
the request was in flight. Worse: nothing prevented them from tapping
"Remove" *then* "Set primary" *then* "Edit" before the first mutation
resolved — three concurrent operations against the same vehicle, races
guaranteed.

After this step:

- The action that triggered the mutation flips its label ("Setting…" /
  "Removing…") so the user has explicit confirmation that work is
  happening.
- Every other action row is muted while one is mid-mutation, so
  concurrent operations are impossible.
- The pending state is cleared in `finally`, so a thrown mutation
  still re-enables the UI rather than leaving the screen frozen.

## Files changed

| File | Change |
|---|---|
| `components/screens/vehicle-detail-screen.tsx` | New `pendingAction: 'remove' \| 'set_primary' \| null` state. `handleSetPrimary` + `handleRemove` set/clear the pending state in a `try/finally`. Action-row labels conditional on `pendingAction`. Sibling rows muted while any mutation is in flight. Bonus: bundled the taste-pass `strokeWidth={2.1}` → `strokeWidth={2}` on all five icons (the icon ratings I flagged in the taste audit). |

## Correcting an earlier finding

The original API readiness audit flagged
"`AddVehicleWizard` declares `saving` but never uses it". That was
incorrect — the wizard's `handleSubmit` (`add-vehicle-wizard.tsx:96-125`)
correctly:

- Guards re-entry via `if (saving) return;`
- Sets `setSaving(true)` before `await onSubmit(...)`
- Sets `setSaving(false)` in `finally`
- Surfaces the state to `AddVehicleWizardFooter` via
  `canAdvance={!saving}` and `saveLabel={saving ? 'Saving…' : …}`

The wizard's saving UX was already correct. The real gap was the
sibling vehicle-detail screen, where the same discipline wasn't
applied. Step 5 closes that gap.

## Why per-action label flip instead of a global busy spinner

Two simpler alternatives existed:

1. **Global mutation indicator** — a top-of-screen bar or overlay
   spinner reading "Updating…" whenever `isMutating` is true.
2. **Disable all actions when `isMutating`** — single boolean from the
   hook, applied uniformly.

Both work, but they're less informative. The label flip ties the
visual state to the specific action the user took — "Setting…" is
unambiguous; "Updating…" is generic. The user knows their tap
landed and which operation is running.

Disabling sibling rows uses `muted` (the existing prop on
`VehicleDetailActionRow`), so the visual treatment is consistent with
how the Service-Log "Coming soon" row already looks.

## The `pendingAction` shape vs `hook.isMutating`

`useGarage()` exposes `isMutating` — true while ANY mutation runs.
`pendingAction` is a tighter local state — it answers "which
mutation is running, from THIS screen's perspective." Using
`pendingAction` means:

- We don't react to mutations the user kicked off elsewhere
  (theoretically possible if some background task added a vehicle).
- The label flip is tied to the user's specific tap on this screen.

`isMutating` from the hook is still useful — Step 6 plans to surface
it as an "Updating…" inline pill above the action stack for very-long
mutations (10s+ uploads, etc.), but per-action labels are enough for
the common case.

## What's still done by the existing flow

`handleEditSubmit` still calls `await updateVehicle()` before closing
the edit sheet, so the bottom sheet stays open until the mutation
lands (the wizard's internal "Saving…" label shows during that
window). No change needed there.

Delete success → `router.back()`. Delete failure → stay on the detail,
error surfaced via the hook's `error` state. Step 6 closes the
delete-error UI gap (currently the error string is captured by the
hook but no UI on this screen renders it).

## What's next

**Step 6** is the final step in the garage readiness arc:

1. Define `GARAGE_SOCKET_CHANNEL` + `GarageSocketEvent` types so the
   realtime contract matches what catalog and top-featured already
   declare. No subscriber yet (that's Phase D infra work), but the
   shape is there for backend coordination.
2. Add an inline error+retry UI to the vehicle-detail screen when a
   mutation fails — today the error is captured in the hook's `error`
   state but no UI on this screen renders it.

After Step 6 the garage will be at parity with the explore landing
readiness arc (~80%) — every state designed, every mutation has
feedback, every contract is HTTP-ready, the realtime channel is
named.
