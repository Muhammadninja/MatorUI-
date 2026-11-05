import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
  type SetStateAction,
} from 'react';

import { cartTransport, type AddItemInput } from '@/services/cart-api';
import {
  computeSubtotal,
  computeTotals,
  evaluatePromoCode,
  formatCurrency,
  PROMO_CODES,
  type CartItem,
  type CartTotals,
  type PromoCode,
  type PromoResult,
} from '@/services/cart-math';
import { clearStoredCart, loadCart, saveCart } from '@/services/cart-storage';
import { toastService } from '@/services/toast-service';
import { useUserContext } from '@/contexts/user.context';
import { CartMutationQueue } from '@/services/cart-mutation-queue';

// Re-export types and constants so existing imports keep working without churn.
export type { CartItem, CartTotals, PromoCode, PromoResult };

type AddCartItemInput = Omit<CartItem, 'quantity'>;

type CartContextValue = {
  items: CartItem[];
  itemCount: number;
  totals: CartTotals;
  appliedPromo: PromoCode | null;
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
  /** Puts these lines back on the server after an order took them and went unpaid, and
   *  resolves with the cart as it then stands. Safe to repeat: adds only what is missing. */
  restoreCart: () => Promise<CartItem[]>;
  incrementItem: (itemId: string) => void;
  decrementItem: (itemId: string) => void;
  applyPromoCode: (code: string) => PromoResult;
  removePromoCode: () => void;
  formatCurrency: (amount: number) => string;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);

const PROMO_PENDING_ID = '__promo__';

export function CartProvider({ children }: PropsWithChildren) {
  const { profile, isHydrating } = useUserContext();
  const ownerId = profile?.id ?? null;
  return <CartSessionProvider key={ownerId ?? 'guest'} ownerId={ownerId} hydrating={!!isHydrating}>{children}</CartSessionProvider>;
}

