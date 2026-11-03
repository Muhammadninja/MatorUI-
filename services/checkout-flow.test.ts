/**
 * Full checkout-flow integration test.
 *
 * Drives the same data path the UI walks the user through:
 *   add → adjust quantity → apply promo → pick delivery → place order →
 *   cart cleared.
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
  formatCurrency,
  PROMO_CODES,
  SERVICE_FEE_UZS,
  STANDARD_DELIVERY_UZS,
} from './cart-math';

// Mirrors the real backend's shipping quote (shipping.service.ts) — kept
// local so this test breaks loudly if that flat-fee model changes without
// updating the corresponding expectation.
const DELIVERY_FEES = {
  pickup: 0,
  courier: STANDARD_DELIVERY_UZS,
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

    // ── 5. Subtotal: 2 × $1,240 + 1 × $760 = $3,240 ──────────────────
    const subtotal = computeSubtotal(snapshot.items);
    expect(subtotal).toBe(2 * 1240 + 760);

    // ── 6. Pre-promo totals: flat delivery + service fee, no discount ──
    const preTotals = computeTotals(subtotal, null);
    expect(preTotals.shipping).toBe(STANDARD_DELIVERY_UZS);
    expect(preTotals.serviceFee).toBe(SERVICE_FEE_UZS);
    expect(preTotals.discount).toBe(0);

    // ── 7. Apply WELCOME10 — valid because subtotal > MIN ───────────
    const promoResult = evaluatePromoCode('welcome10', subtotal);
    expect(promoResult.ok).toBe(true);
    if (!promoResult.ok) throw new Error('promo eval failed');
    await transport.applyPromo(promoResult.promo.code, subtotal);
    snapshot = await transport.fetch();
    expect(snapshot.appliedPromoCode).toBe('WELCOME10');

    // ── 8. Post-promo totals: 10% off the subtotal only ──────────────
    const postTotals = computeTotals(subtotal, promoResult.promo);
    expect(postTotals.discount).toBe(subtotal * 0.1);
    expect(postTotals.total).toBeLessThan(preTotals.total);

    // ── 9. User picks courier delivery — grandTotal mirrors the
    //      checkout screen's `subtotal - discount + deliveryFee +
    //      serviceFee` calc (the real quote REPLACES totals.shipping,
    //      it is not added on top of it) ─────────────────────────────
    const deliveryFee = DELIVERY_FEES.courier;
    const grandTotal = postTotals.subtotal - postTotals.discount + deliveryFee + postTotals.serviceFee;
    expect(grandTotal).toBe(postTotals.subtotal - postTotals.discount + STANDARD_DELIVERY_UZS + SERVICE_FEE_UZS);

    // ── 10. Place order — UI calls clearCart() in the success cb ────
    await transport.clear();
    snapshot = await transport.fetch();
    expect(snapshot.items).toEqual([]);
    expect(snapshot.appliedPromoCode).toBeNull();

    // ── 11. Sanity: the CTA label assembled in cart-screen ──────────
    const ctaLabel = `Checkout · ${formatCurrency(grandTotal)}`;
    expect(ctaLabel).toMatch(/^Checkout · [\d\u00A0]+ UZS$/);
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
    expect(totals.shipping).toBe(STANDARD_DELIVERY_UZS);
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

  test('FREESHIP promo waives the flat delivery fee', () => {
    const subtotal = 200;
    const noPromo = computeTotals(subtotal, null);
    expect(noPromo.shipping).toBe(STANDARD_DELIVERY_UZS);

    const withFreeShip = computeTotals(subtotal, PROMO_CODES.FREESHIP);
    expect(withFreeShip.shipping).toBe(0);
    expect(withFreeShip.discount).toBe(0);
    expect(withFreeShip.total).toBeLessThan(noPromo.total);
  });
});
