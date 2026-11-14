# Multi-device release audit — 2026-11-14

Base: `origin/main` @ `146ffcd`. Branch `claude/multi-device-audit-2026-11-14`.
Static pass: `83b2cd5`. Device pass: this revision.

## How builds were run

- **iOS simulators.** Existing Mator dev-client build, loading `main` from this worktree's Metro in production mode (`--no-dev --minify`) with production env (`https://api.mator.uz`).
- **Android emulator.** The RC APK (`5da6971`; since then only an `expo-navigation-bar` config option changed natively) was repacked with a `main` JS bundle. Its `app.config` was pointed at the production API and the APK was re-signed with a local debug key.
  - Images added after `5da6971` have no Android resources in this repack, so Android image presentation is not evidence.
  - Afterwards the original RC APK (sha256 `eeb3c5fd…`) was reinstalled.
- **Guest only.** Sign-in, OTP, orders and adding a vehicle need a production SMS, which is out of scope, so no code was submitted.

## Devices actually tested

| Class | Device | Config |
|---|---|---|
| Small iPhone | iPhone SE 3rd gen sim, iOS 18.3 | RU, light, default text |
| Standard iPhone | iPhone 16 Pro sim, iOS 18.3 | EN, dark, default text |
| Large iPhone | iPhone 17 Pro Max sim, iOS 26.1 | UZ, light, accessibility XXXL text |
| iPad | iPad Air 11" (M3) sim, iOS 18.3 | EN, light |
| Standard Android | Pixel 9 emulator, API 35 (1080×2424 @420) | RU, default font |
| Small Android | Pixel 9 emulator with `wm size 720x1280`, density 320 (360×640 dp) | UZ, font scale 2.0 |
| Large Android | — | NOT TESTED (the Pixel 9 Pro AVD is the same size class) |
| Real devices | — | NOT TESTED |

## Checkpoints

| | Checkpoint | Status | Evidence |
|---|---|---|---|
| A | iOS layout | FIXED | SE, 16 Pro, 17 Pro Max and iPad Air: Home, Garage (empty), Cart (empty), Profile (guest), Search with keyboard, empty search, item detail with buy bar, Sign-in. P0-1 found and fixed on Pro Max XXXL |
| B | Android layout | PASS | Pixel 9 standard and small at 2.0×: gate, Home, Garage, Cart, Profile, item detail, Sign-in. The P0-1 fix is confirmed on small Android at 2.0× |
| C | RU / UZ / EN text and overflow | PASS (default text) / P2 at max text | RU on SE and Pixel; EN on 16 Pro and iPad; UZ on Pro Max XXXL and small Android 2.0×. No clipping at default sizes. Overflow at max text is logged as P2-5…P2-7 |
| D | Keyboard, modals, safe areas, navigation | PASS | Sign-in sheet keeps the phone field and Next above the keyboard on SE, 16 Pro, Pro Max XXXL (scrolls), iPad, Pixel and small Android 2.0×. Notch, Dynamic Island, home indicator and Android gesture bar are clear. Tab bar works on all devices. Notifications correctly requires sign-in for guests |
| E | Garage and vehicle-image presentation | BLOCKED | Home hero car and item-detail gallery (iPad paging included) render on iOS. A Garage with a vehicle needs sign-in (production SMS). Android images are not representative (repack) |
| F | Final regression | PASS | `tsc` clean. Vitest 2068/2068: 151/153 files; the other 2 can't import `sharp` from the shared node_modules (pre-existing, vehicle-image pipeline). `select-language` / navigation tests 8/8. Only `select-language-screen.tsx` changed; no API, EAS or env config changes |

## Issues

P0: 1 (fixed) · P1: 0 · P2: 7

- **P0-1 FIXED, `5614087`.** The first-launch language gate did not scroll. At iOS accessibility text sizes the options and Continue were pushed off screen, so onboarding was blocked. The fix wraps the content in a ScrollView (`flexGrow` keeps the default layout) and caps the headline at `maxFontSizeMultiplier` 1.6. Verified on the Pro Max at XXXL and on small Android at 2.0×. Default-size gate unchanged on SE, 16 Pro, iPad and Pixel.
- **P2-1 NOT REPRODUCED.** The window width read once at module scope gives correct full-width gallery paging on iPad. Split View was not exercised.
- **P2-2 BLOCKED.** Vehicle-detail edit with the iOS number pad needs a signed-in Garage vehicle.
- **P2-3 BLOCKED.** Track-order number clamp needs an authenticated order.
- **P2-4 OPEN, not visual.** `ru.json` has 22 orphan keys.
- **P2-5 NEW.** Cart empty state at XXXL: the centred empty-state block grows upward and overlaps the "Savat" title.
- **P2-6 NEW.** Item-detail buy bar at XXXL (iOS) and at 2.0× (Android): the total price runs under the quantity stepper. Add-to-cart stays tappable.
- **P2-7 NEW.** Words break mid-word at XXXL: "Garajingi/z" (Garage), the guest ID "YQZ4F/A" (Profile), "Avtomobili/ngizni" (Home banner). Language-option flags clip inside their 44 pt circles.
- **Observation, not a defect.** iPad renders the phone layout stretched to full width. It is functional but has no tablet layout.

## Remaining blockers

- Signed-in flows on any device: Garage with a vehicle and its images, vehicle edit (P2-2), checkout, orders and track order (P2-3), notifications. These need a test account or staging OTP.
- Real iPhone and Android hardware; a large Android class; iPad Split View.
- Android image presentation needs a real `main` Android build (EAS).
