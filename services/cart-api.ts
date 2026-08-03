import type { CartItem, PromoResult } from '@/services/cart-math';

/**
 * Transport contract for the cart. The provider mutates local state
 * optimistically, then calls one of these methods. On rejection the
 * provider rolls the local state back and surfaces the error.
 *
 * Mirrors the `GarageTransport` pattern: implement once for mock
 * (already done — `MockCartTransport`), once for HTTP (stub below),
 * then swap by changing the constant `cartTransport` export at the
 * bottom of this file.
 */

export type CartSnapshot = {
  items: CartItem[];
  appliedPromoCode: string | null;
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
};

export interface CartTransport {
  fetch(): Promise<CartSnapshot>;
  addItem(input: AddItemInput): Promise<CartItem>;
  updateQuantity(itemId: string, quantity: number): Promise<CartItem | null>;
  removeItem(itemId: string): Promise<void>;
  clear(): Promise<void>;
  applyPromo(code: string, subtotal: number): Promise<PromoResult>;
  removePromo(): Promise<void>;
}

// ── Mock transport ───────────────────────────────────────────────────

/**
 * Simulated network latency in ms. 0 keeps the mock behavior identical to
 * the previous local-only provider; bump this in dev to inspect mid-flight
 * UI states (`pendingIds`, optimistic rollback toasts, etc.).
 */
const MOCK_LATENCY_MS = 0;

/**
 * Probability (0-1) that any mock mutation rejects, used to exercise the
 * provider's rollback path during development. Default 0 (never fails).
 */
const MOCK_FAILURE_RATE = 0;

function delay(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function maybeFail(operation: string): void {
  if (MOCK_FAILURE_RATE > 0 && Math.random() < MOCK_FAILURE_RATE) {
    throw new Error(`MockCartTransport: simulated failure on ${operation}`);
  }
}

export class MockCartTransport implements CartTransport {
  private items: CartItem[];
  private appliedPromoCode: string | null;

  constructor(seed?: CartSnapshot) {
    this.items = seed ? [...seed.items] : [];
    this.appliedPromoCode = seed?.appliedPromoCode ?? null;
  }

  async fetch(): Promise<CartSnapshot> {
    await delay(MOCK_LATENCY_MS);
    return {
      items: [...this.items],
      appliedPromoCode: this.appliedPromoCode,
    };
  }

  async addItem(input: AddItemInput): Promise<CartItem> {
    await delay(MOCK_LATENCY_MS);
    maybeFail('addItem');
    const existing = this.items.find((i) => i.id === input.productId);
    if (existing) {
      existing.quantity += 1;
      return { ...existing };
    }
    const created: CartItem = {
      id: input.productId,
      title: input.title,
      description: input.description,
      price: input.price,
      priceLabel: input.priceLabel,
      badge: input.badge,
      status: input.status,
      imageUrl: input.imageUrl,
      quantity: 1,
    };
    this.items.push(created);
    return { ...created };
  }

  async updateQuantity(itemId: string, quantity: number): Promise<CartItem | null> {
    await delay(MOCK_LATENCY_MS);
    maybeFail('updateQuantity');
    if (quantity <= 0) {
      this.items = this.items.filter((i) => i.id !== itemId);
      return null;
    }
    const item = this.items.find((i) => i.id === itemId);
    if (!item) throw new Error(`Cart item ${itemId} not found`);
    item.quantity = quantity;
    return { ...item };
  }

  async removeItem(itemId: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    maybeFail('removeItem');
    this.items = this.items.filter((i) => i.id !== itemId);
  }

  async clear(): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    maybeFail('clear');
    this.items = [];
    this.appliedPromoCode = null;
  }

  async applyPromo(code: string, _subtotal: number): Promise<PromoResult> {
    await delay(MOCK_LATENCY_MS);
    maybeFail('applyPromo');
    // The mock defers to the same evaluatePromoCode the client used.
    // A real server replaces this with its own rules + state.
    const { evaluatePromoCode } = await import('./cart-math');
    const result = evaluatePromoCode(code, _subtotal);
    if (result.ok) this.appliedPromoCode = result.promo.code;
    return result;
  }

  async removePromo(): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    maybeFail('removePromo');
    this.appliedPromoCode = null;
  }
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
import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';
import { PROMO_CODES } from '@/services/cart-math';

