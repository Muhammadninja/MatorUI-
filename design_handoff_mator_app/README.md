# Handoff: Mator — Car-Parts Marketplace (React Native / Expo)

## Overview
Mator (mator.uz) is a mobile marketplace for automotive parts. Shoppers pick a
vehicle (their "garage"), then every part is filtered and confirmed for exact fit
by make/model/year/VIN. The app covers auth, browse/search, an AI parts assistant,
cart & checkout, order tracking, and a full profile area. The aesthetic is a
premium, high-contrast **black & white monochrome** system with light and dark mode.

The complete happy path is: **Splash → Select Language → Explore (as guest)**.
Sign-in is **not** required to browse — the app opens straight into Explore after
language selection. Authentication is triggered **only on purchase intent**
(Add to cart / Checkout); after signing in, the original action resumes
automatically. Full buy path: **Explore → (search or AI Chat) → Item Detail →
Add to Cart → [Sign In gate] → Cart → Checkout (address + payment) → Order
Confirmation → Track Order**, plus **Garage → Add Vehicle (or Scan VIN) → back to
Explore with vehicle-fit applied**.

## About the Design Files
The file in `prototype/Mator.dc.html` is a **design reference built in HTML/React**
— an interactive prototype demonstrating the intended look, layout, copy, and
behavior. It is **not production code to copy directly**.

The target environment is **React Native + Expo** (as specified). Recreate these
screens as native RN components using the project's existing conventions:
- Navigation: **React Navigation** — a native stack for auth + pushed detail
  screens, wrapping a bottom-tab navigator for the 5 main tabs.
- Styling: RN `StyleSheet` (or your existing styling lib, e.g. NativeWind/Tamagio).
  Translate the web CSS below into RN equivalents (see "RN Translation Notes").
- Icons: use `@expo/vector-icons` (Material Icons / MaterialCommunityIcons) — the
  prototype uses Material Symbols; see the icon map per screen.
- Fonts: **Figtree** (single family, weights 400/500/600/700/800) via
  `expo-font` / `@expo-google-fonts/figtree`.

Do not ship the HTML. Use it to read exact spacing, colors, copy, and flow.

## Fidelity
**High-fidelity (hifi).** Colors, typography, spacing, radii, and interactions are
final. Recreate the UI faithfully with the exact tokens below. Product/vehicle
imagery in the prototype uses striped placeholders — swap in real image assets.

---

## Auth Model (IMPORTANT — updated)
The app is **guest-first**. There is no forced login on entry.
- After the **Splash**, the user picks a language, taps **Continue**, and lands
  directly on **Explore** as an unauthenticated guest. Browse, search, view items,
  manage the garage, and use AI Chat all work signed-out.
- **Sign-in is gated to purchase intent.** Tapping **"Add to cart"** (Item Detail)
  or **"Checkout"** (Cart) when not authenticated pushes the **Sign In** screen
  with contextual copy *"Sign in to add parts and check out."* and a back button to
  cancel.
- Implement a `requireAuth(action)` guard: if authed, run `action()`; else stash it
  as a pending action and navigate to Sign In. On successful sign-in (or sign-up),
  `completeAuth()` sets `authed = true`, runs the pending action (which navigates —
  e.g. Add-to-cart adds the item and lands on Cart; Checkout goes to Checkout), or
  falls back to Explore if there was no pending action.
- **Sign out** (Profile) clears `authed` and returns to guest Explore.

## Design Tokens

### Color — Light mode
| Token | Hex |
|---|---|
| background | `#ffffff` |
| backgroundSecondary | `#f3f3f3` |
| card | `#fafafa` |
| text / onBackground | `#050505` |
| textMuted | `#707070` |
| border | `#d6d6d6` |
| divider | `#ececec` |
| brand button bg | `#000000` |
| brand button text | `#ffffff` |
| brand button pressed | `#1a1a1a` |

### Color — Dark mode
| Token | Hex |
|---|---|
| background | `#050505` |
| backgroundSecondary | `#141414` |
| card | `#111111` |
| text | `#ffffff` |
| textMuted | `#8f8f8f` |
| border | `#2a2a2a` |
| divider | `#1f1f1f` |
| brand button bg | `#ffffff` (inverts) |
| brand button text | `#000000` |

