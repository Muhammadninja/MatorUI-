# Refactor — Step 3: Explore screen + Top-Featured + Item-Detail

## Goal
Same playbook applied to the **Explore tab**. The headline cleanup is
the explore screen itself, which had a full reimplementation of
`AppBlurView` inline — replacing it cut ~70 lines and erased a
duplicate maintenance surface. Then two follow-on cleanups in
top-featured and item-detail to use the primitives the previous step
introduced.

## What changed

### `components/screens/explore-screen.tsx`
The biggest win in this whole refactor sweep.

**Before** — the screen reimplemented `AppBlurView` from scratch:
- Imported `MaskedView`, `BlurView` from `expo-blur`, `Platform`,
  `StyleSheet`, raw `View` from `react-native`, `useSafeAreaInsets`,
  and `useThemeContext`.
- Maintained a local `FADE_STEPS = [0.9, 0.75, 0.6, 0.45, 0.3, 0.18,
  0.08, 0.02]` constant (a copy-paste of the same constant inside
  `AppBlurView`).
- Built the mask + fade + Platform-aware Android fallback inline.
- Wrapped the search bar + suggestions panel in an absolutely-positioned
  overlay with `paddingTop: insets.top` (also redundant with what
  `AppBlurView` already does for its children).
- Defined a StyleSheet block of 30+ lines for `blurContainer`,
  `blurFill`, `searchBarOverlay`, `maskWrapper`, `maskSolid`,
  `maskFade`, `fadeBand`.

**After** — uses the shared primitive:
```tsx
<AppBlurView contentHeight={SEARCH_BAR_HEIGHT} fadeHeight={FADE_HEIGHT}>
  <SmartSearchBar … />
  {showSuggestions ? <SearchSuggestionsPanel … /> : null}
</AppBlurView>
```

- Manual `topOffset = insets.top + SEARCH_BAR_HEIGHT + FADE_HEIGHT` now
  uses the existing `useBlurHeaderInset(SEARCH_BAR_HEIGHT, -FADE_HEIGHT)`
  hook from the same module. Same value, named intent, comment hint
  preserved.
- The raw `<View>` wrapper around the `SearchResults` virtualized list
  swapped to `<AppView>` for consistency.
- Imports dropped: `MaskedView`, `BlurView`, `Platform`, `StyleSheet`,
  `View`, `useSafeAreaInsets`, `useThemeContext`. Constants dropped:
  `FADE_STEPS`. Local destructure dropped: `scheme`, `tokens`.
- StyleSheet block at the bottom: deleted in full.

**Net diff:** 250 → 181 lines on this single file. The blur surface
behaves identically; the maintenance lives in one place now.

### `components/screens/top-featured-screen.tsx`
- The filter-button count overlay (a `position: 'absolute'`
  `AppView` + manual `tokens.white`/`tokens.black` ternaries +
  inline `AppText`) replaced with `<AppCountBadge count={selectedFilterCount} />`.
  Auto-handles the `0 → render nothing` case, the 99+ cap, and the
  auto-inverting monochrome treatment.
- The filter pressable itself was left alone — it's a pill-shaped
  toggle with a custom active/inactive background, not a square icon
  button. Doesn't fit `AppIconButton`'s shape vocabulary cleanly, and
  it's already a one-off.

### `components/screens/item-detail-screen.tsx`
- Three floating top-bar icon buttons (Back, Heart, Share) — each
  was a hand-rolled `AppPressableView` with a fixed `styles.iconButton`
  width/height and `backgroundColor: tokens.surface`. All three
  swapped to `AppIconButton`:
  - **Back** — straightforward.
  - **Heart** — uses the new `fill` prop (added to `AppIconButton`
    + `LucideLike` so toggleable filled-icon buttons work). When
    `isLiked`, the icon takes the red fill; otherwise transparent. No
    visual change.
  - **Share** — straightforward.
