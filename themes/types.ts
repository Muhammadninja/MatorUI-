export type ThemeTokens = {
  background: string;
  backgroundSecondary: string;
  surface: string;
  card: string;
  onCard: string;
  text: string;
  onBackground: string;
  /** Muted body/label text per the Mator handoff (#707070 light, #8f8f8f
   *  dark). Distinct from `gray400`, which is tuned as a neutral ramp step;
   *  `textMuted` is the exact secondary-text value the design spec calls for
   *  (eyebrows, subtitles, captions). */
  textMuted: string;
  border: string;
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
  brand: string;
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
  /** Low-alpha brand tint (~12% opacity). Replaces the repeated
   *  `\`${tokens.brand}1F\`` pattern. Use for tinted fill backgrounds
   *  on brand-accented icons, badges, and highlights. */
  brandSoft: string;
  [key: string]: string;
};
