import { useCallback, type Dispatch, type SetStateAction } from 'react';
import { cartTransport } from '@/services/cart-api';
import { CartMutationQueue } from '@/services/cart-mutation-queue';
import { computeSubtotal, PROMO_CODES, type CartItem, type PromoCode } from '@/services/cart-math';
import { getAuthRequestEpoch } from '@/services/api-client';

type RestoreOptions = {
  snapshotRef: { current: { items: CartItem[]; appliedPromo: PromoCode | null } };
  authedRef: { current: boolean };
  mutations: CartMutationQueue;
  setPendingIds: Dispatch<SetStateAction<Set<string>>>;
  markPending: (id: string) => void;
  clearPending: (id: string) => void;
  setItems: (value: SetStateAction<CartItem[]>) => void;
  setAppliedPromo: (value: PromoCode | null) => void;
  syncCharges: () => void;
};

/** Restore the server-consumed cart after an unpaid order, without crossing sessions.
 * Missing/sourced lines stay on the unpaid order; the final fetch remains authoritative. */
export function useCartRestore({ snapshotRef, authedRef, mutations, setPendingIds,
  markPending, clearPending, setItems, setAppliedPromo, syncCharges }: RestoreOptions) {
  const authEpoch = getAuthRequestEpoch();
  return useCallback(async (): Promise<CartItem[]> => {
    const { items: wanted, appliedPromo: promo } = snapshotRef.current;
    if (!authedRef.current) return wanted;
    const ticket = mutations.begin('cart');
    const version = mutations.readVersion();
    const assertCurrent = () => {
      if (!mutations.isLatest(ticket) || authEpoch !== getAuthRequestEpoch()) {
        throw new DOMException('Cart restore session changed', 'AbortError');
      }
    };
    setPendingIds(new Set());
    markPending('cart');
    try {
      const remote = await mutations.enqueue(ticket, async () => {
        assertCurrent();
        const current = await cartTransport.fetch();
        assertCurrent();
        for (const line of wanted) {
          assertCurrent();
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
          // A rejected old request must not let the next line target a new owner.
          assertCurrent();
        }
        if (promo && current.appliedPromoCode !== promo.code) {
          try {
            await cartTransport.applyPromo(promo.code, computeSubtotal(wanted));
          } catch {
            // The promo was on the order. Without it the buyer sees the price they'd pay.
          }
          assertCurrent();
        }
        assertCurrent();
        const restored = await cartTransport.fetch();
        assertCurrent();
        return restored;
      });
      if (remote && version === mutations.readVersion()) {
        setItems(remote.items);
        setAppliedPromo(remote.appliedPromoCode ? PROMO_CODES[remote.appliedPromoCode] ?? null : null);
        syncCharges();
      }
    } catch {
      // Offline: the local lines stay for now, and the unpaid order is safe either way.
    } finally {
      if (mutations.finish(ticket)) clearPending('cart');
    }
    return snapshotRef.current.items;
  }, [mutations, markPending, clearPending, setItems, setAppliedPromo, syncCharges, authEpoch]);

}
