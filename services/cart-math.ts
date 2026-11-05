import i18next from 'i18next';

/**
 * Cart math primitives — pure functions and types with NO React or
 * React Native dependencies. Keeping this module React-free lets it be
 * imported and unit-tested directly with Vitest under plain Node.
 *
 * The cart context (`contexts/cart.context.tsx`) wraps these into a
 * React provider and re-exports the types for backwards compatibility.
 */

// ── Types ────────────────────────────────────────────────────────────

export type CartItem = {
  id: string;
  title: string;
  description: string;
  price: string;
  priceLabel?: string;
  badge?: string;
  status?: string;
  /** Remote image URL for the product. When absent, surfaces fall back
   *  to a generic placeholder. */
  imageUrl?: string;
  /** A sourced-offer line (no catalog part / service behind it). Drives a
   *  clean icon placeholder instead of the catalog stand-in photo when the
   *  dealer sent no image. */
  sourced?: boolean;
  quantity: number;
};

export type PromoCode = {
  code: string;
  label: string;
  kind: 'percent' | 'fixed' | 'free_shipping';
  value: number;
  maxDiscount?: number;
};

export type CartTotals = {
  subtotal: number;
  discount: number;
  /** The goods after discount. Delivery is not in here: its price depends on the
   *  address and the sellers, so only the backend's quote at checkout can state it. */
  total: number;
};

export type PromoResult =
  | { ok: true; promo: PromoCode }
  | { ok: false; reason: 'invalid' | 'min_subtotal'; minSubtotal?: number };

// ── Constants ────────────────────────────────────────────────────────

export const PROMO_MIN_SUBTOTAL = 100;

export const PROMO_CODES: Record<string, PromoCode> = {
  WELCOME10: {
    code: 'WELCOME10',
    label: '10% off your order',
    kind: 'percent',
    value: 0.1,
  },
  RIDE25: {
    code: 'RIDE25',
    label: '25% off (max $200)',
    kind: 'percent',
    value: 0.25,
    maxDiscount: 200,
  },
  FREESHIP: {
    code: 'FREESHIP',
    label: 'Free shipping',
    kind: 'free_shipping',
    value: 0,
  },
};

// ── Helpers ──────────────────────────────────────────────────────────

export function parsePrice(price: string): number {
  const numeric = Number(price.replace(/[^0-9.]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatCurrency(amount: number): string {
  // UZS is a whole-som currency (no minor unit). Digit groups are joined with a
  // non-breaking space so a narrow column can't split the amount, and the label
  // follows the active language: "369 000 сум", "369 000 soʻm", "369 000 UZS".
  const grouped = Math.round(amount)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
  const label = i18next.isInitialized ? i18next.t('common.currency') : 'UZS';
  return `${grouped} ${label}`;
}

/**
 * The totals breakdown for a subtotal and an optional promo. There is no tax line, no
 * service fee and no flat delivery fee, because the backend charges none of them.
 *
 * Rules:
 *  - 'percent' promos apply to subtotal and respect maxDiscount cap.
 *  - 'fixed' promos cap to subtotal (no negative balances).
 *  - 'free_shipping' promos discount no goods, and delivery is not priced here.
 *  - All returned numbers are rounded to 2 decimal places.
 */
export function computeTotals(subtotal: number, promo: PromoCode | null): CartTotals {
  let discount = 0;

  if (promo && subtotal > 0) {
    if (promo.kind === 'percent') {
      discount = subtotal * promo.value;
      if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
    } else if (promo.kind === 'fixed') {
      discount = Math.min(subtotal, promo.value);
    }
  }

  return {
    subtotal: round(subtotal),
    discount: round(discount),
    total: round(Math.max(0, subtotal - discount)),
  };
}

/**
 * Compute the cart's subtotal directly from a list of items. Price strings
 * are parsed loosely (any non-numeric chars stripped), then multiplied by
 * quantity. Useful both for the provider and for tests that don't want to
 * mount React.
 */
export function computeSubtotal(items: Pick<CartItem, 'price' | 'quantity'>[]): number {
  return items.reduce((sum, item) => sum + parsePrice(item.price) * item.quantity, 0);
}

/**
 * Pure version of the promo-application rule. Returns the would-be result
 * without mutating any external state — the React provider uses this to
 * decide whether to call setAppliedPromo.
 */
export function evaluatePromoCode(code: string, subtotal: number): PromoResult {
  const normalized = code.trim().toUpperCase();
  const promo = PROMO_CODES[normalized];
  if (!promo) return { ok: false, reason: 'invalid' };
  if (subtotal < PROMO_MIN_SUBTOTAL) {
    return { ok: false, reason: 'min_subtotal', minSubtotal: PROMO_MIN_SUBTOTAL };
  }
  return { ok: true, promo };
}
