# Design finish checklist

Branch `design/teal-explore-home`, reviewed 2026-11-03 against `Mator_Design_Handoff.md` and the settled decisions in `design-qa-open-items-2026-11-03.md`.

## How this was checked

Running app on the booted iPhone 16 Pro (iOS 18.3, 402 wide), production API, Russian UI, light theme, **guest session**. Layout was read from the live accessibility tree, as text and bounds. No screenshots were taken, so nothing here was judged by eye.

| Column | `[x]` means |
|---|---|
| Type | The screen's own file uses only handoff sizes (11, 12, 14, 16, 20, 24, 28). A number is how many sizes are off-scale. Child components are not counted. |
| Color | The token lint passes and `themes/index.ts` matches the handoff palette. Checked in code; not seen on screen. |
| Space / Align | 16-unit gutters and consistent edges in live bounds, for the states listed. |
| Touch | Controls in the listed state measure at least 48 units, counting frame plus hit slop. |
| Safe | Content clears the status bar, home indicator and tab bar in live bounds. |
| RU | Visible strings in the tree are Russian, apart from product and brand data. |

Columns with no `[x]` anywhere, and why:

- **Keyboard:** focusing fields changed no layout, and the software keyboard appears to be hidden on this simulator. Not checked on any screen.
- **Uzbek:** switching language changes the shared running app. Key parity only: en 851, ru 869 with plural forms, uz 851, none missing. Uzbek is not listed per screen.

## Screens

| Screen | Type | Color | Space | Align | Touch | Safe | Keyboard | RU | States seen | States not seen, and why |
|---|---|---|---|---|---|---|---|---|---|---|
| Explore | [ ] 3 | [x] | [x] | [x] | [x] | [x] | [ ] | [x] | Loaded; categories expanded and collapsed; collapse scroll | Loading, refresh error: can't be forced on real data. With a vehicle: guest |
| Search | [ ] 1 | [x] | [x] | [x] | [x] | [x] | [ ] | [x] | Idle | Results, no results, error: not typed in this pass |
| Category | [ ] 2 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Loaded | Empty, error: not available on this data |
| Make | [ ] 2 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Loaded | Loading, error |
| Catalog systems | [x] | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Loaded | Loading, error |
| Catalog subcategories | [ ] 2 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Empty | Loaded: needs a real system param from the flow |
| Catalog parts | [ ] 6 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Loaded, no vehicle | Filtered empty, error, with a vehicle |
| Vehicle parts | [ ] 2 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Loaded, no vehicle | With a vehicle: guest |
| Item detail | [ ] 2 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Loaded, unknown fit | Fits, doesn't fit, out of stock, missing photo, add success and failure |
| Garage | [ ] 2 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Empty | With vehicles, skeleton, error: guest |
| Add vehicle | [ ] 3 | [x] | [x] | [x] | [x] | [x] | [ ] | [x] | Idle | Decoded, partial match, error: needs a real VIN |
| Vehicle detail | [ ] 2 | [x] | [ ] | [x] | [x] | [x] | n/a | [x] | Not found | View and edit: guest has no vehicles |
| VIN finder | [ ] 4 | [x] | [x] | [x] | [x] | [x] | [ ] | [x] | Idle | Result, error. Only reachable by deep link |
| Cart | [ ] 2 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Empty | With items, promo, sync failure: guest |
| Checkout | [ ] 8 | [x] | [x] | [x] | [x] | [x] | [ ] | [x] | Empty cart, by deep link | Real order, address picker, payment: signed-in only, and not placing orders |
| Order confirmation | [ ] 5 | [x] | [ ] | [ ] | [ ] | [ ] | n/a | [ ] | None | Needs a real order |
| Track order | [ ] 2 | [x] | [ ] | [ ] | [ ] | [x] | n/a | [x] | No order: header over a blank body | Timeline: needs a real order |
| Order history | [ ] 2 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Error, as guest | Loaded, empty: signed-in only |
| Profile | [ ] 1 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Guest | Signed-in: not available |
| Edit profile | [ ] 3 | [x] | [x] | [x] | [x] | [x] | [ ] | [x] | Empty, as guest | With data, photo failure: signed-in only |
| Addresses | [ ] 10 | [x] | [x] | [x] | [x] | [x] | [ ] | [x] | Error, as guest | Loaded, empty, form sheet: signed-in only |
| Payment methods | [ ] 1 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Static list | No other states |
| Settings | [x] | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Guest | Signed-in rows, delete account: signed-in only |
| Legal documents | [ ] 1 | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Loaded, unavailable | Loading |
| Notifications | [ ] 2 | [x] | [ ] | [x] | [x] | [x] | n/a | [x] | Empty | With rows, unread, error: guest has none |
| Favourites | [ ] 2 | [x] | [ ] | [x] | [x] | [x] | n/a | [x] | Empty | With items: changing favourites was out of scope |
| Sourcing offer | [ ] 4 | [x] | [ ] | [x] | [x] | [x] | n/a | [x] | Unavailable | Live offer: needs a real offer |
| AI chat | [ ] counted in children | [x] | [ ] | [x] | [x] | [x] | [ ] | [ ] | Stored conversation | Sending: creates real requests. Old `Now` captions stay English |
| Sign-in, phone step | [ ] 3 | [x] | [ ] | [x] | [x] | [x] | [ ] | [x] | Phone step | Keyboard lift unseen |
| Sign-in, code step | [ ] 3 | [x] | [ ] | [ ] | [ ] | [ ] | [ ] | [ ] | None | Would send a real SMS |
| Language picker | [ ] 1 | [x] | [ ] | [x] | [x] | [x] | n/a | [x] | Settings mode | Onboarding mode: first launch only |
| Not found | [x] | [x] | [x] | [x] | [x] | [x] | n/a | [x] | Shown | No other states |

