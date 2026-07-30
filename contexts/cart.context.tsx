import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { cartTransport, type AddItemInput } from '@/services/cart-api';
import {
  computeSubtotal,
  computeTotals,
  evaluatePromoCode,
  formatCurrency,
  FREE_SHIPPING_THRESHOLD,
  PROMO_CODES,
  type CartItem,
  type CartTotals,
  type PromoCode,
  type PromoResult,
} from '@/services/cart-math';
import { clearStoredCart, loadCart, saveCart } from '@/services/cart-storage';
import { toastService } from '@/services/toast-service';
import { useUserContext } from '@/contexts/user.context';

// Re-export types and constants so existing imports keep working without churn.
export type { CartItem, CartTotals, PromoCode, PromoResult };
export {
  FREE_SHIPPING_THRESHOLD,
  TAX_RATE,
  FLAT_SHIPPING,
} from '@/services/cart-math';

type AddCartItemInput = Omit<CartItem, 'quantity'>;

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  totals: CartTotals;
  appliedPromo: PromoCode | null;
  freeShippingThreshold: number;
  freeShippingRemaining: number;
  /** True once the persisted cart has been read from storage. */
  isHydrated: boolean;
  /** Set of item IDs currently mid-flight to the transport. UI can grey
   *  out rows or show a spinner per row using this. */
  pendingIds: Set<string>;
  /** Last transport error, if any. Cleared on the next successful op. */
  error: string | null;
  /** Force a fresh fetch from the transport, reconciling local state. */
  refresh: () => Promise<void>;
  addItem: (item: AddCartItemInput) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
  incrementItem: (itemId: string) => void;
  decrementItem: (itemId: string) => void;
  applyPromoCode: (code: string) => PromoResult;
  removePromoCode: () => void;
  formatCurrency: (amount: number) => string;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const PROMO_PENDING_ID = '__promo__';

