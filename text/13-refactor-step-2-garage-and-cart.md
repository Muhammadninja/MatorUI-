# Refactor — Step 2: Garage screen + Cart screen

## Goal
Same playbook as step 1, applied to the garage tab and the cart tab:
extract per-screen UI helpers into shared primitives, swap inline
patterns to existing shared components, enforce one-component-per-file.

## What changed

### New shared primitives

#### `components/shared/app-count-badge/`
Small numeric notification badge — the count overlay that sits on top
of icon buttons (cart truck, bell icons, etc). Defaults to an
auto-inverting monochrome treatment (`tokens.text` background,
`tokens.background` text) so it pops on any surface without needing
a brand color. Caps at `max` (default 99) → renders `"99+"`.

Props: `count`, `max`, `position` (5 anchors incl. `'inline'`),
`backgroundColorName`, `colorName`.

Render inside a `position: 'relative'` parent for the absolute
variants, or pass `position="inline"` to flow as a regular child.

#### `components/shared/app-loading-state/`
Centered full-area loading affordance — spinner + optional label.
Replaces the per-screen `<AppView center>...</AppView>` +
`ActivityIndicator` + caption pattern (garage, cart hydration, order
history, etc).

Props: `label`, `spinnerColorName` (default `text`), `labelColorName`
(default `gray400`), `size` (`'small' | 'large'`).

#### `components/shared/app-inline-error/`
Inline error banner — outlined card with an error-tinted message and
an optional dismiss control. Replaces the per-screen `ErrorBanner`
helpers (garage had one; cart will once the orders error path is
wired up).

Props: `message`, `onDismiss?`, `mx` (default 20), `mt` (default 8).

### Extension to an existing primitive

#### `AppIconButton`
Added two optional props so a single primitive covers both the
ghost (plain transparent) treatment used in the AI chat top bar AND
the outlined card-style treatment used by the cart truck button:

- `borderColorName?: ColorName`
- `borderWidth?: number` (defaults to 1, only drawn when
  `borderColorName` is set)

The cart truck button now collapses to:
```tsx
<AppIconButton
  Icon={Truck}
  backgroundColorName="card"
  borderColorName="border"
  colorName="text"
  accessibilityLabel="…"
/>
```

### Screen-level changes

#### `components/screens/garage-screen.tsx`
- Removed the local `LoadingState` function component → swapped for
  `<AppLoadingState label="Loading your garage…" />`.
- Removed the local `ErrorBanner` function component (and its inline
  `ErrorBannerProps` type) → both error branches now use
  `<AppInlineError message={error} onDismiss={clearError} />`.
- Dropped now-unused imports: `ActivityIndicator`, `useThemeContext`.

#### `components/screens/cart-screen.tsx`
- Top-right Truck button replaced with `AppIconButton`
  (`backgroundColorName="card"`, `borderColorName="border"`,
  `colorName="text"`). Accessibility label preserved.
- The awaiting-orders count overlay replaced with `<AppCountBadge
  count={awaitingOrders} />`. Auto-handles the 99+ cap, the
  auto-inverting colors, and the absolute-positioning anchor.
- Inline 0.5px horizontal divider replaced with
  `<AppDivider colorName="gray400" thickness={0.5} style={{
  marginHorizontal: -16 }} />` (the negative margin to bleed past
  the parent's `px={16}` goes through the new `style` prop).
- Dropped `AppPressableView` import, `scheme` destructure (both no
  longer needed after the icon-button + count-badge swap).

#### `components/screens/vehicle-detail-screen.tsx`
- The "Vehicle not found" ad-hoc pill button (an `AppPressableView`
  with a wrapper `AppView` + `AppText`) replaced with
  `<AppButton title="Go back" kind="brand" size="sm" … />`.
- Vehicle-detail-action-row is already a single-purpose
  sub-component; left untouched.

#### `components/screens/add-vehicle-screen.tsx`
- No changes — already composed of shared primitives
  (`AppBottomSheet` + `AddVehicleWizard`), clean and small.

## What was deliberately NOT changed

- **`MOCK_AWAITING_ORDERS = 2`** in cart-screen — covered by the B5
  punch-list item in doc 11. That's a data-layer fix, not a UI
  refactor.
- **The `VehicleDetailActionRow` icon prop pattern** (callers pass
  raw lucide JSX as `icon={<Pencil … />}`) — works fine and the row
  is already a single shared sub-component.
- **`CartSectionTabs` / `CartItemsSection` / `CartSummary` /
  `CartEmptyState` / `CartListsSection` / `CartBuyAgainSection`** —
  already single-purpose, single-export sub-components under
  `screens-components/cart/`. They're consumed correctly.
- **`GarageHeader`, `GarageEmptyState`, `GaragePrimaryVehicleCard`,
  `GarageVehicleTile`** — same; already single-purpose. Garage
  screen is now purely a composer.

## Best practices encoded
1. **Auto-inverting monochrome utility colors.** `AppCountBadge`
   defaults to `tokens.text` background and `tokens.background` text,
   so it pops on any surface in any theme. Same trick the search-row
   ribbon uses — when in doubt, lean on the theme's natural inversion
   instead of brand color.
2. **Loading / error states are not screen-local helpers.** Both
   patterns recur on every async surface. Centralizing them means
   future screens default to the same look without having to
   duplicate the markup.
3. **Primitives flex via theme tokens, not via hex props.**
   `AppIconButton.borderColorName: ColorName` instead of
   `borderColor: string`. Forces every caller to anchor their visual
   choice to the theme, not a literal.
4. **One container, one button.** The "Vehicle not found" pill was
   an `AppPressableView` + nested `AppView` + nested `AppText` — that
   recipe IS `AppButton`. When a screen reimplements a button, it's a
   sign the abstraction is right and the screen is wrong.

## Verification
- `npx tsc --noEmit` passes.
- `garage-screen.tsx` no longer declares `LoadingState`,
  `ErrorBanner`, or `ErrorBannerProps` — those concepts are now
  shared.
- `cart-screen.tsx` no longer reads `scheme` from theme context (no
  more theme-aware ternaries inline).
- `vehicle-detail-screen.tsx` no longer imports `AppPressableView`.
- Total lines deleted across screen files outnumber the lines added
  by the primitives, even after the doc.

## Next
Same playbook on:
1. **`checkout-screen.tsx`** (597 lines) — express-pay button row,
   summary cards, section headers — high primitive-extraction density.
2. **`track-order-screen.tsx`** (407 lines) — courier card, status
   pill, step indicator — patterns shared with checkout.
3. **Profile sub-screens** (`payment-methods`, `shipping-addresses`,
   `notification-settings`, `settings-security`,
   `edit-profile`, `order-history`, `recently-viewed`) — these are
   form-heavy; should mostly already be using `app-form` primitives,
   verify and tighten.
