import type { CartCharges, CartItem, PromoResult } from '@/services/cart-math';

/** Live HTTP transport and public contracts. Test doubles live under tests/support. */

export type CartSnapshot = {
  items: CartItem[];
  appliedPromoCode: string | null;
  /** What the backend says this cart costs, fee included. Absent when it has not said. */
  charges?: CartCharges | null;
};

export type AddItemInput = {
  productId: string;
  title: string;
  description: string;
  price: string;
  priceLabel?: string;
  badge?: string;
  status?: string;
  imageUrl?: string;
  /** How many to add. One unless stated. */
  quantity?: number;
};

export interface CartTransport {
  setSession?(ownerId: string | null): void;
  /** What the backend last said the cart costs, as of its latest answer to any call. */
  charges?(): CartCharges | null;
  fetch(): Promise<CartSnapshot>;
  addItem(input: AddItemInput): Promise<CartItem>;
  updateQuantity(itemId: string, quantity: number): Promise<CartItem | null>;
  removeItem(itemId: string): Promise<void>;
  clear(): Promise<void>;
  applyPromo(code: string, subtotal: number): Promise<PromoResult>;
  removePromo(): Promise<void>;
}

// ── HTTP transport (live /v1/cart, auth-gated) ───────────────────────

/**
 * Live cart transport, verified against the backend at
 * `EXPO_PUBLIC_API_BASE_URL`. All endpoints require a bearer token
 * (`apiClient` injects it) and every mutation returns the FULL canonical
 * cart:
 *
 *   GET    /v1/cart                 → ApiCart
 *   POST   /v1/cart/items           → ApiCart   (body: { part_id, quantity })
 *   PATCH  /v1/cart/items/:lineId   → ApiCart   (body: { quantity })
 *   DELETE /v1/cart/items/:lineId   → ApiCart
 *   POST   /v1/cart/clear           → ApiCart
 *   POST   /v1/cart/promo           → ApiCart   (body: { code })
 *   DELETE /v1/cart/promo           → ApiCart
 *
 * Two id spaces: the backend keys each line by its own `id`
 * (`item_01K…`) while the app/provider keys by the product's `part_id`.
 * We expose `CartItem.id = part_id` (so the provider's optimistic model
 * is unchanged) and keep an internal `part_id → line_id` map — rebuilt
 * from every response — to translate update/remove onto the right line.
 */
import { apiClient } from '@/services/api-client';
import { PROMO_CODES } from '@/services/cart-math';

/** A cart line as the backend returns it (snake_case, line-keyed). */
type ApiCartItem = {
  id: string; // cart-line id (item_01K…)
  part_id: string | null; // null for sourced-offer / service lines
  service_id?: string | null;
  title?: string;
  price?: string;
  price_uzs?: number;
  quantity: number;
  imageUrl?: string | null;
  scheduled_at?: string | null;
};

type ApiCart = {
  items?: ApiCartItem[] | null;
  promo?: { code?: string; discountUzs?: number; isValid?: boolean } | null;
  subtotal_uzs?: number;
  discount_uzs?: number;
  service_fee_uzs?: number;
  /** Everything but delivery: the goods after discount, plus the service fee. */
  total_uzs?: number;
};

const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

/**
 * What the backend says the cart costs, or null when it did not say all of it. A backend
 * that names no fee has not said there is none, so nothing is assumed: the checkout then
 * shows no total and cannot place the order.
 */
export function parseCartCharges(cart: ApiCart | undefined | null): CartCharges | null {
  if (!cart) return null;
  const { subtotal_uzs, discount_uzs, service_fee_uzs, total_uzs } = cart;
  if (!isAmount(subtotal_uzs) || !isAmount(service_fee_uzs) || !isAmount(total_uzs)) {
    return null;
  }
  return {
    subtotal: subtotal_uzs,
    discount: isAmount(discount_uzs) ? discount_uzs : 0,
    serviceFee: service_fee_uzs,
    total: total_uzs,
  };
}

/** Server-enforced max quantity per cart line — the backend 400s above this,
 *  so clamp client-side to keep the stepper from hitting a hard error. */
const MAX_CART_QUANTITY = 999;

export class HttpCartTransport implements CartTransport {
  /** part_id → cart-line id, rebuilt from every server response. */
  private lineIdByPart = new Map<string, string>();
  private ownerId: string | null | undefined;
  private epoch = 0;
  private lastCharges: CartCharges | null = null;

  setSession(ownerId: string | null): void {
    if (this.ownerId === ownerId) return;
    this.ownerId = ownerId;
    this.epoch += 1;
    this.lineIdByPart.clear();
    this.lastCharges = null;
  }

  charges(): CartCharges | null {
    return this.lastCharges;
  }

  private assertSession(epoch: number): void {
    if (epoch !== this.epoch) throw new DOMException('Cart session changed', 'AbortError');
  }

  private mapItem(i: ApiCartItem): CartItem {
    return {
      // Catalog lines key by product id; sourced-offer lines have no part_id,
      // so they key by their own cart-line id instead.
      id: i.part_id ?? i.id,
      title: i.title ?? '',
      description: '',
      price:
        typeof i.price_uzs === 'number' && Number.isFinite(i.price_uzs)
          ? `UZS ${String(i.price_uzs)}`
          : i.price ?? '',
      imageUrl: i.imageUrl ?? undefined,
      // No catalog part and no service behind it → a sourced-offer line.
      sourced: !i.part_id && !i.service_id,
      quantity: i.quantity,
    };
  }

