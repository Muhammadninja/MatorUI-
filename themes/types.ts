export type ThemeTokens = {
  background: string;
  backgroundSecondary: string;
  productPlaceholderBackground: string;
  productPlaceholderFill: string;
  productPlaceholderSide: string;
  productPlaceholderHighlight: string;
  productPlaceholderOutline: string;
  productPlaceholderManufacturer: string;
  surface: string;
  card: string;
  onCard: string;
  text: string;
  onBackground: string;
  /** Muted body/label text per the Mator handoff (#707070 light, #9BA8AF
   *  dark). Distinct from `gray400`, which is tuned as a neutral ramp step;
   *  `textMuted` is the exact secondary-text value the design spec calls for
   *  (eyebrows, subtitles, captions). */
  textMuted: string;
  border: string;
  /** Outline for inputs and controls that need it for recognition; `border`
   *  is decorative and too faint to be a control's only boundary. */
  controlBorder: string;
  divider: string;
  overlay: string;
  primary: string;
  primaryBg: string;
  primaryPressed: string;
  onPrimary: string;
  secondary: string;
  secondaryBg: string;
  secondaryPressed: string;
  onSecondary: string;
  /** Label on `secondaryBg` — the `secondary` button's fill, which is not the
   *  `secondary` fill that `onSecondary` sits on. */
  onSecondaryBg: string;
  /** Outline of the solid `secondary` button. */
  secondaryBorder: string;
  brand: string;
  /** Teal for normal-size text: darker than `brand` so it stays readable on
   *  the page, secondary and pale teal backgrounds. Fills and icons use `brand`. */
  brandText: string;
  brandBg: string;
  brandPressed: string;
  onBrand: string;
  success: string;
  successPressed: string;
  warning: string;
  warningPressed: string;
  error: string;
  errorPressed: string;
  info: string;
  infoPressed: string;
  disabledBg: string;
  disabledFg: string;
  outlinePressedOverlay: string;
  ghostPressedOverlay: string;
  linkPressedOverlay: string;
  switchTrackOff: string;
  switchTrackOn: string;
  switchThumbOn: string;
  listPressedOverlay: string;
  textPressed: string;
  icon: string;
  gray50: string;
  gray100: string;
  gray200: string;
  gray300: string;
  gray400: string;
  white: string;
  black: string;
  /** Amber used for filled review stars. Same in light and dark — reads on
   *  both card backgrounds. */
  rating: string;
  /** Gold used for the composite "decorated / award-winning" ribbon star.
   *  Brighter in light mode (sits on a black ribbon), deeper in dark mode
   *  (sits on a white ribbon) so it never washes out. */
  accolade: string;
  /** Green used for "value / savings" ribbon icons (Cheapest, Lowest
   *  price). Tuned for ribbon-background contrast — bright in light mode
   *  (black ribbon), deeper in dark mode (white ribbon). Separate from
   *  `success` because that token is tuned for normal page backgrounds. */
  value: string;
  /** Text color that sits ON the green "SAVE X%" savings pill (`value`
   *  background). Deep green (#05310f) per the handoff so the label reads
   *  as high-contrast on the bright pill in both themes. */
  onValue: string;
  /** Near-black backdrop for badges, modal scrims, and other "always
   *  dark over content" surfaces. Theme-independent — scrims read as
   *  dark in both light and dark mode (they sit ON photographic content,
   *  not next to neutral chrome). Use instead of hardcoded
   *  `rgba(0,0,0,0.x)` values. */
  scrim: string;
  /** Bright laser-green accent for the VIN scanner sweep line. Sits ON a
   *  live camera feed (always dark), so it is theme-independent and stays
   *  the same in light and dark mode. Use instead of a hardcoded hex. */
  scannerAccent: string;
  /** Low-alpha brand tint (~12% opacity). Replaces the repeated
   *  `\`${tokens.brand}1F\`` pattern. Use for tinted fill backgrounds
   *  on brand-accented icons, badges, and highlights. */
  brandSoft: string;
  /** Low-alpha tint of `success`, for the fill behind success-state
   *  chips and badges (fit chips, "certified" pills). Derived from each
   *  theme's own `success` value, so it tracks the token rather than
   *  freezing the light-mode green. */
  successSoft: string;
  /** Low-alpha tint of `info`, for the fill behind informational badges
   *  (e.g. the "lowest price" pill). Mirrors `successSoft`. */
  infoSoft: string;
  /** Fill behind warning badges (unverified fitment). Mirrors `successSoft`. */
  warningSoft: string;
  /** Fill behind error badges (incompatible, unavailable). Mirrors `successSoft`. */
  errorSoft: string;
  /** Surface of the Garage "active vehicle" hero card. Light mode keeps the
   *  inverted black hero; dark mode uses the elevated `card` surface. It used
   *  to be `brand`, the CTA fill — which is `#fff` in dark mode, so the hero
   *  rendered as a full-width white block on the black Garage screen. */
  hero: string;
  /** Title / value text and icons on `hero`. */
  onHero: string;
  /** Secondary text on `hero` (stat labels). */
  heroMuted: string;
  /** Hairline divider on `hero`. */
  heroDivider: string;
  /** Low-alpha fill for the square icon button on `hero`. */
  heroWash: string;
  /** Surface and hairline of Home's selected-vehicle banner. */
  vehicleBanner: string;
  vehicleBannerBorder: string;
  /** Vehicle name, supporting text and "change" action on `vehicleBanner`. */
  onVehicleBanner: string;
  vehicleBannerMuted: string;
  /** Explore's add-a-car hero: gradient ends, the soft curves behind the car,
   *  its hairline, and the ground shadow under the car. Copy on it uses
   *  `onVehicleBanner` / `vehicleBannerMuted`. */
  garageHeroFrom: string;
  garageHeroTo: string;
  garageHeroShape: string;
  garageHeroShapeStrong: string;
  garageHeroBorder: string;
  garageHeroShadow: string;
  /** Accent and quiet ink for controls drawn ON a product photo, which stays
   *  white in both themes (the favourite heart). Teal at text weight, because
   *  dark `brand` is too light against white. */
  onPhotoAccent: string;
  onPhotoMuted: string;
  /** Loading pulse inside a white photo box. */
  photoShimmer: string;
  /** Fill, icon and active shadow of the tab bar's centre Assistant button. */
  assistantFab: string;
  onAssistantFab: string;
  assistantFabShadow: string;
  [key: string]: string;
};
