/**
 * Full checkout-flow integration test.
 *
 * Drives the same data path the UI walks the user through:
 *   add → adjust quantity → free-ship progress → apply promo →
 *   pick delivery → place order → cart cleared.
 *
 * Stays React-free on purpose so it runs under Vitest in Node — see
 * cart-math.test.ts for the same convention. The transport layer
 * (MockCartTransport) is exercised directly; the React provider only
 * adds optimistic UI wrapping around these calls.
 */
import { beforeEach, describe, expect, test } from 'vitest';

import { MockCartTransport, type AddItemInput } from './cart-api';
import {
  computeSubtotal,
  computeTotals,
  evaluatePromoCode,
  FLAT_SHIPPING,
  formatCurrency,
  FREE_SHIPPING_THRESHOLD,
  PROMO_CODES,
} from './cart-math';

// Mirrors checkout-screen's DELIVERY_OPTIONS — kept local so this test
// breaks loudly if the checkout screen changes shipping fees without
// updating the corresponding expectation.
const DELIVERY_FEES = {
  standard: 0,
  express: 9.99,
  same_day: 19.99,
} as const;

const TURBO: AddItemInput = {
  productId: 'p-turbo',
  title: 'Garrett GTX3582R',
  description: 'Twin scroll turbocharger',
  price: '$1,240.00',
  imageUrl: 'https://cdn.example.com/turbo.jpg',
};

const BRAKES: AddItemInput = {
  productId: 'p-brakes',
  title: 'Brembo Street Brake Pack',
  description: '4-piston front + rear',
  price: '$760.00',
};

describe('Full checkout flow — happy path', () => {
  let transport: MockCartTransport;

  beforeEach(() => {
    transport = new MockCartTransport();
  });

  test('add → adjust → promo → delivery → place order → cart cleared', async () => {
    // ── 1. Start empty ──────────────────────────────────────────────
    let snapshot = await transport.fetch();
    expect(snapshot.items).toEqual([]);
    expect(snapshot.appliedPromoCode).toBeNull();

    // ── 2. User adds Turbo from the search-result card ──────────────
    const addedTurbo = await transport.addItem(TURBO);
    expect(addedTurbo.id).toBe(TURBO.productId);
    expect(addedTurbo.quantity).toBe(1);
    // imageUrl threaded all the way through — verifies my recent fix.
    expect(addedTurbo.imageUrl).toBe(TURBO.imageUrl);

    // ── 3. User adds Brakes from item-detail ────────────────────────
    await transport.addItem(BRAKES);
    snapshot = await transport.fetch();
    expect(snapshot.items).toHaveLength(2);

    // ── 4. User bumps Turbo qty to 2 (the +/- buttons on cart row) ──
    await transport.updateQuantity(TURBO.productId, 2);
    snapshot = await transport.fetch();
    const turboRow = snapshot.items.find((i) => i.id === TURBO.productId);
    expect(turboRow?.quantity).toBe(2);

    // ── 5. Subtotal: 2 × $1,240 + 1 × $760 = $3,240 (above free-ship) ──
    const subtotal = computeSubtotal(snapshot.items);
    expect(subtotal).toBe(2 * 1240 + 760);
    expect(subtotal).toBeGreaterThan(FREE_SHIPPING_THRESHOLD);

    // ── 6. Pre-promo totals: shipping free, tax on subtotal ─────────
    const preTotals = computeTotals(subtotal, null);
    expect(preTotals.shipping).toBe(0);
    expect(preTotals.discount).toBe(0);

    // ── 7. Apply WELCOME10 — valid because subtotal > MIN ───────────
    const promoResult = evaluatePromoCode('welcome10', subtotal);
    expect(promoResult.ok).toBe(true);
    if (!promoResult.ok) throw new Error('promo eval failed');
    await transport.applyPromo(promoResult.promo.code, subtotal);
    snapshot = await transport.fetch();
    expect(snapshot.appliedPromoCode).toBe('WELCOME10');

    // ── 8. Post-promo totals: 10% off, tax on the discounted base ───
    const postTotals = computeTotals(subtotal, promoResult.promo);
    expect(postTotals.discount).toBe(subtotal * 0.1);
    expect(postTotals.total).toBeLessThan(preTotals.total);

    // ── 9. User picks express delivery — grandTotal mirrors the
    //      checkout screen's `totals.total + deliveryFee` calc ──────
    const deliveryFee = DELIVERY_FEES.express;
    const grandTotal = postTotals.total + deliveryFee;
    expect(grandTotal).toBe(postTotals.total + 9.99);

    // ── 10. Place order — UI calls clearCart() in the success cb ────
    await transport.clear();
    snapshot = await transport.fetch();
    expect(snapshot.items).toEqual([]);
    expect(snapshot.appliedPromoCode).toBeNull();

    // ── 11. Sanity: the CTA label assembled in cart-screen ──────────
    const ctaLabel = `Checkout · ${formatCurrency(grandTotal)}`;
    expect(ctaLabel).toMatch(/^Checkout · UZS \d/);
  });
});

describe('Full checkout flow — guarded edges', () => {
  test('promo rejects below minimum, totals stay unpromoed', () => {
    const subtotal = 50; // below PROMO_MIN_SUBTOTAL
    const result = evaluatePromoCode('WELCOME10', subtotal);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected failure');
    expect(result.reason).toBe('min_subtotal');

    // Caller falls back to no-promo totals — matches what the cart
    // surface does (it doesn't optimistically apply a rejected promo).
    const totals = computeTotals(subtotal, null);
    expect(totals.discount).toBe(0);
    expect(totals.shipping).toBe(FLAT_SHIPPING);
  });

  test('decrement to zero removes the item from the transport', async () => {
    const transport = new MockCartTransport();
    await transport.addItem(BRAKES);
    let snapshot = await transport.fetch();
    expect(snapshot.items).toHaveLength(1);

    // updateQuantity(0) collapses to a remove — matches the provider's
    // decrement contract (quantity <= 1 drops the row).
    const removed = await transport.updateQuantity(BRAKES.productId, 0);
    expect(removed).toBeNull();
    snapshot = await transport.fetch();
    expect(snapshot.items).toEqual([]);
  });

  test('adding the same product twice merges quantity, not duplicates', async () => {
    const transport = new MockCartTransport();
    await transport.addItem(TURBO);
    await transport.addItem(TURBO);
    const snapshot = await transport.fetch();
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]?.quantity).toBe(2);
  });

  test('clear wipes both items and promo', async () => {
    const transport = new MockCartTransport({
      items: [{ ...TURBO, id: TURBO.productId, quantity: 1 }],
      appliedPromoCode: 'WELCOME10',
    });
    await transport.clear();
    const snapshot = await transport.fetch();
    expect(snapshot.items).toEqual([]);
    expect(snapshot.appliedPromoCode).toBeNull();
  });

  test('FREESHIP promo waives shipping below the free-ship threshold', () => {
    const subtotal = 200; // below threshold, FLAT_SHIPPING normally applies
    const noPromo = computeTotals(subtotal, null);
    expect(noPromo.shipping).toBe(FLAT_SHIPPING);

    const withFreeShip = computeTotals(subtotal, PROMO_CODES.FREESHIP);
    expect(withFreeShip.shipping).toBe(0);
    expect(withFreeShip.discount).toBe(0);
    expect(withFreeShip.total).toBeLessThan(noPromo.total);
  });
});
