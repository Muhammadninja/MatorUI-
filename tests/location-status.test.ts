/**
 * The address form's location row is derived from what the address really
 * holds, so it can never say "location set" and "couldn't determine the
 * location" at once (physical-device report).
 */
import { describe, expect, test } from 'vitest';

import { deriveLocationStatus } from '@/components/screens-components/account/location-status';

describe('deriveLocationStatus', () => {
  test('a running lookup is the whole story', () => {
    expect(deriveLocationStatus({ locating: true, source: 'saved', failure: 'denied' })).toEqual({
      headline: 'locating',
      note: null,
    });
  });

  test.each([
    ['saved', 'saved'],
    ['location', 'current'],
    ['map', 'pinned'],
    ['suggestion', 'pinned'],
  ] as const)('a %s point reads as %s, with nothing under it', (source, headline) => {
    expect(deriveLocationStatus({ locating: false, source, failure: null })).toEqual({
      headline,
      note: null,
    });
  });

  test('no point: the optional hint, or why the lookup failed', () => {
    expect(deriveLocationStatus({ locating: false, source: null, failure: null }).note).toBe(
      'hint',
    );
    expect(deriveLocationStatus({ locating: false, source: null, failure: 'denied' }).note).toBe(
      'denied',
    );
    expect(
      deriveLocationStatus({ locating: false, source: null, failure: 'unavailable' }).note,
    ).toBe('unavailable');
  });

  test('a failed refresh keeps the point it had and says so', () => {
    for (const source of ['saved', 'location', 'map', 'suggestion'] as const) {
      const denied = deriveLocationStatus({ locating: false, source, failure: 'denied' });
      const unavailable = deriveLocationStatus({ locating: false, source, failure: 'unavailable' });
      expect(denied.headline).not.toBe('none');
      expect(denied.note).toBe('deniedKept');
      expect(unavailable.note).toBe('unavailableKept');
    }
  });
});
