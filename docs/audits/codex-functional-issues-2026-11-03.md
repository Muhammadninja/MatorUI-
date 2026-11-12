# Functional issues found during the design review

For Codex. Found on the running app against the production API on 2026-11-03. These are behaviour, not presentation, so the design pass left them alone.

## Success shown without confirmation

- [ ] **Vehicle detail, "set active":** shows success even if the server rejects it, because `setPrimaryVehicle` swallows backend errors. `garage-screen.tsx` already has the right pattern.
- [ ] **Notifications, "mark all read":** shows success before the server responds. A failure rolls back with no message.
- [ ] **Add to cart:** shows "added" before the server responds. A failure does roll back and show an error.
- [ ] **Favourites:** `toggleLike` reads its result from inside a state update, so rapid taps could show the wrong message. Found by reading the code; not reproduced.

## Wrong state shown

- [ ] **Notifications:** a failed request shows the empty state.
- [ ] **Favourites:** `state === 'error'` also shows the empty state (`liked-screen.tsx`).
- [ ] **Guest deep links:** order history and addresses show an error rather than a sign-in prompt. Checkout opens with an empty cart.
- [ ] **Track order with no order:** header over a blank body.
- [ ] **Vehicle detail `?edit=1`:** doesn't enter edit mode when the screen is already mounted.

## Flows

- [ ] **Search:** "колодки" returns nothing on production, though brake pads are in the catalogue. Probably the search build not being deployed; see `docs/audits/search-deployment-owner-instructions-2026-11-03.md`.
- [ ] **VIN finder:** no back control and no entry point in the app.
- [ ] **Order total:** Cart shows 944 000 with delivery, Checkout opens on pickup at 919 000, and the difference isn't explained. Confirm this is intended.
- [ ] **Order tracking:** lines don't add up to the total (100 000 against 130 000) because delivery and the service fee aren't listed. Needs those values from the order.

## Text

- [ ] **Cart errors:** `cart.context.tsx` shows untranslated English: "Could not refresh cart", "Cart was rolled back. Try again."
- [ ] **AI chat:** old messages keep the "Now" caption saved in the language at the time.
- [ ] **Text size:** after changing the system text size while the app is open, Home keeps stale measurements until relaunch. Check whether this also happens in a release build.

## Data and backend

- [ ] "Chevrolet Tracker" appears twice in the model list.
- [ ] Part titles stay Russian in the Uzbek UI: no `title_uz` (QA #10).
