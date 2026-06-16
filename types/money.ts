/**
 * Mator.uz v1.0.0 money primitives.
 *
 * Wire format is **UZS integers**. Display format is the Uzbek convention
 * (thin-space-grouped digits + `so'm` suffix, e.g. `185 000 so'm`). The
 * payment bridge (Payme) needs **tiyin integers** — 1 UZS = 100 tiyin.
 *
 * Branded numeric types make it impossible to accidentally pass a tiyin
 * value into a UZS slot (or vice versa) without an explicit `toTiyin` /
 * `toUzs` call. The brand is a phantom field at the type level; values
 * are still raw `number`s at runtime — zero overhead.
 */

declare const UzsBrand: unique symbol;
declare const TiyinBrand: unique symbol;

/** Raw integer UZS. Server-issued. */
export type Uzs = number & { readonly [UzsBrand]: true };

/** Raw integer tiyin. Used only when composing a Payme handoff URL. */
export type Tiyin = number & { readonly [TiyinBrand]: true };

/**
 * Cast a `number` to `Uzs`. Use at the boundary where untyped data
 * (API response, JSON, env var) enters the app. Throws on non-integers
 * so a malformed `185000.5` doesn't silently round inside the cart.
 */
export function asUzs(value: number): Uzs {
  if (!Number.isFinite(value) || !Number.isInteger(value)) {
    throw new TypeError(`asUzs: expected integer, received ${value}`);
  }
  if (value < 0) {
    throw new RangeError(`asUzs: expected non-negative, received ${value}`);
  }
  return value as Uzs;
}

/**
 * Convert UZS → tiyin for the Payme bridge. Multiplication is exact for
 * integers up to 2^53; safe for any realistic catalog/cart total.
 *
 *   toTiyin(365_000 as Uzs)  // 36_500_000 as Tiyin
 */
export function toTiyin(uzs: Uzs): Tiyin {
  return (uzs * 100) as Tiyin;
}

/**
 * Convert tiyin → UZS. Inverse of `toTiyin`. Throws when the tiyin
 * amount doesn't represent a whole UZS — Payme should never round.
 */
export function toUzs(tiyin: Tiyin): Uzs {
  if (tiyin % 100 !== 0) {
    throw new RangeError(`toUzs: ${tiyin} tiyin is not a whole UZS amount`);
  }
  return (tiyin / 100) as Uzs;
}

/**
 * Display-format a UZS integer in the Uzbek convention.
 *
 *   formatUzs(185_000 as Uzs)  // "185 000 so'm"
 *   formatUzs(0 as Uzs)        // "0 so'm"
 *
 * Uses a thin space (U+202F) between digit groups — same character
 * Uzbek typography uses for currency and the one Apple/Google ship in
 * their uz-Latn locale rules.
 */
export function formatUzs(uzs: Uzs): string {
  return `${groupDigits(uzs)} so'm`;
}

/**
 * Display-format without the currency suffix — useful for inline price
 * blocks where the unit is rendered separately.
 *
 *   formatUzsAmount(185_000 as Uzs)  // "185 000"
 */
export function formatUzsAmount(uzs: Uzs): string {
  return groupDigits(uzs);
}

const THIN_SPACE = ' ';

function groupDigits(n: number): string {
  // Manual thin-space grouping — Intl.NumberFormat's 'uz' locale ships
  // a regular space, which line-wraps. Thin space is the right glyph
  // for currency runs.
  const sign = n < 0 ? '-' : '';
  const digits = Math.abs(Math.trunc(n)).toString();
  let out = '';
  for (let i = digits.length; i > 0; i -= 3) {
    const chunk = digits.slice(Math.max(0, i - 3), i);
    out = out ? `${chunk}${THIN_SPACE}${out}` : chunk;
  }
  return `${sign}${out}`;
}
