# Multi-device release audit — 2026-11-14

Base: `origin/main` @ `146ffcd`. Branch `claude/multi-device-audit-2026-11-14`.

## Device coverage

| Class | Status | Note |
|---|---|---|
| iPhone SE / standard / Pro Max | NOT TESTED | No simulator booted; owner verifies UI on own simulator/device |
| Android small / standard / large | NOT TESTED | No emulator or device attached (`adb devices` empty) |
| Android font/display scaling | NOT TESTED | |
| iPad (`supportsTablet: true` in app.json) | NOT TESTED | Tablet is enabled, so it counts as supported |
| Light / dark | NOT TESTED | |
| Viewport simulation | NOT TESTED | Not run |

All evidence below is static analysis and automated tests. None of it is device evidence.

## Checkpoints

| | Checkpoint | Status | Evidence |
|---|---|---|---|
| A | iOS layout | NOT TESTED | No iOS runtime |
| B | Android layout | NOT TESTED | No Android runtime |
| C | RU / UZ / EN text and overflow | NOT TESTED (visual) / PASS (keys) | en 1024, uz 1024, ru 1046 keys: 0 missing, 0 empty, 0 `{{placeholder}}` mismatches. `numberOfLines` audit: 13 uses, all sanctioned (price shrink or 2–3 line titles) except P2-3 |
| D | Keyboard, modals, safe areas, navigation | NOT TESTED (device) | Static: every input screen uses keyboard-controller / AppBottomSheet, or keeps its inputs above the fold. Unit tests pass: `app-bottom-sheet-keyboard`, `tab-root-bar`, `checkout-footer-spacing`, `route-navigation-states` |
| E | Garage and vehicle-image presentation | NOT TESTED | Unit tests only (`home-garage-card`) |
| F | Final regression | PASS | `tsc --noEmit` clean; vitest 2068/2068 pass (151/153 files; the other 2 files can't import `sharp` in this worktree's shared node_modules, which affects only the vehicle-image pipeline and is out of scope); `lint:tokens` clean. No code changed, so the production API config is unchanged |

## Issues

P0: 0 · P1: 0 confirmed · P2: 4

- **P2-1** `item-gallery.tsx:29`, `app-image-carousel.tsx:54` and `app-expandable-search.tsx:13` read the window width once, at module scope. With `supportsTablet: true`, the widths go stale under iPad Split View or Stage Manager.
- **P2-2** `vehicle-detail-screen.tsx` edit form uses a plain `ScrollView` with no keyboard inset. The iOS `number-pad` has no Done key, so on SE-sized phones Save can sit under the keyboard. Tapping outside the field dismisses it.
- **P2-3** `track-order-screen.tsx:190`: the order number uses `numberOfLines={1}` without `adjustsFontSizeToFit`, which conflicts with the no-truncation rule at large font scales.
- **P2-4** `ru.json` has 22 keys that `en.json` does not have. They are orphans and render nothing.

## Remaining blockers

- Device runs for A, B, C (visual), D and E. These need an iOS simulator or device, an Android emulator or device, and a dev build.
- Decide whether to keep `supportsTablet: true` or audit iPad layouts.
