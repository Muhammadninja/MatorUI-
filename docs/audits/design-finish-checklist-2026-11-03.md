# Design finish checklist

Branch `design/teal-explore-home`, updated 2026-11-03 against `Mator_Design_Handoff.md`, the settled decisions in `design-qa-open-items-2026-11-03.md`, and the owner's decisions of 2026-11-03.

## How this was checked

Running app on one iPhone 16 Pro simulator (402 wide), production API, signed in with the owner's account.

**`[x]` means looked at on screen in a temporary screenshot.** Anything known only from code or the accessibility tree is listed as such and is not `[x]`. Touch targets and bounds were measured from the accessibility tree on 2026-11-03, on the screens covered by that pass.

Settings were changed for the review and restored: language Russian, appearance light, text size medium. No orders or payments were made, and no forms were saved. One favourite was switched on and back off; the count is 0, as it was.

## Screens

| Screen | RU light | UZ | Dark | Large text | States seen | States not seen, and why |
|---|---|---|---|---|---|---|
| Explore | [x] | [x] | [x] | [x] | Guest and signed in; categories collapsed | Refresh error: can't be forced on real data |
| Search | [x] | [ ] | [ ] | [ ] | Idle, no results, keyboard | Results: "колодки" returns nothing on production |
| Category | [x] | [ ] | [ ] | [x] | Loaded | Empty, error |
| Make | [x] | [ ] | [ ] | [ ] | Loaded | Loading, error |
| Catalog systems | [x] | [ ] | [ ] | [ ] | Loaded, with a vehicle | Loading, error |
| Catalog subcategories | [ ] | [ ] | [ ] | [ ] | Tree only: empty | No real system param used |
| Catalog parts | [x] | [x] | [ ] | [ ] | Loaded, with a vehicle | Filtered empty, error |
| Vehicle parts | [x] | [ ] | [ ] | [ ] | Loaded | Empty, error |
| Item detail | [x] | [x] | [x] | [x] | Unknown fit, favourite on and off | Fits, doesn't fit, out of stock, no photo: none on this item |
| Garage | [x] | [x] | [x] | [ ] | Guest empty; two vehicles; add-car sheet | Skeleton, error |
| Add vehicle | [x] | [ ] | [ ] | [ ] | Idle, keyboard | Decoded, partial match: needs a real VIN submitted |
| Vehicle detail | [x] | [ ] | [ ] | [ ] | View, edit form | Saving: account data preserved |
| VIN finder | [x] | [ ] | [ ] | [ ] | Idle | Result, error |
| Cart | [x] | [x] | [x] | [x] | Guest empty; two items | Promo, sync failure |
| Checkout | [x] | [x] | [x] | [ ] | Filled, up to the place-order button | Placing an order: not allowed in this review |
| Order confirmation | [ ] | [ ] | [ ] | [ ] | None | Needs a new order. Price display changed from code only |
| Track order | [x] | [ ] | [ ] | [ ] | Delivered | Other statuses: none on this account opened |
| Order history | [x] | [x] | [ ] | [x] | Loaded | Empty; error seen as guest in the tree only |
| Profile | [x] | [x] | [x] | [x] | Guest; signed in | None |
| Edit profile | [x] | [ ] | [ ] | [ ] | With data | Photo failure, phone change sheet |
| Addresses | [x] | [ ] | [ ] | [ ] | Loaded, edit sheet | Empty; error in the tree only |
| Payment methods | [x] | [ ] | [ ] | [ ] | Static list | None |
| Settings | [x] | [ ] | [ ] | [x] | Guest and signed in | Delete account: not opened |
| Legal documents | [x] | [ ] | [ ] | [ ] | Loaded | Loading; unavailable in the tree only |
| Notifications | [x] | [ ] | [ ] | [x] | Guest empty; list with rows | Unread rows: none at the time; error |
| Favourites | [x] | [ ] | [ ] | [ ] | Empty | With items: seen only as count and toast |
| Sourcing offer | [x] | [ ] | [ ] | [ ] | Unavailable | Live offer: none available |
| AI chat | [x] | [ ] | [ ] | [ ] | Stored chat, keyboard | Sending: creates real requests |
| Sign-in, phone step | [x] | [ ] | [ ] | [ ] | Phone step | Keyboard lift: not seen on this sheet |
| Sign-in, code step | [ ] | [ ] | [ ] | [ ] | None | Would send a real SMS |
| Language picker | [x] | [ ] | [ ] | [ ] | Settings mode | Onboarding mode: first launch only |
| Not found | [ ] | [ ] | [ ] | [ ] | Tree only | None |

## Shared UI

| Element | Status | Evidence, or why not |
|---|---|---|
| Teal text contrast | [ ] code | `brandText` #00737A is 5.20:1 on page, 4.93:1 on secondary, 4.97:1 on pale teal, by calculation. Looks correct on screen; no colour meter used |
| Search placeholder | [x] | Same text on Home, Search and Catalog parts; RU and UZ seen, EN from locale file only |
| Product card titles | [x] | Two lines; full title seen on Item detail |
| Back buttons | [x] | Same round arrow on Search, Checkout and Add vehicle; item detail and vehicle detail keep their bare arrow over the header |
| Selected payment option | [x] | Teal border and check |
| Editable fields | [x] | White on grey pages: VIN, Vehicle edit, VIN finder. Grey on white sheets |
| Empty states | [x] | Favourites now matches Cart and Notifications |
| Category toggle | [x] | Collapsed seen; collapse scroll measured from the tree earlier |
| Toast, success | [x] | Green check, white, opaque at rest (band reads 255), about 3 s on screen. Fades over 180 ms, so content shows through only during the fade |
| Toast, error and warning | [ ] | Not triggered on real data |
| Keyboard | [x] | Add vehicle and AI chat: controls stay above it. Other screens not typed in |
| Tab bar | [x] | Active teal, in all reviewed modes |
| Skeletons and loading | [ ] | Too brief to view on real data |
| Reduced motion, VoiceOver | [ ] | Not run; toast behaviour covered by tests only |
| Widths 360 and 430 | [ ] | One simulator, by instruction |
| Android | [ ] | Not running |

## Open issues

### Decisions

1. **Parts list columns:** Catalog parts shows one column and Category shows two. The handoff says two, but one column came deliberately from merged PR #15, so it stays unless you say otherwise.
2. **Long word at large text:** "конфиденциальности" breaks in Settings at the largest sizes, because the word is wider than the column.
3. **Large prices in cards:** "2 210 000 сум" puts its currency on a second line, so prices in a row don't always line up.

### Not built

4. Delivery location and recommendations on Home, gallery thumbnails. Out of scope by decision.
5. The similar-parts rail keeps the old card style (QA #18).

### Functional

See `codex-functional-issues-2026-11-03.md`.
