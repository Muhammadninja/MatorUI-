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

// ── HTTP transport (stub) ────────────────────────────────────────────

/**
 * Drop-in HTTP transport. Wire the auth header strategy
 * (`Authorization: Bearer <token>` from the user context) and set
 * the base URL via env (`EXPO_PUBLIC_API_BASE_URL`). Then swap
 * `cartTransport` below for an instance of this.
 *
 * Suggested REST surface (mirrors the interface 1:1):
 *   GET    /v1/cart                        → CartSnapshot
 *   POST   /v1/cart/items                  → CartItem        (body: AddItemInput)
 *   PATCH  /v1/cart/items/:itemId          → CartItem        (body: { quantity })
 *   DELETE /v1/cart/items/:itemId          → 204
 *   POST   /v1/cart/clear                  → 204
 *   POST   /v1/cart/promo                  → PromoResult     (body: { code })
 *   DELETE /v1/cart/promo                  → 204
 */
import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';

export class HttpCartTransport implements CartTransport {
  fetch(): Promise<CartSnapshot> {
    return apiClient.get<CartSnapshot>('/v1/cart');
  }

  async addItem(input: AddItemInput): Promise<CartItem> {
    const { item } = await apiClient.post<{ item: CartItem }>('/v1/cart/items', input);
    return item;
  }

  async updateQuantity(itemId: string, quantity: number): Promise<CartItem | null> {
    if (quantity <= 0) {
      await this.removeItem(itemId);
      return null;
    }
    const { item } = await apiClient.patch<{ item: CartItem }>(
      `/v1/cart/items/${encodeURIComponent(itemId)}`,
      { quantity },
    );
    return item;
  }

  async removeItem(itemId: string): Promise<void> {
    await apiClient.delete(`/v1/cart/items/${encodeURIComponent(itemId)}`);
  }

  async clear(): Promise<void> {
    await apiClient.post('/v1/cart/clear');
  }

  applyPromo(code: string): Promise<PromoResult> {
    return apiClient.post<PromoResult>('/v1/cart/promo', { code });
  }

  async removePromo(): Promise<void> {
    await apiClient.delete('/v1/cart/promo');
  }
}

// ── Singleton ────────────────────────────────────────────────────────

/** Flips automatically based on `EXPO_PUBLIC_API_BASE_URL`. */
export const cartTransport: CartTransport = shouldUseHttpTransport()
  ? new HttpCartTransport()
  : new MockCartTransport();