### Color — Semantic (both modes)
| Token | Hex | Use |
|---|---|---|
| success | `#0f9d58` | confirmed fit, delivered, free-shipping check |
| warning | `#f4b400` | refunded status, back-in-stock dot |
| error | `#db4437` | cart badge, remove actions, unread bell dot |
| info | `#4285f4` | delivery notification dot |
| rating star | `#F59E0B` | ★ ratings |
| value / savings green | `#4ade80` | "SAVE X%" pills (text on it: `#05310f`) |
| accolade gold | `#f4c542` | Pro-member badge, welcome notification |

### Typography — family: **Figtree** everywhere
| Role | Size (px) | Weight |
|---|---|---|
| Title | 28 | 800 (headings 700–800) |
| H3 | 24 | 700 |
| H4 | 20 | 700 |
| Body | 16 | 400 |
| Body small | 14 | 400/500 |
| XS | 12 | 400 |
| Caption | 11 | 500 |
| Button | 16 | 600 |
| Button small | 14 | 600 |

Section/eyebrow labels: 10–12px, weight 600–700, `letter-spacing: .06em`,
`text-transform: uppercase`, colored `textMuted`.

### Spacing scale (4px grid)
`xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · xxxl 48`

### Radii
- Cards / sheets tops: **16** (sheets 24 top corners)
- Buttons / inputs: **12–14**
- Pills / chips / toggles / badges: **999** (full)
- Icon tiles (list-row leading): **11**; header icon buttons: **12–13**

### Shadows
Soft and subtle. Prototype values:
- Card: effectively borderless elevation — rely on `1px border` + very soft shadow.
- Toast / floating: `0 12px 30px -8px rgba(0,0,0,.5)`
- Bottom-tab AI button (when active): `0 6px 16px -6px rgba(0,0,0,.5)`
- Phone-frame only (not in-app).

### Motion
- Screen enter: fade + 8px rise, ~260ms ease.
- Bottom sheet: slide up from 100%, 300ms `cubic-bezier(.2,.9,.3,1)`.
- Toast: rise + fade, ~250ms; auto-dismiss after **2200ms**.
- Success check / splash logo pop: scale .85→1, ~400–500ms `cubic-bezier(.2,.9,.3,1)`.
- Wheel spinner: continuous 360° rotation, ~2.6s linear infinite.
- VIN scan line: vertical sweep 8%↔88%, 2.4s ease-in-out infinite.

---

## Brand / Logo
Wordmark **MATOR** in Figtree 800, letter-spacing `-0.02em`. The **O** is replaced
by an alloy-wheel SVG glyph (two concentric rings `r=46` & `r=33` stroke-8, five
spokes at 0/72/144/216/288°, center hub `r=9`), monochrome so it inverts by theme.
The **T** is a plain letter. On the splash the wheel-**O** rotates; the same
spinning wheel is the app's loading spinner. Rebuild the wheel as an SVG
(`react-native-svg`) component `WheelMark` accepting `size`, `color`, `spin`.

Splash: centered wordmark (spinning O), a `— MATOR.UZ —` lockup, faint tire-tread
bands (repeating-linear-gradient, low opacity) at top & bottom, a wheel spinner,
and the caption "AUTO PARTS MARKETPLACE". Auto-advance to **Select Language** after
~2.4s (tap to skip).

---

## Navigation Architecture
```
RootStack (native stack, headerShown:false)
├─ Splash                     → Select Language
├─ SelectLanguage             → Main (guest; no sign-in on entry)
├─ SignIn / SignUp            (presented modally by the purchase gate, or from Profile)
└─ Main (bottom tabs)
   ├─ ExploreStack:  Explore → Category → Make → ItemDetail → TopFeatured → Notifications → TrackOrder
   ├─ GarageStack:   Garage → AddVehicle → ScanVIN(modal, fullscreen) → VehicleDetail
   ├─ Assistant:     AIChat
   ├─ CartStack:     Cart → Checkout → OrderConfirmation → TrackOrder
   └─ ProfileStack:  Profile → EditProfile → OrderHistory → Addresses →
                     Payments → RecentlyViewed → NotificationSettings → SettingsSecurity
```
SignIn/SignUp are **not** part of the entry flow — present them as a modal stack
invoked by `requireAuth` (see Auth Model). Guests reach Main directly from language
selection.
ItemDetail is reachable from Explore, TopFeatured, VehicleDetail, RecentlyViewed,
and inline AI-chat product cards — implement it as a shared route.