## Shared UI

| Element | Status | Evidence, or why not |
|---|---|---|
| Palette tokens | [x] | All 18 handoff values match in code |
| Token discipline | [x] | `lint:tokens` passes; it only scans screens and screen components |
| Type scale in theme | [x] | Theme variants match the handoff; individual call sites are the open issue |
| Tab bar | [x] | Label 11/14 medium in code; slots 44 tall plus slop; hidden with the keyboard in code |
| App bar and back button | [x] | 34 frame plus 16 slop; label now translated |
| Icon buttons, `AppPressableView` | [x] | Sized controls now tap across their full size, re-measured live |
| Primary button | [x] | 48 nominal; 47 reads in the tree from rounding. Guest login raised from 40 |
| Category toggle | [x] | Live: 48 tall, centred, label and scroll correct |
| Filter chips | [x] | Slop now covers 48 units; live frame unchanged, slop value checked in code only |
| Product card | [x] | Heart and add both 48 live. Add states not exercised |
| Toast | [ ] | Tests only. Not triggered live |
| Bottom sheets (add car, filters, address, language) | [ ] | Not opened |
| Skeletons and loading | [ ] | Too brief to read on real data |
| Inline errors | [x] | Raw "Unauthorized" no longer shown, on orders and addresses |
| Dark theme | [ ] | Handoff is light only; switching changes the shared running app |
| Large text, reduced motion, VoiceOver | [ ] | Device settings would change the shared running app |
| Widths 360 and 430 | [ ] | No additional simulators, per instruction |
| Android | [ ] | Not running |

## Open issues

Further items stay in `design-qa-open-items-2026-11-03.md`.

### Decisions needed

1. **Off-scale sizes:** 106 remain across 45 files, mostly 13, 15 and 17. I only snapped accidental half-steps, because moving 13 to 14 everywhere would alter screens you've approved without my being able to see them.
2. **Contrast:** teal `#007F86` is 4.43:1 on the page background, which is what the new category toggle sits on, and 4.24:1 on the pale teal panel ("Сменить"). Both miss 4.5:1 and both are handoff colours.
3. **Truncation:** the handoff's two-line titles conflict with the earlier no-truncation rule, and 50 `numberOfLines` or `ellipsizeMode` lines remain in code.
4. **Search wording:** the Home search shows "Название или артикул", but the search screen says "Поиск запчастей, брендов, OEM №".

### For Codex: logic, so not changed here

5. "Set active" on vehicle detail shows success even if the server rejects it.
6. "Mark all read" shows success before the server responds, and a failure rolls back with no message.
7. A failed notifications request shows the empty state (QA #7).
8. `toggleLike` reads its result from inside a state update, so rapid taps could show the wrong message.
9. Guests can reach order history and addresses by deep link and get an error rather than a sign-in prompt. Checkout opens with an empty cart in the same way.
10. Track order with no order shows a blank body.
11. VIN finder has no back control and no entry point in the app.

### Data and backend

12. "Chevrolet Tracker" appears twice in the model list.
13. Legal documents repeat their title three times: header, screen title and the document's own heading.

### Not built

14. Delivery location and recommendations on Home, gallery thumbnails, and the old card style in the similar-parts rail (QA #14, #18).
