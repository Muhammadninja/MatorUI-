import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { noBreakDigits } from '@/utils/format-price';

/**
 * Split a formatted price ("UZS 129 000", "$64.99", "280 000 so'm") into a raised
 * currency, the big whole amount, and optional superscript cents.
 */
export function splitPrice(price: string): { currency: string; amount: string; cents?: string } {
  const s = (price ?? '').trim();
  if (!s) return { currency: '', amount: '' };
  const m = s.match(/^([^\d]+)?\s*([\d\s.,'’]+)\s*([^\d]+)?$/);
  const currency = (m?.[1] ?? m?.[3] ?? '').trim();
  const num = (m?.[2] ?? s).trim();
  // Digit groups are joined with NBSP so a narrow column can never break the
  // amount in half (see `noBreakDigits`).
  const frac = num.match(/^(.*?)[.,](\d{2})$/);
  if (frac) return { currency, amount: noBreakDigits(frac[1].trim()), cents: frac[2] };
  return { currency, amount: noBreakDigits(num) };
}

export type AppPriceProps = {
  /** Pre-formatted price string, e.g. "280 000 so'm" or "$64.99". */
  value: string;
  /** Amount font size; the currency + cents affixes scale from it. Default 26. */
  size?: number;
  /** Amount color. Defaults to the theme text color. */
  color?: string;
  /** Line cap for the amount. Stays at 1 by default: the amount shrinks to fit
   *  (`adjustsFontSizeToFit`) rather than wrapping or ellipsizing. */
  numberOfLines?: number;
  /**
   * Typeface override for a surface that is set in its own font (the search
   * results are in Figtree, not the app's Inter). Pass the EXACT loaded face —
   * a custom family resolves one file per name on Android, so "bold" has to be
   * the bold face, not a `fontWeight` on top of the regular one.
   *
   * Both faces are optional and fall back to the app-wide price treatment, so
   * every other caller is untouched.
   */
  fontFamily?: { amount: string; affix: string };
};

/**
 * The app-wide price treatment (the "price theme"): a small raised currency, an
 * oversized bold amount, and tiny superscript cents — the Amazon-style look from
 * the product card. Extracted here so EVERY price (cards, cart, totals, order
 * screens) renders identically, just scaled by `size`. At `size={26}` it is
 * pixel-identical to the original product-card PriceTag.
 */
export function AppPrice({
  value,
  size = 26,
  color,
  numberOfLines = 1,
  fontFamily,
}: AppPriceProps) {
  const { tokens } = useThemeContext();
  const c = color ?? tokens.text;
  const { currency, amount, cents } = splitPrice(value);

  if (!amount) {
    return (
      <AppText
        family="heading"
        weight="bold"
        style={{
          fontSize: Math.round(size * 0.8),
          color: c,
          ...(fontFamily ? { fontFamily: fontFamily.amount } : null),
        }}
      >
        {value || '—'}
      </AppText>
    );
  }

  // Affix sizing keeps the product-card proportions at every scale
  // (currency/cents ≈ 0.42× the amount; raised ≈ 0.16× from the top).
  const affix = Math.max(9, Math.round(size * 0.42));
  const affixTop = Math.max(2, Math.round(size * 0.16));

  return (
    <AppView row align="flex-start">
      {currency ? (
        <AppText
          family="accent"
          weight="bold"
          style={{
            fontSize: affix,
            lineHeight: affix + 3,
            color: c,
            marginTop: affixTop,
            marginRight: 2,
          }}
        >
          {currency}
        </AppText>
      ) : null}
      <AppText
        family="heading"
        weight="bold"
        numberOfLines={numberOfLines}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{
          fontSize: size,
          lineHeight: size + 2,
          letterSpacing: 0.2,
          color: c,
          ...(fontFamily ? { fontFamily: fontFamily.amount } : null),
        }}
      >
        {amount}
      </AppText>
      {cents ? (
        <AppText
          family="accent"
          weight="bold"
          style={{
            fontSize: affix,
            lineHeight: affix + 3,
            color: c,
            marginTop: affixTop,
            marginLeft: 1,
          }}
        >
          {cents}
        </AppText>
      ) : null}
    </AppView>
  );
}

export default AppPrice;
