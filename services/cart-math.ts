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
  shipping: number;
  tax: number;
  total: number;
};

export type PromoResult =
  | { ok: true; promo: PromoCode }
  | { ok: false; reason: 'invalid' | 'min_subtotal'; minSubtotal?: number };

// ── Constants ────────────────────────────────────────────────────────

export const TAX_RATE = 0.085;
export const FLAT_SHIPPING = 49;
export const FREE_SHIPPING_THRESHOLD = 500;
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
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Compute the full totals breakdown given a subtotal and an optional promo.
 *
 * Rules:
 *  - Shipping is FLAT_SHIPPING for any non-zero subtotal below
 *    FREE_SHIPPING_THRESHOLD, otherwise 0.
 *  - 'percent' promos apply to subtotal and respect maxDiscount cap.
 *  - 'fixed' promos cap to subtotal (no negative balances).
 *  - 'free_shipping' promos zero shipping but leave discount at 0.
 *  - Tax is computed on the discounted base (subtotal − discount), never
 *    on shipping.
 *  - All returned numbers are rounded to 2 decimal places.
 */
export function computeTotals(subtotal: number, promo: PromoCode | null): CartTotals {
  let discount = 0;
  let shipping = subtotal > 0 ? (subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : FLAT_SHIPPING) : 0;

  if (promo && subtotal > 0) {
    if (promo.kind === 'percent') {
      discount = subtotal * promo.value;
      if (promo.maxDiscount) discount = Math.min(discount, promo.maxDiscount);
    } else if (promo.kind === 'fixed') {
      discount = Math.min(subtotal, promo.value);
    } else if (promo.kind === 'free_shipping') {
      shipping = 0;
    }
  }

  const taxedBase = Math.max(0, subtotal - discount);
  const tax = taxedBase * TAX_RATE;
  const total = taxedBase + shipping + tax;

  return {
    subtotal: round(subtotal),
    discount: round(discount),
    shipping: round(shipping),
    tax: round(tax),
    total: round(total),
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
