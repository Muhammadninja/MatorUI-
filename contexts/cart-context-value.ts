import {
  computeTotals,
  type CartCharges,
  formatCurrency,
  type CartItem,
  type CartTotals,
  type PromoCode,
  type PromoResult,
} from '@/services/cart-math';

export type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  /** Local goods-only estimate before the server answers. */
  totals: CartTotals;
  /** Last server charges, null for guests/unfetched carts; may lag pending changes. */
  charges: CartCharges | null;
  appliedPromo: PromoCode | null;
  isHydrated: boolean;
  pendingIds: Set<string>;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (item: Omit<CartItem, 'quantity'>) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  /** Restores missing server lines after an unpaid order; safe to repeat. */
  restoreCart: () => Promise<CartItem[]>;
  incrementItem: (itemId: string) => void;
  decrementItem: (itemId: string) => void;
  applyPromoCode: (code: string) => PromoResult;
  removePromoCode: () => void;
  formatCurrency: (amount: number) => string;
};

// Never expose the previous owner's data or action closures while a new
// controller is mounting. Its layout effect publishes before interaction.
export const EMPTY_CART_CONTEXT: CartContextValue = {
  items: [],
  itemCount: 0,
  totals: computeTotals(0, null),
  charges: null,
  appliedPromo: null,
  isHydrated: false,
  pendingIds: new Set(),
  error: null,
  refresh: async () => undefined,
  addItem: () => undefined,
  removeItem: () => undefined,
  clearCart: () => undefined,
  restoreCart: async () => [],
  incrementItem: () => undefined,
  decrementItem: () => undefined,
  applyPromoCode: () => ({ ok: false, reason: 'invalid' }),
  removePromoCode: () => undefined,
  formatCurrency,
};
