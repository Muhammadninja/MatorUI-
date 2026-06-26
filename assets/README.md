# MATOR.UZ — App Icons & Splash (Light + Dark)

Mark: clean metallic silver geometric **M**. Palette: Matte Black `#0A0A0A`, Off White `#F2F3F5`, Metallic Silver / Graphite.

Two themes everywhere:
- **Dark** — black surface, silver M
- **Light** — off-white surface, graphite M

---

## iOS — `ios/icons/`
- `dark/`   — black icon, silver M (default + dark appearance)
- `light/`  — off-white icon, graphite M (light appearance)
- `tinted/` — grayscale (iOS 18 tinted/monochrome appearance)

Each folder has all sizes: 1024, 180, 167, 152, 120, 87, 80, 76, 60, 58, 40, 29, 20 px.

**Xcode 15+ / iOS 18:** in `AppIcon.appiconset`, set the single-size slot and add **Appearances → Any / Dark / Tinted**, dropping `dark/icon-1024.png`, `light/icon-1024.png` (as "Light/Any"), and `tinted/icon-1024.png`.

**Expo:** use the `icon` object (see below) — Expo SDK 50+ supports light/dark/tinted.

## Android — `android/icons/`
- `dark/`  — black launcher, silver M + adaptive (`#0A0A0A` background)
- `light/` — off-white launcher, graphite M + adaptive (`#F2F3F5` background)
- `ic_launcher.xml` → `res/mipmap-anydpi-v26/`
- `colors.xml` → `res/values/` (has both background colors)

Densities: mdpi 48 → xxxhdpi 192. Adaptive foreground at 108dp, ~62% safe zone. Play Store 512 in each theme folder.

> Android themed icons follow the system wallpaper/Material You. The `dark/` set is your primary launcher icon; `light/` is provided for light-themed launcher surfaces and Play Store light listings.

## Splash — `splash/`
| File | Mode |
|---|---|
| `splash-dark.png` / `*-dark-*` | black bg, silver M |
| `splash-light.png` / `*-light-*` | off-white bg, graphite M |

Sizes: Android `1080x1920`, iOS `1242x2688`. Master `9:16` included.

---

## Expo `app.json` — full light/dark setup
```json
{
  "expo": {
    "icon": {
      "light": "./assets/icon-light.png",
      "dark": "./assets/icon-dark.png",
      "tinted": "./assets/icon-tinted.png"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-foreground.png",
        "backgroundColor": "#0A0A0A"
      }
    },
    "plugins": [
      ["expo-splash-screen", {
        "image": "./assets/splash-dark.png",
        "backgroundColor": "#0A0A0A",
        "resizeMode": "contain",
        "dark": {
          "image": "./assets/splash-light.png",
          "backgroundColor": "#F2F3F5"
        }
      }]
    ]
  }
}
```
Copy → `assets/`:
- `icon-dark.png`  ← `ios/icons/dark/icon-1024.png`
- `icon-light.png` ← `ios/icons/light/icon-1024.png`
- `icon-tinted.png`← `ios/icons/tinted/icon-1024.png`
- `adaptive-foreground.png` ← `android/icons/dark/adaptive-foreground.png`
- `splash-dark.png` / `splash-light.png` ← `splash/`

Then: `npx expo prebuild --clean` and rebuild.
