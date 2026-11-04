import { describe, expect, it } from 'vitest';

import { formatSomAmount, noBreakDigits } from './format-price';

describe('noBreakDigits', () => {
  it('joins digit groups with a non-breaking space', () => {
    // The backend ships "UZS 38 661" with ORDINARY spaces, which Android wraps
    // mid-number in a narrow column.
    expect(noBreakDigits('38 661')).toBe('38\u00A0661');
    expect(noBreakDigits('1 234 567')).toBe('1\u00A0234\u00A0567');
  });

  it('leaves the gap before a currency word breakable', () => {
    expect(noBreakDigits('38 661 сум')).toBe('38\u00A0661 сум');
    expect(noBreakDigits('UZS 38 661')).toBe('UZS 38\u00A0661');
  });

  it('normalizes the narrow/thin separators some locales emit', () => {
    expect(noBreakDigits('38\u202F661')).toBe('38\u00A0661');
    expect(noBreakDigits('38\u2009661')).toBe('38\u00A0661');
  });
});

describe('formatSomAmount', () => {
  it('keeps real hundredths and drops an empty fraction', () => {
    expect(formatSomAmount(95730.24)).toBe('95\u00A0730.24');
    expect(formatSomAmount(12345.6)).toBe('12\u00A0345.60');
    expect(formatSomAmount(280000)).toBe('280\u00A0000');
    expect(formatSomAmount(0)).toBe('0');
  });

  it('removes float noise without moving the amount', () => {
    expect(formatSomAmount(0.1 + 0.2)).toBe('0.30');
    expect(formatSomAmount(65730.24 + 30000)).toBe('95\u00A0730.24');
  });

  it('stays readable by every price parser in the app', () => {
    const parsed = Number(`UZS ${formatSomAmount(65730.24)}`.replace(/[^0-9.]/g, ''));
    expect(parsed).toBe(65730.24);
  });
});