/** A cart line as the backend returns it (snake_case, line-keyed). */
type ApiCartItem = {
  id: string; // cart-line id (item_01K…)
  part_id: string;
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
  total_uzs?: number;
};

/** Server-enforced max quantity per cart line — the backend 400s above this,
 *  so clamp client-side to keep the stepper from hitting a hard error. */
const MAX_CART_QUANTITY = 999;

export class HttpCartTransport implements CartTransport {
  /** part_id → cart-line id, rebuilt from every server response. */
  private lineIdByPart = new Map<string, string>();

  private mapItem(i: ApiCartItem): CartItem {
    return {
      id: i.part_id, // the provider keys by product id, not the line id
      title: i.title ?? '',
      description: '',
      price:
        i.price ??
        (i.price_uzs != null ? `UZS ${i.price_uzs.toLocaleString('ru-RU')}` : ''),
      imageUrl: i.imageUrl ?? undefined,
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
    const known = this.lineIdByPart.get(partId);
    if (known) return known;
    await this.fetch(); // rebuilds lineIdByPart via ingest()
    return this.lineIdByPart.get(partId) ?? null;
  }

  /** Fold a full-cart response into a CartSnapshot and refresh the id map. */
  private ingest(cart: ApiCart | undefined): CartSnapshot {
    this.lineIdByPart.clear();
    const items = (cart?.items ?? []).map((i) => {
      this.lineIdByPart.set(i.part_id, i.id);
      return this.mapItem(i);
    });
    return { items, appliedPromoCode: cart?.promo?.code ?? null };
  }

  async fetch(): Promise<CartSnapshot> {
    return this.ingest(await apiClient.get<ApiCart>('/v1/cart'));
  }

  async addItem(input: AddItemInput): Promise<CartItem> {
    const cart = await apiClient.post<ApiCart>('/v1/cart/items', {
      part_id: input.productId,
      quantity: 1,
    });
    const snap = this.ingest(cart);
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
        quantity: 1,
      }
    );
  }

  async updateQuantity(itemId: string, quantity: number): Promise<CartItem | null> {
    if (quantity <= 0) {
      await this.removeItem(itemId);
      return null;
    }
    const lineId = await this.resolveLineId(itemId);
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
    const snap = this.ingest(cart);
    return snap.items.find((i) => i.id === itemId) ?? null;
  }

  async removeItem(itemId: string): Promise<void> {
    const lineId = await this.resolveLineId(itemId);
    // No line for this part even after a refresh → already absent server-side,
    // so the desired end state (gone) is already met; nothing to delete.
    if (!lineId) return;
    const cart = await apiClient.delete<ApiCart>(
      `/v1/cart/items/${encodeURIComponent(lineId)}`,
    );
    // DELETE returns the updated cart; refresh the map from it.
    this.ingest(cart);
  }

  async clear(): Promise<void> {
    this.ingest(await apiClient.post<ApiCart>('/v1/cart/clear'));
  }

  async applyPromo(code: string): Promise<PromoResult> {
    const cart = await apiClient.post<ApiCart>('/v1/cart/promo', { code });
    this.ingest(cart);
    // The provider applies promos optimistically from its own PROMO_CODES
    // table and discards this return; we still echo an honest result.
    const applied = cart?.promo?.code ? PROMO_CODES[cart.promo.code] : undefined;
    return applied ? { ok: true, promo: applied } : { ok: false, reason: 'invalid' };
  }

  async removePromo(): Promise<void> {
    this.ingest(await apiClient.delete<ApiCart>('/v1/cart/promo'));
  }
}

// ── Singleton ────────────────────────────────────────────────────────

/** Flips automatically based on `EXPO_PUBLIC_API_BASE_URL`. */
export const cartTransport: CartTransport = shouldUseHttpTransport('cart')
  ? new HttpCartTransport()
  : new MockCartTransport();
