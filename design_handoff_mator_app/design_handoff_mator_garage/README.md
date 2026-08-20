# Handoff: Mator App — My Garage screen (React Native / Expo)

Redesign of the Garage tab. The old screen listed identical vehicle cards and made
the operator hunt for which car was active. The new screen answers one question
immediately — **which car am I shopping for** — then offers switching and context
below it.

**Fidelity: high.** Layout, spacing, type, hierarchy and copy are final. Data is
mock; the quick-action tiles currently fire toasts (see *Wiring*).

## Package
```
prototype/
  Mator.dc.html   full app prototype — open in a browser, tap the Garage tab
  support.js      runtime for the reference only — do not ship
```
The screen is `scGarage()` in the prototype's logic class; `scVehicle()`
(vehicle detail) and `scAddVehicle()` are unchanged and still the destinations.

## Screen structure (top to bottom)
Standard 20px screen padding, sections stacked with the app's existing gap.

1. **Header row** — `My Garage` (Figtree 700 / 26) with a sub-line
   `"{n} vehicles · fit checked automatically"` (13, muted). Right: a 42×42
   borderless card-fill button with `add` icon (22). Replaces the old `+ Add` pill.
2. **Active vehicle hero** — `borderRadius: 22`, `background: brandBg`,
   `color: brandText`, padding 18, `overflow:hidden`.
   - The vehicle's **car silhouette** (`carIcon(type, 210, brandText)`) sits at
     `right:-28, top:6, opacity:.12` as a watermark — the only decoration.
   - Status line: 6px green dot + `ACTIVE VEHICLE` (10/700, `.16em`, 75% opacity).
   - Title in two lines (`2019 Toyota` / `Camry`), Figtree 700/26, `maxWidth:210`
     so it never runs under the watermark. Sub-line `trim · color` at 70% opacity.
   - **Stat row**: Mileage · VIN · Trim, each a 9.5/700 `.14em` uppercase label
     over a 13.5/600 value, above a 1px hairline
     (`rgba(0,0,0,.14)` on light-inverted, `rgba(255,255,255,.18)` on dark).
   - Actions: `Shop parts that fit` — a full-width button in `bg`/`text`
     (inverted back out of the hero) — plus a 46px square `tune` button on a
     12–16% wash for vehicle detail.
3. **Fit filter row** — borderless `card` row, 34px rounded-square icon tile with
   `verified` on the success wash (`rgba(15,157,88,.16)` dark / `.1` light),
   title `Fit filter is on`, sub `Every price and part is checked against this car.`
4. **Quick actions** — 2×2 grid, gap 10, borderless `card` tiles, padding 14:
   icon (20) → label (13.5/600) → sub (11.5 muted). Service log · Past orders ·
   Scan VIN · Saved parts.
5. **Other vehicles** — section head (17/700) with `Tap to switch` on the right,
   then one row per non-active vehicle: 52×44 `bg2` tile holding the car
   silhouette (38, muted), name + `trim · mileage`, and a muted `Set active`
   affordance. Tapping the row sets active and toasts
   `"{year} {make} {model} is now active"`. Hidden when there is only one car.
6. **Add another vehicle** — full-width dashed-border ghost button (`1px dashed
   border`, radius 16, muted text) → `add-vehicle`.

**Empty state** unchanged: `emptyState('No vehicles yet', …, 'Add vehicle')`.

## System rules this screen follows
- Figtree throughout (`t.head` / `t.body` / `t.ui`); no new fonts, no emoji.
- Monochrome: `brandBg`/`brandText` invert per theme (`#fff`/`#000` dark,
  `#000`/`#fff` light). Green (`t.green`, `t.success`) is the only accent, used
  once each — active dot and fit confirmation.
- **Borderless cards on `t.card` fill** — the app's card paradigm. The only
  stroked element is the dashed add-vehicle button.
- Radii: hero 22 · cards/tiles 16 · buttons 13 · icon tiles 10–12.
- Everything on the 4px grid; all touch targets ≥ 42px.
- Icons come from the existing `icon()` helper (Material Symbols set already in
  the app): `add`, `tune`, `verified`, `build`, `receipt_long`,
  `qr_code_scanner`, `bookmark`. Car art comes from `carIcon(type, size, color)`
  with `type ∈ sedan | suv | truck | hatchback` — no new assets needed.
- Works unmodified in light and dark; every color is a theme token.

## Data
```ts
type Vehicle = {
  id: string; make: string; model: string; year: number;
  trim: string;      // "SE 2.5L"
  vin: string;       // truncated for display
  img: 'sedan'|'suv'|'truck'|'hatchback';   // silhouette key
  color: string;     // "Midnight Black"
  mileage: string;   // "48,200 mi" — display string
};
```
State: `vehicles: Vehicle[]`, `activeVehicleId: string`. The hero falls back to
`vehicles[0]` when `activeVehicleId` is unset. Setting active is the only
mutation on this screen; removal stays on the vehicle detail screen.

## Wiring
```
GET    /api/garage/vehicles              → Vehicle[]
POST   /api/garage/vehicles              → add (VIN decode server-side)
PATCH  /api/garage/active                { vehicleId }
GET    /api/garage/vehicles/:id/summary  → { serviceLast, orderCount, savedCount }
```
The quick-action subs are currently hard-coded (`Last: oil, 2 mo ago`,
`4 parts for this car`, `6 waiting`) — feed them from the summary endpoint and
hide a tile's sub-line rather than showing a zero. Service log and Saved parts
need real screens; Past orders and Scan VIN already route.

Setting active should be optimistic and must invalidate any cached fitment
results (`fitChecked` / `fitChecking` in the prototype) so "Check if it fits"
re-runs against the new car.

## Notes / open
- Mileage is stored as a display string in the prototype; production should hold
  a number plus unit and format in the client.
- VIN is truncated in the hero stat row — decide whether to mask it entirely.
- Not covered: reordering vehicles, per-vehicle photos (would replace the
  silhouette watermark), service reminders/due badges on the hero, and a
  "vehicle needs attention" state.
