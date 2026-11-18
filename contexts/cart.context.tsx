import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
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
  type CartCharges,
  type CartItem,
  type CartTotals,
  type PromoCode,
  type PromoResult,
} from '@/services/cart-math';
import { clearStoredCart, loadCart, saveCart } from '@/services/cart-storage';
import i18n from '@/services/i18n';
import { toastService } from '@/services/toast-service';
import { useUserContext } from '@/contexts/user.context';
import { CartMutationQueue } from '@/services/cart-mutation-queue';
import { useCartRestore } from '@/hooks/use-cart-restore';
import { useE2EStartupMount } from '@/hooks/use-e2e-startup-mount';

export type { CartCharges, CartItem, CartTotals, PromoCode, PromoResult };
type AddCartItemInput = Omit<CartItem, 'quantity'>;

import { EMPTY_CART_CONTEXT, type CartContextValue } from '@/contexts/cart-context-value';
import { useSessionContextValue } from '@/contexts/session-context-value';

const CartContext = createContext<CartContextValue | undefined>(undefined);

const PROMO_PENDING_ID = '__promo__';

export function CartProvider({ children }: PropsWithChildren) {
  const { profile, isHydrating } = useUserContext();
  const ownerId = profile?.id ?? null;
  const key = ownerId ?? 'guest';
  const [value, publish] = useSessionContextValue(key, EMPTY_CART_CONTEXT);
  return (
    <CartContext.Provider value={value}>
      <CartSessionProvider key={key} ownerId={ownerId} hydrating={!!isHydrating} publish={publish} />
      {children}
    </CartContext.Provider>
  );
}

function CartSessionProvider({ ownerId, hydrating, publish }: { ownerId: string | null; hydrating: boolean; publish: (value: CartContextValue) => void }) {
  useE2EStartupMount('cart-controller');
  const [items, setItemsState] = useState<CartItem[]>([]);
  const [appliedPromo, setAppliedPromoState] = useState<PromoCode | null>(null);
  const [charges, setCharges] = useState<CartCharges | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [mutations] = useState(() => new CartMutationQueue());
  useEffect(() => {
    cartTransport.setSession?.(ownerId);
    return () => { mutations.invalidate(true); };
  }, [mutations, ownerId]);

  // Guests use local storage; async transport calls read current authentication.
  const { isAuthenticated } = useUserContext();
  const authedRef = useRef(isAuthenticated);
  useEffect(() => {
    if (authedRef.current !== isAuthenticated) {
      mutations.invalidate(true);
      setPendingIds(new Set());
      setCharges(null);
    }
    authedRef.current = isAuthenticated;
  }, [isAuthenticated, mutations]);

  // Transport answers carry authoritative charges; guests have none.
  const syncCharges = useCallback(() => {
    setCharges(authedRef.current ? (cartTransport.charges?.() ?? null) : null);
  }, []);

  // Optimistic rollback reads the current snapshot instead of queued closures.
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

  // Reconcile after async auth hydration and warm the transport's part→line ID map.
  useEffect(() => {
    if (!isAuthenticated || !isHydrated) return;
    let cancelled = false;
    const version = mutations.readVersion();
    void (async () => {
      try {
        const remote = await mutations.read(() => cartTransport.fetch());
        if (!remote || cancelled || version !== mutations.readVersion()) return;
        // Successful responses, including empty carts, replace the offline cache.
        setItems(remote.items);
        syncCharges();
        const promo = remote.appliedPromoCode ? PROMO_CODES[remote.appliedPromoCode] : null;
        setAppliedPromo(promo ?? null);
      } catch {
        // Offline: retain local state; the next mutation can rebuild the ID map.
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
      _operationName: string,
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
        syncCharges();
        if (mutations.isLatest(ticket)) {
          if (result !== undefined) reconcile?.(result);
          setError(null);
        }
        return result ?? null;
      } catch {
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
        const message = i18n.t('cart.updateErrorBody');
        setError(message);
        toastService.danger(i18n.t('cart.updateErrorTitle'), { description: message });
        // Earlier same-item responses may have been superseded. Read the
        // canonical cart after queued writes, without replacing newer intent.
        const version = mutations.readVersion();
        try {
          const remote = await mutations.enqueue(ticket, () => cartTransport.fetch());
          if (remote && version === mutations.readVersion()) {
            setItems(remote.items);
            setAppliedPromo(remote.appliedPromoCode ? PROMO_CODES[remote.appliedPromoCode] ?? null : null);
            syncCharges();
          }
        } catch { /* Offline: retain the scoped rollback. */ }
        return null;
      } finally {
        if (mutations.finish(ticket)) clearPending(pendingId);
      }
    },
    [markPending, clearPending, mutations, syncCharges],
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

  const restoreCart = useCartRestore({ snapshotRef, authedRef, mutations, setPendingIds,
    markPending, clearPending, setItems, setAppliedPromo, syncCharges });

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
      syncCharges();
      setError(null);
    } catch {
      if (version !== mutations.readVersion()) return;
      const message = i18n.t('cart.refreshErrorBody');
      setError(message);
      toastService.danger(i18n.t('cart.refreshErrorTitle'), { description: message });
    }
  }, [mutations, setItems, setAppliedPromo, syncCharges]);

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
      charges,
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
      charges,
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

  useLayoutEffect(() => publish(value), [publish, value]);
  return null;
}

export function useCartContext() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error('useCartContext must be used within a CartProvider');
  }

  return context;
}
