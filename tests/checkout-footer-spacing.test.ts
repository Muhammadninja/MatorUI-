/**
 * The sticky "place order" button clears the Android navigation bar (physical
 * Android report: it sat flush against the gesture pill / three buttons).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { checkoutFooterBottom } from '@/utils/sticky-footer';

describe('checkout footer bottom spacing', () => {
  test.each([
    ['gesture navigation', 24],
    ['three-button navigation', 48],
    ['an opaque bar reporting no inset', 0],
  ])('Android, %s: a real gap above the system bar', (_label, inset) => {
    expect(checkoutFooterBottom(inset, 'android') - inset).toBeGreaterThanOrEqual(16);
  });

  test('iOS keeps the home-indicator inset, as before', () => {
    expect(checkoutFooterBottom(34, 'ios')).toBe(34);
    expect(checkoutFooterBottom(0, 'ios')).toBe(20);
  });

  test('the checkout footer uses it', () => {
    const source = readFileSync(join(__dirname, '../components/screens/checkout-screen.tsx'), 'utf8');
    expect(source).toMatch(/paddingBottom: checkoutFooterBottom\(insets\.bottom, Platform\.OS\)/);
  });
});
