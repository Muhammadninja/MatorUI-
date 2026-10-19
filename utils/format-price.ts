/**
 * Price string helpers for the catalog, whose prices are pre-formatted
 * display strings (e.g. `"UZS 11,008,400"`, `"$49.99"`) rather than numbers.
 * These parse the amount + currency affix so the buy path can show
 * `price × qty` totals without a numeric price field on the model.
 */

/** Non-breaking space — the only separator a digit group may use. */
const NBSP = '\u00A0';

/**
 * Make a formatted amount unbreakable.
 *
 * The backend ships display prices with ORDINARY spaces between digit groups
 * ("UZS 38 661"), and `toLocaleString` under Hermes does the same. Android's
 * text engine treats that space as a word boundary, so a price in a narrow
 * column wraps mid-number — "38" on one line, "661" on the next, with the
 * currency stranded beside the first half. iOS usually had room and hid it.
 *
 * Swapping the separators for NBSP is the fix the garage surfaces already use
 * (`utils/mileage.ts`); this is the same rule for money. Only spaces BETWEEN
 * DIGITS are replaced — the gap before a currency word still breaks, which is
 * where a wrap belongs.
 */
export function noBreakDigits(text: string): string {
  return text.replace(/(\d)[ \u202F\u2009](?=\d)/g, `$1${NBSP}`);
}

type ParsedPrice = {
  amount: number;
  /** Leading currency text, e.g. "UZS" or "$" (empty when none). */
  prefix: string;
  /** Whether the source used fractional digits (drives total formatting). */
  hasDecimals: boolean;
};

function parsePrice(price: string): ParsedPrice | null {
  const match = price.match(/[\d.,]+/);
  if (!match) return null;
  const numeric = match[0];
  // Strip thousands separators, keep the decimal point.
  const amount = parseFloat(numeric.replace(/,/g, ''));
  if (!Number.isFinite(amount)) return null;
  const prefix = price.slice(0, match.index ?? 0).trim();
  const hasDecimals = /\.\d{1,2}\b/.test(numeric);
  return { amount, prefix, hasDecimals };
}

function groupThousands(intPart: string): string {
  return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatAmount(amount: number, hasDecimals: boolean): string {
  const fixed = hasDecimals ? amount.toFixed(2) : Math.round(amount).toString();
  const [intPart, decPart] = fixed.split('.');
  const grouped = groupThousands(intPart);
  return decPart ? `${grouped}.${decPart}` : grouped;
}

/** Format an amount using the currency affix parsed from `template`. */
function withPrefix(prefix: string, body: string): string {
  if (!prefix) return body;
  // `$` hugs the number; word affixes (UZS) get a space.
  return /^[^\w]/.test(prefix) ? `${prefix}${body}` : `${prefix} ${body}`;
}

/**
 * Multiply a display price by a quantity, preserving its currency format.
 * Falls back to the original string when the price can't be parsed.
 */
export function multiplyPrice(price: string, qty: number): string {
  const parsed = parsePrice(price);
  if (!parsed) return price;
  return withPrefix(parsed.prefix, formatAmount(parsed.amount * qty, parsed.hasDecimals));
}

/** Numeric amount of a display price, or `null` when unparseable. */
export function priceAmount(price: string): number | null {
  return parsePrice(price)?.amount ?? null;
}