function CartSessionProvider({ children, ownerId, hydrating }: PropsWithChildren<{ ownerId: string | null; hydrating: boolean }>) {
  const [items, setItemsState] = useState<CartItem[]>([]);
  const [appliedPromo, setAppliedPromoState] = useState<PromoCode | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [mutations] = useState(() => new CartMutationQueue());
  useEffect(() => {
    cartTransport.setSession?.(ownerId);
    return () => { mutations.invalidate(true); };
  }, [mutations, ownerId]);

  // The server-side cart endpoints require auth. Guests use a purely LOCAL cart
  // (persisted to storage); we only talk to the remote cart once signed in —
  // otherwise every mutation 401s and rolls the change back. A ref keeps the
  // async transport gate reading the CURRENT auth state, not a stale closure.
  const { isAuthenticated } = useUserContext();
  const authedRef = useRef(isAuthenticated);
  useEffect(() => {
    if (authedRef.current !== isAuthenticated) {
      mutations.invalidate(true);
      setPendingIds(new Set());
    }
    authedRef.current = isAuthenticated;
  }, [isAuthenticated, mutations]);

  // Always-current snapshot for rollback during optimistic mutations.
  // We can't rely on closure values inside async callbacks because they
  // capture stale state from the moment the mutation was queued.
  const snapshotRef = useRef<{ items: CartItem[]; appliedPromo: PromoCode | null }>({
    items: [],
    appliedPromo: null,
  });
  // Update the intended state immediately: multiple taps can precede a render.
  const setItems = useCallback((update: SetStateAction<CartItem[]>) => {
    const next = typeof update === 'function' ? update(snapshotRef.current.items) : update;
    snapshotRef.current = { ...snapshotRef.current, items: next };
    setItemsState(next);
  }, []);
  const setAppliedPromo = useCallback((promo: PromoCode | null) => {
    snapshotRef.current = { ...snapshotRef.current, appliedPromo: promo };
    setAppliedPromoState(promo);
  }, []);

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
    if (hydrating) return;
    let cancelled = false;
    const hydrate = async () => {
      const stored = await loadCart(ownerId);
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
  }, [hydrating, ownerId]);

  // ── Reconcile with the server whenever we're signed in. This runs on every
  // transition into an authenticated state — not just at mount — because auth
  // is restored asynchronously on relaunch and may not be ready when hydrate
  // fires. Beyond syncing state, the fetch WARMS the transport's part_id →
  // line_id map for the persisted cart, so a subsequent quantity update PATCHes
  // the right line instead of 404ing on a cold map.
  useEffect(() => {
    if (!isAuthenticated || !isHydrated) return;
    let cancelled = false;
    const version = mutations.readVersion();
    void (async () => {
      try {
        const remote = await mutations.read(() => cartTransport.fetch());
        if (!remote || cancelled || version !== mutations.readVersion()) return;
        // A successful authenticated response is authoritative, including an
        // empty cart. Cached lines must not survive only in the UI and inflate
        // checkout totals. Failed fetches still retain the offline cache.
        setItems(remote.items);
        const promo = remote.appliedPromoCode ? PROMO_CODES[remote.appliedPromoCode] : null;
        setAppliedPromo(promo ?? null);
      } catch {
        // Offline / fetch failed — silently keep local state. The transport
        // self-heals the id map lazily on the next mutation if needed.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isHydrated]);

  // ── Debounce-write to local cache after every change.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isHydrated) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (items.length === 0 && !appliedPromo) {
        void clearStoredCart(ownerId);
      } else {
        void saveCart({ items, appliedPromo }, ownerId);
      }
    }, 250);
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [items, appliedPromo, isHydrated, ownerId]);

  // ── Optimistic mutation helper ────────────────────────────────────
  const withOptimistic = useCallback(
    async <T,>(
      pendingId: string,
      optimistic: () => void,
      apiCall: () => Promise<T>,
      operationName: string,
      reconcile?: (result: T) => void,
    ): Promise<T | null> => {
      const snapshot = snapshotRef.current;
      const ticket = mutations.begin(pendingId);
      const mutationVersion = mutations.readVersion();
      if (pendingId === 'cart') setPendingIds(new Set());
      optimistic();
      markPending(pendingId);
      try {
        // Guests: local-only cart. Skip the server call (it requires auth and
        // would 401 → rollback). The optimistic update still persists to storage.
        const result = authedRef.current ? await mutations.enqueue(ticket, apiCall) : undefined;
        if (mutations.isLatest(ticket)) {
          if (result !== undefined) reconcile?.(result);
          setError(null);
        }
        return result ?? null;
      } catch (err) {
        if (!mutations.isLatest(ticket)) return null;
        // Keep optimistic changes to other items when this request fails.
        if (pendingId === 'cart') {
          // A later action must survive a failed clear.
          if (mutations.readVersion() === mutationVersion) {
            setItems(snapshot.items);
            setAppliedPromo(snapshot.appliedPromo);
          }
        } else if (pendingId === PROMO_PENDING_ID) {
          setAppliedPromo(snapshot.appliedPromo);
        } else {
          const previous = snapshot.items.find((item) => item.id === pendingId);
          setItems((current) => {
            if (previous && current.some((item) => item.id === pendingId)) {
              return current.map((item) => item.id === pendingId ? previous : item);
            }
            const remaining = current.filter((item) => item.id !== pendingId);
            if (previous) remaining.splice(Math.min(snapshot.items.indexOf(previous), remaining.length), 0, previous);
            return remaining;
          });
        }
        const message = err instanceof Error ? err.message : `${operationName} failed`;
        setError(message);
        toastService.danger(message, {
          description: 'Cart was rolled back. Try again.',
        });
        // Earlier same-item responses may have been superseded. Read the
        // canonical cart after queued writes, without replacing newer intent.
        const version = mutations.readVersion();
        try {
          const remote = await mutations.enqueue(ticket, () => cartTransport.fetch());
          if (remote && version === mutations.readVersion()) {
            setItems(remote.items);
            setAppliedPromo(remote.appliedPromoCode ? PROMO_CODES[remote.appliedPromoCode] ?? null : null);
          }
        } catch { /* Offline: retain the scoped rollback. */ }
        return null;
      } finally {
        if (mutations.finish(ticket)) clearPending(pendingId);
      }
    },
    [markPending, clearPending, mutations],
  );

  const reconcileItem = useCallback((id: string, canonical: CartItem | null) => {
    setItems((current) => {
      if (!canonical) return current.filter((item) => item.id !== id);
      return current.some((item) => item.id === id)
        ? current.map((item) => item.id === id ? { ...item, ...canonical } : item)
        : [...current, canonical];
    });
  }, []);

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
        (item) => reconcileItem(incomingItem.id, item),
      );
    },
    [withOptimistic, reconcileItem],
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
        (item) => reconcileItem(itemId, item),
      );
    },
    [withOptimistic, reconcileItem],
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
        (item) => reconcileItem(itemId, item),
      );
    },
    [withOptimistic, reconcileItem],
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

  // The backend empties its cart in the same transaction that creates an order, and a fresh
  // fetch treats the server as the truth. So leaving the local lines alone after a failed
  // payment would only last until the next launch, and a quantity change before then would
  // hit a line that no longer exists. This puts them back for real. A line that cannot go
  // back (a sourced offer, a service, a part no longer sold) stays out and drops from the
  // cart on the final read: it is still on the unpaid order, which can still be paid.
  const restoreCart = useCallback(async (): Promise<CartItem[]> => {
    const { items: wanted, appliedPromo: promo } = snapshotRef.current;
    if (!authedRef.current) return wanted;
    const ticket = mutations.begin('cart');
    const version = mutations.readVersion();
    setPendingIds(new Set());
    markPending('cart');
    try {
      const remote = await mutations.enqueue(ticket, async () => {
        const current = await cartTransport.fetch();
        for (const line of wanted) {
          const have = current.items.find((item) => item.id === line.id)?.quantity ?? 0;
          if (line.sourced || have >= line.quantity) continue;
          try {
            await cartTransport.addItem({
              productId: line.id,
              title: line.title,
              description: line.description,
              price: line.price,
              priceLabel: line.priceLabel,
              badge: line.badge,
              status: line.status,
              imageUrl: line.imageUrl,
              quantity: line.quantity - have,
            });
          } catch {
            // No longer sold. The final read below is what the cart then holds.
          }
        }
        if (promo && current.appliedPromoCode !== promo.code) {
          try {
            await cartTransport.applyPromo(promo.code, computeSubtotal(wanted));
          } catch {
            // The promo was on the order. Without it the buyer sees the price they'd pay.
          }
        }
        return cartTransport.fetch();
      });
      if (remote && version === mutations.readVersion()) {
        setItems(remote.items);
        setAppliedPromo(remote.appliedPromoCode ? PROMO_CODES[remote.appliedPromoCode] ?? null : null);
      }
    } catch {
      // Offline: the local lines stay for now, and the unpaid order is safe either way.
    } finally {
      if (mutations.finish(ticket)) clearPending('cart');
    }
    return snapshotRef.current.items;
  }, [mutations, markPending, clearPending, setItems, setAppliedPromo]);

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
    if (!authedRef.current) return;
    const version = mutations.readVersion();
    try {
      const remote = await mutations.read(() => cartTransport.fetch());
      if (!remote || version !== mutations.readVersion()) return;
      setItems(remote.items);
      const promo = remote.appliedPromoCode ? PROMO_CODES[remote.appliedPromoCode] : null;
      setAppliedPromo(promo ?? null);
      setError(null);
    } catch (err) {
      if (version !== mutations.readVersion()) return;
      const message = err instanceof Error ? err.message : 'Refresh failed';
      setError(message);
      toastService.danger('Could not refresh cart', { description: message });
    }
  }, [mutations, setItems, setAppliedPromo]);

  // ── Derived ───────────────────────────────────────────────────────
  const itemCount = useMemo(
    () => items.reduce((total, item) => total + item.quantity, 0),
    [items],
  );

  const totals = useMemo<CartTotals>(
    () => computeTotals(subtotal, appliedPromo),
    [subtotal, appliedPromo],
  );

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount,
      totals,
      appliedPromo,
      isHydrated,
      pendingIds,
      error,
      refresh,
      addItem,
      removeItem,
      clearCart,
      restoreCart,
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
      isHydrated,
      pendingIds,
      error,
      refresh,
      addItem,
      removeItem,
      clearCart,
      restoreCart,
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
