# Handoff: `ProductRow` — product result card (React Native)

The primary listing card for Mator. Used on **Category results**, **Top Featured**,
and **Recently Viewed**. A borderless, two-part card: image + info on top, a
price/CTA bar below, with an inline **fitment check** control.

Reference: `../prototype/Mator.dc.html` → `productRow()` / `checkFit()` in the logic
class. Open it in a browser, tap a category, and toggle dark mode to see both themes.

---

## Anatomy

```
╭──────────────────────────────────────────────╮  ← card: radius 20, NO border,
│  ┌────────┐  BOSCH QUIETCAST      ← eyebrow  │    NO shadow, surface fill only
│  │        │  Ceramic Brake Pads              │
│  │ image  │  — Front             ← title     │
│  │ 108²   │  ★ 4.8 (214) · GD1234-8Z ← meta  │
│  │[-21%]  │  ( ⊟ Check fit )     ← fit chip  │
│  └────────┘                                  │
├──────────────────────────────────────────────┤  ← hairline divider (5–6% alpha)
│  $64.99  $82.00              ( 🛒 Add )      │  ← footer bar
│  ● In stock · ships today                    │
╰──────────────────────────────────────────────╯
```

### Card container
- `borderRadius: 20`, `overflow: hidden`
- **No border, no shadow.** Separation comes from the surface fill alone:
  - light → `backgroundSecondary` `#f3f3f3`
  - dark → `card` `#111111`
- Lists stack cards with **`gap: 14`** (no dividers between cards).

### Top block — `padding: 14`, `flexDirection: row`, `gap: 14`
- **Image**: 108×108, `borderRadius: 14`, tappable → Item Detail.
  Optional **save badge**: absolute top-left (7,7), pill (`radius 999`),
  `#4ade80` bg / `#05310f` text, 10/800, padding `3px 7px`, label `-N%`.
- **Info column** (`flex: 1`, `minWidth: 0`, `gap: 6`):
  1. **Brand eyebrow** — 10/700, `letterSpacing: .1em`, UPPERCASE, muted
  2. **Title** — 14.5/600, line-height 1.3, `marginTop: 3`
  3. **Meta row** (`gap: 5`, `marginTop: 5`) — ★ glyph in `star #F59E0B` (12) ·
     rating 12/700 in text color · `(1,204)` 11.5 muted · a 3px muted dot ·
     **OEM number** in monospace 10.5 muted, ellipsized
  4. **Fit chip** (see below), `alignSelf: flex-start`
- Brand + title + meta are one tappable block → Item Detail.

### Footer bar — `padding: 11px 14px`, `flexDirection: row`, `gap: 10`
- Separated by a **hairline**: `1px solid rgba(255,255,255,.06)` dark /
  `rgba(0,0,0,.05)` light — deliberately fainter than the global `divider` token.
- **Left**: price 19/800 `letterSpacing: -0.02em` + optional struck `was` price
  (12 muted); below, a 6px `success` dot + "In stock · ships today" (11 muted).
- **Right**: pill **Add** button — brand bg/text (black→white inverts in dark),
  `radius 999`, padding `10px 18px`, 13/700, leading `add_shopping_cart` (16).
  Calls `requireAuth(() => addToCart(id, 1))` — the guest purchase gate.

---

## Fitment chip — three states

All are pills (`radius 999`, padding `6px 12px`, 11.5/700, `gap: 6`), **no borders**.

| State | Background | Content |
|---|---|---|
| **Idle** | `background` (`#fff` / `#050505`) | `rule` icon (14) + "Check fit" in text color |
| **Checking** | same | spinning wheel (13) + "Checking…" in muted, `disabled` |
| **Fits** | `rgba(15,157,88,.10)` light / `.16` dark | filled `check_circle` (14) + "Fits your 2019 Camry" — both in `success` |

Confirmed label interpolates the **active garage vehicle**: `Fits your {year} {model}`,
falling back to "Fits your vehicle" when none is selected.

Behavior (`checkFit`):
1. No-op if already confirmed.
2. `fitChecking[id] = true`
3. After **900ms** (stand-in for the real API): clear checking, set
   `fitChecked[id] = true`, fire a toast — `"Confirmed fit — 2019 Toyota Camry"`,
   or `"Add a vehicle to confirm fit"` when no vehicle is active.

State (keyed by product id):
```js
fitChecking: { [productId]: boolean }
fitChecked:  { [productId]: boolean }
```
Production: replace the timeout with `POST /fitment/check { productId, vehicleId }
→ { fits: boolean }` and cache per (product, vehicle). **Add a negative state** not
in the prototype: `cancel` icon + "Doesn't fit your vehicle" in `error #db4437` on
an `rgba(219,68,55,.1)` pill.

---

## Tokens used
| Role | Light | Dark |
|---|---|---|
| card surface | `#f3f3f3` | `#111111` |
| chip surface (idle) | `#ffffff` | `#050505` |
| text | `#050505` | `#ffffff` |
| textMuted | `#707070` | `#8f8f8f` |
| footer hairline | `rgba(0,0,0,.05)` | `rgba(255,255,255,.06)` |
| brand button bg/text | `#000` / `#fff` | `#fff` / `#000` |

`success #0f9d58` · `star #F59E0B` · save-badge `#4ade80` on `#05310f` ·
`error #db4437` (for the unfit state). Font: **Figtree** throughout.

## React Native notes
- Card = `<View>`; image and the brand/title/meta block are separate `<Pressable>`s.
- `minWidth: 0` isn't needed — use `flex: 1` on the info column, `numberOfLines={2}`
  on the title, `numberOfLines={1}` on the OEM meta row.
- `overflow: 'hidden'` on the card so the image corners clip correctly.
- Save badge: `position: 'absolute'` inside the image `Pressable`.
- Spinner: shared `WheelLoader` (main README → "Loaders") at `size={13}`, muted.
- Icons: `rule`, `check_circle`, `cancel`, `add_shopping_cart` — MaterialIcons.
- Keep the **Add** button ≥44px tall for touch; add `hitSlop` to the fit chip.
- Render lists with `FlatList` + `contentContainerStyle={{ gap: 14, padding: 20 }}`.
  No `ItemSeparatorComponent` — the gap is the separator.

## Props
```ts
type ProductRowProps = {
  product: {
    id: string; title: string; brand: string; oem: string;
    price: number; was?: number; rating: number; reviews: number; img: string;
  };
  fitState: 'idle' | 'checking' | 'fits' | 'unfit';
  activeVehicle?: { year: number; model: string };  // for the confirmed label
  onPress(id: string): void;        // → Item Detail
  onCheckFit(id: string): void;
  onAddToCart(id: string): void;    // wrap in requireAuth at the call site
};
```