  /**
   * Resolve a product id to its server cart-line id. On a cold map — e.g.
   * right after an app relaunch, before any fetch has warmed it — refresh
   * from the server once and retry. This is what stops us from PATCH/DELETE-ing
   * a line keyed by the `part_id` (the backend keys lines by their own
   * `item_01K…` id, so a part_id there 404s "Cart item not found").
   */
  private async resolveLineId(partId: string): Promise<string | null> {
    const epoch = this.epoch;
    const known = this.lineIdByPart.get(partId);
    if (known) return known;
    await this.fetch(); // rebuilds lineIdByPart via ingest()
    this.assertSession(epoch);
    return this.lineIdByPart.get(partId) ?? null;
  }

  /** Fold a full-cart response into a CartSnapshot and refresh the id map. */
  private ingest(cart: ApiCart | undefined, epoch: number): CartSnapshot {
    this.assertSession(epoch);
    this.lineIdByPart.clear();
    const items = (cart?.items ?? []).map((i) => {
      // Key by the same id mapItem exposes, so PATCH/DELETE resolve the line id
      // for offer lines (part_id ?? line id → line id) too.
      this.lineIdByPart.set(i.part_id ?? i.id, i.id);
      return this.mapItem(i);
    });
    // Every answer is the whole cart, so its figures are always the latest the server has.
    this.lastCharges = parseCartCharges(cart);
    return { items, appliedPromoCode: cart?.promo?.code ?? null, charges: this.lastCharges };
  }

  async fetch(): Promise<CartSnapshot> {
    const epoch = this.epoch;
    return this.ingest(await apiClient.get<ApiCart>('/v1/cart'), epoch);
  }

  async addItem(input: AddItemInput): Promise<CartItem> {
    const epoch = this.epoch;
    const cart = await apiClient.post<ApiCart>('/v1/cart/items', {
      part_id: input.productId,
      quantity: input.quantity ?? 1,
    });
    const snap = this.ingest(cart, epoch);
    // Return the reconciled server line; fall back to the optimistic input
    // if the server omitted it (shouldn't happen, but keeps the type honest).
    return (
      snap.items.find((i) => i.id === input.productId) ?? {
        id: input.productId,
        title: input.title,
        description: input.description,
        price: input.price,
        priceLabel: input.priceLabel,
        badge: input.badge,
        status: input.status,
        imageUrl: input.imageUrl,
        quantity: input.quantity ?? 1,
      }
    );
  }

  async updateQuantity(itemId: string, quantity: number): Promise<CartItem | null> {
    const epoch = this.epoch;
    if (quantity <= 0) {
      await this.removeItem(itemId);
      return null;
    }
    const lineId = await this.resolveLineId(itemId);
    this.assertSession(epoch);
    if (!lineId) {
      // The line genuinely isn't on the server cart (the map was cold AND a
      // refresh still didn't find it — e.g. the cart was cleared server-side
      // while the app held a stale local copy). Recreate it instead of
      // PATCHing a nonexistent line; the backend merges by part_id on POST.
      return this.addItem({
        productId: itemId,
        title: '',
        description: '',
        price: '',
      });
    }
    const cart = await apiClient.patch<ApiCart>(
      `/v1/cart/items/${encodeURIComponent(lineId)}`,
      { quantity: Math.min(quantity, MAX_CART_QUANTITY) },
    );
    const snap = this.ingest(cart, epoch);
    return snap.items.find((i) => i.id === itemId) ?? null;
  }

  async removeItem(itemId: string): Promise<void> {
    const epoch = this.epoch;
    const lineId = await this.resolveLineId(itemId);
    this.assertSession(epoch);
    // No line for this part even after a refresh → already absent server-side,
    // so the desired end state (gone) is already met; nothing to delete.
    if (!lineId) return;
    const cart = await apiClient.delete<ApiCart>(
      `/v1/cart/items/${encodeURIComponent(lineId)}`,
    );
    // DELETE returns the updated cart; refresh the map from it.
    this.ingest(cart, epoch);
  }

  async clear(): Promise<void> {
    const epoch = this.epoch;
    this.ingest(await apiClient.post<ApiCart>('/v1/cart/clear'), epoch);
  }

  async applyPromo(code: string): Promise<PromoResult> {
    const epoch = this.epoch;
    const cart = await apiClient.post<ApiCart>('/v1/cart/promo', { code });
    this.ingest(cart, epoch);
    // The provider applies promos optimistically from its own PROMO_CODES
    // table and discards this return; we still echo an honest result.
    const applied = cart?.promo?.code ? PROMO_CODES[cart.promo.code] : undefined;
    return applied ? { ok: true, promo: applied } : { ok: false, reason: 'invalid' };
  }

  async removePromo(): Promise<void> {
    const epoch = this.epoch;
    this.ingest(await apiClient.delete<ApiCart>('/v1/cart/promo'), epoch);
  }
}

// ── Singleton ────────────────────────────────────────────────────────

/** Flips automatically based on `EXPO_PUBLIC_API_BASE_URL`. */
export const cartTransport: CartTransport = new HttpCartTransport();
