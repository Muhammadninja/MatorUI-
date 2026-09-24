import { describe, expect, it } from 'vitest';

import { formatMileage } from './mileage';

describe('formatMileage', () => {
  it('groups with a comma in English', () => {
    expect(formatMileage(67420, 'km', 'en')).toBe('67,420 km');
  });

  it('groups with a plain space in Russian and Uzbek', () => {
    // The regression: both used to print the en-US comma. Also pins that the
    // non-breaking space ru-RU emits is normalised away.
    expect(formatMileage(67420, 'km', 'ru')).toBe('67 420 km');
    expect(formatMileage(67420, 'km', 'uz')).toBe('67 420 km');
    expect(formatMileage(67420, 'km', 'ru')).not.toContain(' ');
  });

  it('returns empty string for a vehicle with no reading', () => {
    // Callers join this into a `·`-separated sub-line, so a placeholder here
    // would leave a dangling separator.
    for (const v of [undefined, null, Number.NaN]) {
      expect(formatMileage(v, 'km', 'en')).toBe('');
    }
  });

  it('keeps zero, which is a real reading', () => {
    expect(formatMileage(0, 'km', 'en')).toBe('0 km');
  });
});
