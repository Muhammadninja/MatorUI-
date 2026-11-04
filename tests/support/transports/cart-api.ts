/** Test double for the cart transport. Tests only: never import this from app code. */
import type { CartItem, PromoResult } from '@/services/cart-math';
import type { AddItemInput, CartSnapshot, CartTransport } from '@/services/cart-api';

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
    const { evaluatePromoCode } = await import('@/services/cart-math');
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

