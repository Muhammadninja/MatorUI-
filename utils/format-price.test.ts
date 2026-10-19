import { describe, expect, it } from 'vitest';

import { noBreakDigits } from './format-price';

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