### Bottom Tab Bar (5 tabs, in order)
1. **Explore** — icon `search` (filled when active)
2. **Garage** — icon `directions-car`
3. **Assistant** (center, emphasized) — solid brand-filled circular button, icon
   `auto-awesome` (sparkle); label "Assistant". Sits **inline** with the other tabs
   (do NOT raise it above the bar — an earlier version protruded and covered content).
4. **Cart** — icon `shopping-bag`, with a red (`#db4437`) count badge (sum of item
   qtys) at top-right.
5. **Profile** — icon `person`.
Active tint = `text`; inactive = `textMuted`; active icons use filled variant.

---

## Screens / Views

> Global chrome: iOS-style status bar row (44px) with "9:41", signal bars, battery.
> Pushed screens have a header: back chevron in a 40px bordered square button +
> 20px/700 title + optional right action. In-app theme toggle available in Settings
> → Appearance (Dark mode switch).

### 1. Splash
Full-bleed. See Brand/Logo above. Fullscreen (no tab bar/status bar). The wheel-**O**
in the wordmark spins; auto-advances to **Select Language** after ~2.4s (tap to skip).

### 2. Select Language
- Eyebrow logo mark (size ~26). Title "Choose your language" (28/700).
  Subtitle "You can change this anytime in Settings." (14, muted).
- **Three options**, each a row with a **circular flag chip** (42px, bordered) +
  native name (16/600) + English label (12.5, muted) + a radio selector on the right;
  selected row gets `backgroundSecondary` bg + brand border + filled radio dot:
  - 🇷🇺 **Русский** / Russian (`code: 'ru'`, default selected)
  - 🇬🇧 **English** / English (`code: 'en'`)
  - 🇺🇿 **Oʻzbek** / Uzbek (`code: 'uz'`)
- Flags: prototype uses emoji flags. In RN, emoji flags render on iOS but **not on
  Android** — ship small SVG/PNG flag assets (`react-native-svg` or image) for RU/GB/UZ.
- Primary "Continue" button → **Explore** (enters as guest; no sign-in here).

### 3. Sign In  (reached via the purchase gate, or Profile re-login — not on entry)
- When reached via the gate it shows a **back button** (top-left) instead of the
  logo, and gate copy "Sign in to add parts and check out."; otherwise it shows the
  logo mark and "Sign in to keep your garage and orders in sync."
- Title "Welcome back".
- Inputs: "Email or phone" (prefill `alex.marino@email.com`), "Password"
  (prefill dots). Label = 12/600 muted above a `backgroundSecondary`, bordered,
  12-radius field (14px vertical padding, 15px text).
- "Forgot password?" right-aligned ghost link (shows a toast "Reset link sent").
- Primary "Sign in" → Main/Explore. Below: "New to Mator? **Create account**" →
  SignUp.

### 4. Sign Up
- Back button. Title "Create account". Subtitle "Parts that fit — guaranteed by VIN."
- Inputs: Full name, Email, Password. Fine print "By continuing you agree to the
  Terms of Service and Privacy Policy." Primary "Create account" → Main/Explore.

### 5. Explore (home) — Explore tab root — **UPDATED (AutoZone-style)**
The home is now a **category browser**, not a product list.
- **Sticky header** (pinned on scroll): frosted/blurred translucent background
  (`rgba(255,255,255,.82)` light / `rgba(5,5,5,.82)` dark + `backdrop-filter:
  saturate(180%) blur(14px)`), bottom divider. Contains: greeting "Good morning,
  Alex 👋" (12.5 muted) + "Find your part" (22/700), a 42px bordered notification
  button (`notifications` + red unread dot → Notifications), and a **pill search
  field** (full-radius, `backgroundSecondary`, `search` icon + "Search parts,
  brands, OEM #"). In RN, replicate with a sticky/animated header (e.g. header on
  `Animated.ScrollView`, or a fixed header above a `FlatList`); blur via
  `expo-blur` `BlurView`.
- **Vehicle-fit banner**: full-width brand-colored (black) card, car icon in a
  translucent tile, eyebrow "SHOWING FITMENT FOR", "2019 Toyota Camry SE 2.5L",
  chevron → Garage tab.
- **Shop by vehicle**: section header + "My garage ›" link. Horizontal scroll of
  **make tiles** — a 66px rounded-square in the make's brand color (tinted bg +
  border) containing a **custom SVG car silhouette** (per body type), make name
  below. Makes: Toyota (sedan/red), Honda (hatchback/green), Ford (truck/blue),
  BMW (sedan/blue), Chevrolet (truck/amber), Nissan (SUV/red). Tap → Make screen.