- `accessibilityLabel` added to each (was missing on all three).
- StyleSheet entry `iconButton: { width: 40, height: 40 }` deleted —
  the size lives on the button now.
- Dropped import: `AppPressableView` (no remaining callers).

## What was extended on a primitive

### `AppIconButton`
- New optional `fill?: string` prop, forwarded to the icon as `fill`.
  Lets toggleable lucide icons (heart, bookmark, star) take a fill
  color while in their "active" state without callers having to
  fall back to a hand-rolled pressable.
- `LucideLike` type signature extended to permit a `fill?: string`
  prop, so any lucide icon (which accepts `fill`) typechecks against
  the constraint.

## What was deliberately NOT changed
- **Top-featured's pill-shaped filter button** — it's a row-layout
  toggle, not a square icon button. Forcing it through `AppIconButton`
  would either bloat the primitive's API or distort the screen's
  layout. Left as-is.
- **The dev-only `HERO_IMAGES = [require(…), require(…), require(…)]`**
  in item-detail — placeholder asset reuse. Not part of this refactor;
  swap to real hero images comes with the catalog API integration
  step.
- **Item-detail's `Animated.ScrollView`** + parallax setup — uses raw
  Animated APIs, which is the correct primitive for this use case.
  `AppScrollView` doesn't (and shouldn't) wrap Animated.
- **`top-featured`'s `selectedFilterCount` conditional removal** — the
  `{selectedFilterCount ? … : null}` conditional was on the JSX side;
  with `AppCountBadge` auto-rendering nothing on count ≤ 0, the
  conditional is now redundant and was deleted as part of the swap.

## Best practices encoded
1. **If a screen imports the building blocks of a shared primitive,
   it should be using the primitive instead.** Explore-screen
   imported `MaskedView`, `BlurView`, `Platform`, and a copy of
   `FADE_STEPS` — every one of those is internal to `AppBlurView`.
   That's the smell that triggered this refactor; the rule for the
   codebase going forward is: if a screen reaches for
   `expo-blur`/`MaskedView` directly, it's almost certainly the wrong
   abstraction.
2. **Auto-rendering badges replace conditional wrappers.**
   `<AppCountBadge count={x} />` returning `null` when `x <= 0` is
   cleaner than every caller writing `{x > 0 ? <…/> : null}`. The
   primitive owns the empty-state contract.
3. **Accessibility labels on every icon-only button.** The
   item-detail icons had no `accessibilityLabel`s — the refactor
   surfaced and fixed three at once because the primitive REQUIRES
   one. Encoding the requirement at the type level is much stronger
   than a lint rule.

## Verification
- `npx tsc --noEmit` passes.
- `grep` for `MaskedView` / `BlurView` / `FADE_STEPS` across
  `components/screens/` → only matches inside `shared/app-blur-view`.
  The explore screen no longer carries them.
- `grep` for `iconButton` styles across the same set → zero matches.

## Net effect across step 3
- `explore-screen.tsx`: 250 → 181 lines.
- `top-featured-screen.tsx`: −20 lines (count badge collapse).
- `item-detail-screen.tsx`: −30 lines (3 icon-button collapses +
  styles entry removal).
- One shared primitive (`AppIconButton`) gained two small props
  (`fill`, `LucideLike.fill`).

## Next
With the explore tab cleared, the highest-density remaining screens
for this same refactor are:

1. **`checkout-screen.tsx`** (597 lines) — still the biggest. Express-
   pay buttons, address/payment summary cards, section headers — most
   are ad-hoc and likely candidates for either `AppButton` or new
   small primitives.
2. **`track-order-screen.tsx`** (407 lines) — courier card, status
   pill, step indicator. Some patterns overlap with checkout.
3. **The profile sub-screens** (`payment-methods`,
   `shipping-addresses`, `notification-settings`,
   `settings-security`, `edit-profile`, `order-history`,
   `recently-viewed`) — form-heavy; verify they're consuming `app-form`
   primitives correctly and tighten the ones that aren't.