export function CartProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  // The server-side cart endpoints require auth. Guests use a purely LOCAL cart
  // (persisted to storage); we only talk to the remote cart once signed in —
  // otherwise every mutation 401s and rolls the change back. A ref keeps the
  // async transport gate reading the CURRENT auth state, not a stale closure.
  const { isAuthenticated } = useUserContext();
  const authedRef = useRef(isAuthenticated);
  useEffect(() => {
    authedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // Always-current snapshot for rollback during optimistic mutations.
  // We can't rely on closure values inside async callbacks because they
  // capture stale state from the moment the mutation was queued.
  const snapshotRef = useRef<{ items: CartItem[]; appliedPromo: PromoCode | null }>({
    items: [],
    appliedPromo: null,
  });
  useEffect(() => {
    snapshotRef.current = { items, appliedPromo };
  }, [items, appliedPromo]);

  // ── Pending-set helpers ───────────────────────────────────────────
  const markPending = useCallback((id: string) => {
    setPendingIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
  }, []);
  const clearPending = useCallback((id: string) => {
    setPendingIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  // ── Hydrate: load the local cache instantly so the cart renders offline-first.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const stored = await loadCart();
      if (!cancelled && stored) {
        setItems(stored.items);
        if (stored.appliedPromoCode) {
          const promo = PROMO_CODES[stored.appliedPromoCode];
          if (promo) setAppliedPromo(promo);
        }
      }
      if (!cancelled) setIsHydrated(true);
    };
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Reconcile with the server whenever we're signed in. This runs on every
  // transition into an authenticated state — not just at mount — because auth
  // is restored asynchronously on relaunch and may not be ready when hydrate
  // fires. Beyond syncing state, the fetch WARMS the transport's part_id →
  // line_id map for the persisted cart, so a subsequent quantity update PATCHes
  // the right line instead of 404ing on a cold map.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void (async () => {
      try {
        const remote = await cartTransport.fetch();
        if (cancelled) return;
        // Empty server cart shouldn't wipe local; only reconcile when the
        // server actually has data (offline-first hedge).
        if (remote.items.length > 0) {
          setItems(remote.items);
          const promo = remote.appliedPromoCode ? PROMO_CODES[remote.appliedPromoCode] : null;
          setAppliedPromo(promo ?? null);
        }
      } catch {
        // Offline / fetch failed — silently keep local state. The transport
        // self-heals the id map lazily on the next mutation if needed.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  // ── Debounce-write to local cache after every change.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isHydrated) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (items.length === 0 && !appliedPromo) {
        void clearStoredCart();
      } else {
        void saveCart({ items, appliedPromo });
      }
    }, 250);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [items, appliedPromo, isHydrated]);

  // ── Optimistic mutation helper ────────────────────────────────────
  const withOptimistic = useCallback(
    async <T,>(
      pendingId: string,
      optimistic: () => void,
      apiCall: () => Promise<T>,
      operationName: string,
    ): Promise<T | null> => {
      const snapshot = snapshotRef.current;
      optimistic();
      markPending(pendingId);
      try {
        // Guests: local-only cart. Skip the server call (it requires auth and
        // would 401 → rollback). The optimistic update still persists to storage.
        const result = authedRef.current ? await apiCall() : null;
        setError(null);
        return result;
      } catch (err) {
        // Roll local state back to the pre-optimistic snapshot.
        setItems(snapshot.items);
        setAppliedPromo(snapshot.appliedPromo);
        const message = err instanceof Error ? err.message : `${operationName} failed`;
        setError(message);
        toastService.danger(message, {
          description: 'Cart was rolled back. Try again.',
        });
        return null;
      } finally {
        clearPending(pendingId);
      }
    },
    [markPending, clearPending],
  );

  // ── Public mutations (sync signature, async internals) ────────────
  const addItem = useCallback(
    (incomingItem: AddCartItemInput) => {
      const apiInput: AddItemInput = {
        productId: incomingItem.id,
        title: incomingItem.title,
        description: incomingItem.description,
        price: incomingItem.price,
        priceLabel: incomingItem.priceLabel,
        badge: incomingItem.badge,
        status: incomingItem.status,
        imageUrl: incomingItem.imageUrl,
      };
      void withOptimistic(
        incomingItem.id,
        () => {
          setItems((current) => {
            const existing = current.find((i) => i.id === incomingItem.id);
            if (existing) {
              return current.map((i) =>
                i.id === incomingItem.id ? { ...i, quantity: i.quantity + 1 } : i,
              );
            }
            return [...current, { ...incomingItem, quantity: 1 }];
          });
        },
        () => cartTransport.addItem(apiInput),
        'Add to cart',
      );
    },
    [withOptimistic],
  );

  const incrementItem = useCallback(
    (itemId: string) => {
      const current = snapshotRef.current.items.find((i) => i.id === itemId);
      const nextQty = (current?.quantity ?? 0) + 1;
      void withOptimistic(
        itemId,
        () => {
          setItems((items_) =>
            items_.map((i) => (i.id === itemId ? { ...i, quantity: i.quantity + 1 } : i)),
          );
        },
        () => cartTransport.updateQuantity(itemId, nextQty),
        'Update quantity',
      );
    },
    [withOptimistic],
  );

  const decrementItem = useCallback(
    (itemId: string) => {
      const current = snapshotRef.current.items.find((i) => i.id === itemId);
      if (!current) return;
      const nextQty = current.quantity - 1;
      void withOptimistic(
        itemId,
        () => {
          setItems((items_) =>
            items_.flatMap((i) => {
              if (i.id !== itemId) return [i];
              if (i.quantity <= 1) return [];
              return [{ ...i, quantity: i.quantity - 1 }];
            }),
          );
        },
        () => cartTransport.updateQuantity(itemId, nextQty),
        'Update quantity',
      );
    },
    [withOptimistic],
  );

  const removeItem = useCallback(
    (itemId: string) => {
      void withOptimistic(
        itemId,
        () => {
          setItems((items_) => items_.filter((i) => i.id !== itemId));
        },
        () => cartTransport.removeItem(itemId),
        'Remove from cart',
      );
    },
    [withOptimistic],
  );

  const clearCart = useCallback(() => {
    void withOptimistic(
      'cart',
      () => {
        setItems([]);
        setAppliedPromo(null);
      },
      () => cartTransport.clear(),
      'Clear cart',
    );
  }, [withOptimistic]);

  const removePromoCode = useCallback(() => {
    void withOptimistic(
      PROMO_PENDING_ID,
      () => setAppliedPromo(null),
      () => cartTransport.removePromo(),
      'Remove promo',
    );
  }, [withOptimistic]);

  const subtotal = useMemo(() => computeSubtotal(items), [items]);

  // applyPromoCode keeps its synchronous PromoResult return because callers
  // need the failure reason inline ('invalid' vs 'min_subtotal') to render
  // the right toast. We validate client-side, optimistically apply, then
  // confirm with the transport in the background.
  const applyPromoCode = useCallback(
    (code: string): PromoResult => {
      const result = evaluatePromoCode(code, subtotal);
      if (result.ok) {
        void withOptimistic(
          PROMO_PENDING_ID,
          () => setAppliedPromo(result.promo),
          () => cartTransport.applyPromo(code, subtotal),
          'Apply promo',
        );
      }
      return result;
    },
    [subtotal, withOptimistic],
  );

  const refresh = useCallback(async () => {
    try {
      const remote = await cartTransport.fetch();
      setItems(remote.items);
      const promo = remote.appliedPromoCode ? PROMO_CODES[remote.appliedPromoCode] : null;
      setAppliedPromo(promo ?? null);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Refresh failed';
      setError(message);
      toastService.danger('Could not refresh cart', { description: message });
    }
  }, []);

  // ── Derived ───────────────────────────────────────────────────────
  const itemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const totals = useMemo<CartTotals>(
    () => computeTotals(subtotal, appliedPromo),
    [subtotal, appliedPromo],
  );

  const freeShippingRemaining = useMemo(
    () => (totals.shipping > 0 ? Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal) : 0),
    [totals.shipping, subtotal],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount,
      totals,
      appliedPromo,
      freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
      freeShippingRemaining,
      isHydrated,
      pendingIds,
      error,
      refresh,
      addItem,
      removeItem,
      clearCart,
      incrementItem,
      decrementItem,
      applyPromoCode,
      removePromoCode,
      formatCurrency,
    }),
    [
      items,
      itemCount,
      totals,
      appliedPromo,
      freeShippingRemaining,
      isHydrated,
      pendingIds,
      error,
      refresh,
      addItem,
      removeItem,
      clearCart,
      incrementItem,
      decrementItem,
      applyPromoCode,
      removePromoCode,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }

  return context;
}