- **Shop by category**: section header + **3-col grid** of category tiles. Each
  tile: `card` bg, 1px border, 18-radius, centered; a 52px rounded-square in the
  category's accent color (tinted bg) holding a **custom SVG part icon**, then the
  name (12.5/700) and "N parts" (10.5 muted). Tap → Category screen.
  Categories + accent colors: Brakes `#db4437`, Batteries `#0f9d58`, Filters
  `#4285f4`, Ignition `#f4b400`, Engine `#7c4dff`, Electrical `#f59e0b`, Oil &
  Fluids `#00acc1`, Belts & Hoses `#8e24aa`, Wipers `#039be5`, Lighting `#fb8c00`,
  Suspension `#e91e8c`, Exterior `#3949ab`. (Colorful icons are an intentional
  exception to the monochrome system — only category/vehicle icons carry color.)
- **MATOR Certified** (section sits **between Shop by vehicle and Shop by category**):
  header with a blue `verified` badge + "MATOR Certified" + "See all ›", a muted
  subtitle ("Verified dealers — genuine parts, guaranteed fitment & returns."), then a
  **horizontal carousel of storefront cards** (224px wide, no ratings/reviews). Each
  card = a colored banner header (dealer's brand color gradient, decorative circles)
  with a white rounded logo tile (initial) + dealer name (white) + "Nk orders · Ny";
  below on `card` bg, two stacked badge rows: **MATOR CERTIFIED** (blue `verified`
  dot + label) and **LOWEST PRICE** (green `sell` dot + label + a green "GUARANTEED"
  chip). Tap a card / "See all" → Category listing filtered to that dealer (via the
  loading overlay). Seed dealers: AutoPro Parts (blue, 18k+/12y), Prime Motors Supply
  (green, 9.4k+/8y), Genuine OEM Depot (orange, 5.1k+/6y), TorqueLine Auto (purple,
  7.8k+/10y).

**Custom SVG icons** (rebuild as `react-native-svg`, stroke-based line art, colored
per tile). Part icons: brake disc+caliper, battery, oil-filter canister, spark plug,
engine block, wiring/plug, oil drop, belt+pulleys, wiper, headlight, coil spring,
car body. Car silhouettes by body: sedan, suv, truck, hatchback (wheels + roofline).
These replace the earlier Material Symbols glyphs on the home tiles.

### 5b. Category screen (`category`) — NEW
Header with the category (or "Make Model") label, the vehicle-fit banner, an
"N parts fit your vehicle" count, then a **vertical list of product result rows**
(see Product result row below). Empty state if nothing fits.

### 5c. Make screen (`make`) — NEW
Header = make name. Branded hero (car silhouette on white tile + "Select your
model…"), then a "Models" list — each row a car-silhouette tile + "Make Model" +
"2015 – 2024" + chevron. Tap a model → Category screen labeled "Make Model".

**Product result row** — the primary listing card, used on Category, Top Featured,
Recently Viewed. **Full spec: `components/ProductRow.md`.**
Summary: a **borderless, shadowless** card (radius 20) whose only separation is its
surface fill (`#f3f3f3` light / `#111` dark). Top block = 108px image (radius 14,
optional green "-N%" pill) + info column (brand eyebrow 10/700 uppercase → title
14.5/600 → ★ rating · review count · OEM mono → **fit chip**). A hairline-divided
footer bar holds price 19/800 + struck `was`, a green-dot "In stock · ships today"
line, and a pill **Add** button calling `requireAuth(() => addToCart(id, 1))`.
Fit chip cycles: "Check fit" → spinner "Checking…" → green "Fits your 2019 Camry".
Lists stack cards with `gap: 14` (no dividers).

**Product card (compact grid tile)** — still used for *Related parts* and
*Compatible parts* 2-col grids on Item Detail / Vehicle Detail: `card` bg, 16-radius,
image (120h) with "SAVE X%" pill, title, OEM pill, price + struck was + ★rating.

**OEM pill**: inline chip, `backgroundSecondary` bg, 1px border, 6-radius, mono
font 10.5px; bold "OEM" label + the number, muted.

### 6. Top Featured
Header "Top Featured" + vertical list of **product result rows** for all `featured`
products.

### 7. Item Detail
Scroll area with a **sticky bottom bar**.
- Header: back + right "favorite" (heart) button (toast "Saved to favorites").
- **Hero**: image (240h, 20-radius) + carousel dots (active dot elongated).
- Brand (13/600 muted) + ★rating row; Title (24/700); OEM pill + "N reviews".
- Price block: 30/700 price, struck `was`, green "Save $X" pill.
- **Confirmed-fit** card: success-green check + "Confirmed fit" +
  "2019 Toyota Camry SE 2.5L".
- **Quantity** stepper (− value +) with 42px bordered buttons; "In stock · ships
  today" in success green.
- **Spec table**: rows Fitment / Position / Warranty / Part type (bordered,
  divider between rows).
- **Related parts**: 2-col grid (same category).
- **Sticky bottom bar**: left = "Total" + `price × qty` (20/700); right = primary
  "Add to cart" (adds qty to cart, shows toast, resets qty to 1).

### 8. Garage — Garage tab root
- Header "My Garage" (26/700) + brand "+ Add" button → AddVehicle.
- Subtitle "Set an active vehicle to filter every part by exact fit."
- **Vehicle cards**: 18-radius, image (130h) with an "ACTIVE" pill (brand) on the
  active one; body shows "YEAR MAKE MODEL" (18/700) and "trim · color · mileage".
  Two buttons: **"Set active"/"View parts"** (primary; sets active w/ toast, or if
  already active navigates to detail) + **"Details"** (ghost) → VehicleDetail.
- **Empty state** (if no vehicles): dashed 72px tile w/ car icon, "No vehicles yet",
  "Add your first vehicle to unlock guaranteed-fit parts.", primary "Add vehicle".

Seed vehicles:
- **v1** Toyota Camry 2019, SE 2.5L, VIN `4T1B11HK1KU`, Midnight Black, 48,200 mi
  (active by default).
- **v2** Honda Civic 2021, Sport 1.5T, VIN `2HGFC2F58MH`, Sonic Gray, 19,750 mi.

### 9. Add Vehicle
- Header "Add vehicle". Grid of Make / Model inputs; Year input. Divider
  "OR ENTER VIN". VIN input + brand **"Scan VIN"** button → ScanVIN. Primary
  "Save vehicle" (validates make+model, adds vehicle, sets active, toast, → Garage).

### 10. Scan VIN (fullscreen camera modal)
- Black screen, back button + "Scan VIN" title. A viewfinder frame (78% wide, 90h,
  rounded) with a dark overlay (`box-shadow: 0 0 0 999px rgba(0,0,0,.45)`) and an
  animated green scan line sweeping vertically. Caption "ALIGN VIN BARCODE WITHIN
  FRAME". Bottom: white **"Capture VIN"** (sets VIN to `4T1B11HK1KU789023`, toast
  "VIN detected", returns) + ghost "Enter manually".
- In the real app, wire to `expo-camera` / a barcode scanner.

### 11. Vehicle Detail
- Header "MAKE MODEL". Image (170h). Info: "YEAR MAKE MODEL" (22/700) +
  "trim · color", "ACTIVE" pill if active.
- 2-col spec grid: VIN, Mileage, Trim, Color.
- "Compatible parts" 2-col grid (subset of products).
- Actions: "Set active" (ghost) + "Remove" (ghost; removes vehicle, toast, → Garage).

### 12. Cart — Cart tab root
- **Empty state**: "Cart" header + shopping-bag empty state → Explore.
- **Populated**: header "Cart · N items". Line items: card w/ image (84), title,
  OEM pill, line price (16/700), qty stepper (30px − value +), and an "✕" remove.
- **Sticky footer**: Subtotal, Est. tax (**6%**), Total (20/700), primary
  "Checkout" → Checkout.
- Seed cart: `p1` ×1 (Ceramic Brake Pads), `p3` ×4 (Iridium Spark Plug).

### 13. Checkout
- Header "Checkout", sticky bottom "Place order · $Total".
- **Shipping address** section-card (label + "Change" opens address bottom sheet):
  default = Home / Alex Marino / 2140 Chestnut St, Apt 6 / Philadelphia, PA 19103.
- **Payment** section-card ("Change" opens payment sheet): default = Visa ···· 4821,
  exp 08/27.
- **Free 2-day shipping** info card ("Arrives Fri, Jul 4").
- **Order summary**: per-line `title × qty` = price, then Subtotal, Tax, Total.
- "Place order" → generates order # `MTR-######`, clears cart, → OrderConfirmation.

### 14. Order Confirmation
- Centered success circle (88px, success-green) with a check (pops in). "Order
  placed" (26/700), "Thanks, Alex. A confirmation has been sent to your email."
- Receipt card: Order number (mono/700), Total, divider, line items.
- Primary "Track order" → TrackOrder; ghost "Continue shopping" → Explore.

### 15. Track Order
- Header "Track order". Map placeholder image (180h). **Brand ETA card**:
  "ARRIVING TODAY" / "by 6:00 PM" + order #.
- **Vertical timeline**: Order confirmed → Packed at warehouse → Out for delivery
  (active) → Delivered (pending). Completed nodes = brand-filled with check +
  connecting line; pending = bordered/muted.
- Ghost "Back to shopping".

### 16. AI Chat — Assistant tab root
- Header: brand "AI" avatar + "Parts Assistant" + "● Online · fits your Camry"
  (success green).
- Message list: AI bubbles (card bg, bordered, left-aligned, tail bottom-left);
  user bubbles (brand bg, right-aligned, tail bottom-right). AI replies can surface
  an **inline product card** (image + title + OEM pill + price + rating) → ItemDetail.
- **Suggestion chips**: "Brakes squeaking", "Need an oil filter", "Check engine
  light", "Best spark plugs" — tapping sends that message.
- Input bar: rounded text field + circular brand send button (`arrow-upward`).
  Enter sends. (Prototype uses a canned reply recommending `p1`; wire to real
  assistant / `window.claude`-style completion in the app if desired.)

### 17. Profile — Profile tab root
- Header: 64px avatar ("AM" monogram), "Alex Marino" (21/700),
  "alex.marino@email.com", a "★ Mator Pro member" pill.
- **Stats row**: 12 Orders · 2 Vehicles · $1.2k Saved (3 equal cards).
- **List rows** (leading icon tile + title + sub + chevron):
  - Edit profile — "Name, email, phone" — icon `person`
  - Order history — "12 past orders" — `receipt-long`
  - Shipping addresses — "2 saved" — `local-shipping`
  - Payment methods — "Visa ···· 4821" — `credit-card`
  - Recently viewed — "Pick up where you left off" — `history`
  - Notifications — "Push, email & SMS" — `notifications`
  - Settings & security — "Password, privacy" — `shield`
- Ghost "Sign out" → SignIn.

### 18. Edit Profile
Centered 92px avatar with a small brand edit-badge; inputs Full name / Email /
Phone (prefilled: Alex Marino / alex.marino@email.com / +1 (215) 555-0139);
primary "Save changes" (toast "Profile updated", back).

### 19. Order History
List of past-order cards (tap → TrackOrder): order # (mono/700), status pill
(Delivered = success, Refunded = warning), "date · N items", total (16/700).
Seed: MTR-482910 ($129.97, Jun 24), MTR-471002 ($64.99, May 30), MTR-460418
($211.49, Apr 12), MTR-451190 ($27.50 Refunded, Mar 03).

### 20. Shipping Addresses
Header + "+ Add" (toast). Address cards (default one gets brand border + "DEFAULT"
pill): label, name, street, city; "Edit" (ghost) + "Remove" (error-colored) links.
Seed: Home (default) + Work (see Checkout data).

### 21. Payment Methods
Header + "+ Add" (toast). Card-shaped tiles (default = brand-filled): brand name,
masked "···· ···· ···· last4", cardholder "Alex Marino", exp. Seed: Visa 4821
(08/27, default), Mastercard 9037 (11/26).

### 22. Recently Viewed
Header + 2-col product grid (subset of products).

### 23. Notification Settings
Grouped toggle lists:
- **Push**: Order updates (on), Price drops on saved parts (on), Back in stock
  (off), New arrivals (off)
- **Email**: Order receipts (on), Weekly deals (on), Product tips (off)
- **SMS**: Delivery alerts (on), Promotions (off)
Toggle = 46×27 pill track, brand when on, 21px knob.

### 24. Settings & Security
- **Account**: "Change password" (`lock`, sub "Last changed 3 months ago"),
  "Language" (`language`, shows current) → SelectLanguage.
- **Security** toggles: Face ID login (on), Two-factor authentication (on),
  Hide order history (off).
- **Appearance** toggle: **Dark mode** (drives the global theme).
- Error-colored "Delete account" text button (toast).

### 25. Notifications
Feed list (leading colored dot + title + relative time + body + unread dot):
Out for delivery (info, 2m, unread), Price drop (green, 1h, unread), Back in stock
(warning, 5h), Order delivered (success, 2d), Welcome to Mator Pro (gold, 1w).
Header right: "Mark all read" (toast).

---

## Loaders (wheel spinner) — NEW
The alloy-wheel glyph (the logo "O") doubles as the app's loading indicator, so
loading feels on-brand. Build one `WheelLoader` and reuse it in three places:
1. **Splash** — large wheel spins while the app boots.
2. **List loading overlay** — opening a Category or a Make shows a full-area overlay
   (translucent blurred background) with a centered ~46px spinning wheel + label
   ("Finding parts that fit…" / "Loading models…"), ~850ms simulated fetch, then the
   results render. Wire this to your real data-fetch pending state.
3. **Pull-to-refresh** — on Explore, pulling down past threshold reveals a 52px bar
   under the status bar with a ~22px spinning wheel + "Refreshing…"; on release it
   refreshes (~1.2s), then a "Prices & stock updated" toast.

**RN implementation.** Rebuild the wheel as `react-native-svg` and spin it with
Reanimated (or `Animated`), and use the built-in `RefreshControl` for pull-to-refresh:

```jsx
// WheelLoader.jsx — the spinning wheel mark
import Svg, { Circle, Line } from 'react-native-svg';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { useEffect } from 'react';

export function WheelLoader({ size = 40, color = '#050505' }) {
  const rot = useSharedValue(0);
  useEffect(() => { rot.value = withRepeat(withTiming(360, { duration: 2600, easing: Easing.linear }), -1); }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const spokes = [0,72,144,216,288].map(a => { const r=(a-90)*Math.PI/180; return [50+30*Math.cos(r), 50+30*Math.sin(r)]; });
  const lugs   = [36,108,180,252,324].map(a => { const r=(a-90)*Math.PI/180; return [50+15*Math.cos(r), 50+15*Math.sin(r)]; });
  return (
    <Animated.View style={style}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r="45" fill="none" stroke={color} strokeWidth={10} />
        <Circle cx="50" cy="50" r="31" fill="none" stroke={color} strokeWidth={6} />
        {spokes.map(([x,y],i) => <Line key={i} x1="50" y1="50" x2={x} y2={y} stroke={color} strokeWidth={9} strokeLinecap="round" />)}
        <Circle cx="50" cy="50" r="11" fill={color} />
        {lugs.map(([x,y],i) => <Circle key={i} cx={x} cy={y} r="2.6" fill={color} />)}
      </Svg>
    </Animated.View>
  );
}

// Pull-to-refresh on the Explore list
<FlatList
  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.text} />}
  … />
// (For a fully branded pull indicator, render your own WheelLoader bar driven by a
//  scroll-offset shared value instead of the stock RefreshControl spinner.)

// Full-area list loader overlay
{loading && (
  <View style={StyleSheet.absoluteFill /* + centered, translucent bg, expo-blur */}>
    <WheelLoader size={46} color={theme.text} />
    <Text>{loadLabel}</Text>
  </View>
)}
```
Geometry (viewBox 100×100): outer tire ring `r=45 stroke=10`, inner rim `r=31
stroke=6`, 5 spokes at 0/72/144/216/288° (`strokeWidth=9`, round caps) from center
to `r=30`, hub `r=11`, and 5 lug bolts at 36/108/180/252/324° on `r=15`. Spin =
360° / 2.6s linear, infinite.

## Reusable Components to Build
- `WheelMark` (SVG, spinnable) & `Logo` wordmark
- `WheelLoader` — the spinning wheel used everywhere (see Loaders above)
- `PrimaryButton` / `GhostButton` (full-width default; `sm` size variant)
- `Pill` / `Chip` (selectable)
- `OemPill`
- `ProductCard` (grid) & `FeaturedCard` (carousel) & inline `ChatProductCard`
- `QtyStepper`
- `ListRow` (leading icon tile + title + sub + chevron/trailing)
- `SectionHeader` (title + optional "See all")
- `Toggle` (switch)
- `Badge` / count badge
- `SegmentedControl` (if used for filters)
- `BottomSheet` (address picker, payment picker) — use `@gorhom/bottom-sheet`
- `Toast` (auto-dismiss 2.2s) — a top-level provider
- `FitBanner`, `EmptyState`, `StatusTimeline`, `SpecTable`
- `ScreenHeader` (back + title + right slot)

## State Management
Keep it light (Context + reducer, or Zustand). Slices:
- **theme**: `'light' | 'dark'` (toggle from Settings & the dev header).
- **auth**: `authed` (boolean, starts `false`), a `pendingAction` (the buy action to
  resume after login), and `lang` (`'ru' | 'en' | 'uz'`, default `'ru'`). See Auth
  Model — `requireAuth`/`completeAuth` drive the purchase gate.
- **garage**: `vehicles[]`, `activeVehicleId`. Active vehicle drives the fit banner
  and "Confirmed fit" copy across the app. Add/remove/setActive actions.
- **cart**: `[{ id, qty }]`. Derived: `cartCount` (Σ qty), `subtotal`, tax (6%),
  total. add/removeItem/setQty. Feeds the tab badge.
- **orders**: `lastOrder` (num, items snapshot, total, date) set on placeOrder;
  plus static order-history seed.
- **chat**: message list; sending appends a user msg + a canned/assistant reply
  (optionally with a `productId` to render an inline card).
- **settings toggles**: per-key booleans for notification & security switches.

### Data model (seed data lives in the prototype's `products`, `addresses`,
`cards`, `vehicles`, order-history arrays — copy these verbatim as mock fixtures)
- **Product**: `{ id, title, oem, price, was?, rating, reviews, cat, brand, img,
  featured? }`. 10 seed products (brake pads, oil filter, spark plug, cabin/air
  filters, wiper set, alternator, drive belt, rotor, AGM battery) with realistic
  OEM numbers (e.g. `90915-YZZE1`, `SK20R11`, `43512-0E010`).
- **Vehicle**, **Address**, **Card**: see screen sections above.
- Tax rate: **6%**. Order numbers: `MTR-` + 6 digits.

---

## RN Translation Notes (web → React Native)
- `display:flex` is default in RN; set `flexDirection` explicitly (`row` where the
  web uses row — RN defaults to `column`).
- No CSS `gap` on older RN — use a spacer or `gap` (supported in recent RN) / margins.
- `box-shadow` → iOS `shadowColor/Opacity/Radius/Offset` + Android `elevation`.
- Horizontal chip/carousel rows → `ScrollView horizontal` or `FlatList`.
- Sticky bottom bars (Item/Cart/Checkout) → absolutely-positioned footer or a fixed
  view outside the `ScrollView`; add safe-area insets.
- `background: repeating-linear-gradient` (image placeholders, tread bands, scan
  frame) → `expo-linear-gradient` or a small `react-native-svg` pattern; for real
  product images use `expo-image`.
- Material Symbols → `@expo/vector-icons` MaterialIcons/MaterialCommunityIcons.
  Icon map per screen is listed above (search, directions-car, shopping-bag, person,
  auto-awesome, notifications, chevron-left/right, favorite, add, remove,
  arrow-upward, receipt-long, local-shipping, credit-card, history, shield, lock,
  language, check).
- Toggle → RN `Switch` (styled) or a custom animated pill to match exactly.
- Respect safe-area (notch/home indicator) via `react-native-safe-area-context` —
  the prototype fakes a status bar + home indicator; use real insets instead.

## Assets
- **Logo / wheel**: rebuild as `react-native-svg` (no raster needed) — geometry above.
- **Part illustrations**: `assets/part-illustrations/` — 13 ready flat-vector SVGs
  (oil-filter, brake-rotor, wheel, clutch, oil-bottle, wiper, ac-compressor,
  air-filter, headlight-projector, headlight-chrome, piston, strut, battery). Use as
  product/category art. Render with `react-native-svg` + `react-native-svg-transformer`
  (import as components) or `expo-image` (SVGs render directly). Stylized, not photos.
- **Product & vehicle images**: placeholders in the prototype. Source real photos
  (or map-tile for Track Order) and drop into `assets/`.
- **Fonts**: Figtree + Raleway (logo/display) via `@expo-google-fonts/*`.
- **Icons**: category/vehicle icons are custom `react-native-svg` (see Explore); UI
  glyphs use `@expo/vector-icons` (bundled with Expo).

## Files
- `prototype/Mator.dc.html` — the full interactive design reference (all 23+
  screens, both themes, all flows). Open in a browser to inspect exact spacing,
  colors, copy, and interactions. All mock data (products, vehicles, addresses,
  cards, orders, notifications, chat) is defined at the top of its logic class.
