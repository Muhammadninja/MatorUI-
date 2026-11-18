/**
 * G-4: guards for the Uzbek garage copy.
 *
 * The wording itself is still waiting on a native read, so exact strings are
 * not pinned here; that would turn every reviewer's edit into a test change.
 * These tests check what a copy edit can silently break:
 *
 *   - interpolation: a string that drops or renames `{{vehicle}}` renders the
 *     raw placeholder or loses the car's name;
 *   - Uzbek Latin apostrophes: oʻ / gʻ take U+02BB and the tutuq belgisi takes
 *     U+02BC. A plain ASCII quote is a different letter to search, sorting and
 *     screen readers.
 */
import { describe, expect, test } from 'vitest';

import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';

type Bundle = Record<string, Record<string, unknown>>;

/** The G-4 review scope: every garage.* key, plus the two VIN errors added in G-5. */
const SCOPE: [namespace: string, key: string][] = [
  ...Object.keys(en.garage).map((k): [string, string] => ['garage', k]),
  ['addVehicle', 'vinUnsupported'],
  ['addVehicle', 'vinNotFound'],
];

const get = (bundle: unknown, ns: string, key: string) =>
  String((bundle as Bundle)[ns]?.[key] ?? '');

const placeholders = (s: string) => [...s.matchAll(/{{\s*(\w+)\s*}}/g)].map((m) => m[1]).sort();

describe('Uzbek garage copy (G-4)', () => {
  test('the scope is the 47 garage keys plus the two G-5 VIN errors', () => {
    expect(Object.keys(en.garage)).toHaveLength(47);
    expect(SCOPE).toHaveLength(49);
  });

  test.each(SCOPE)('%s.%s keeps the same placeholders as English and Russian', (ns, key) => {
    const expected = placeholders(get(en, ns, key));
    expect(placeholders(get(uz, ns, key))).toEqual(expected);
    expect(placeholders(get(ru, ns, key))).toEqual(expected);
  });

  test.each(SCOPE)('%s.%s uses Uzbek apostrophes, not ASCII quotes', (ns, key) => {
    // Between two letters, only ʻ (U+02BB) or ʼ (U+02BC) belongs in Uzbek Latin.
    expect(get(uz, ns, key)).not.toMatch(/\p{L}['`‘’]\p{L}/u);
  });

  /**
   * The same rule, over the WHOLE bundle. The per-key checks above only ever
   * covered `garage.*`, so 64 strings elsewhere kept their typewriter quotes
   * ("Hisobni o'chirish", "ma'lumot") until someone read them on a screen.
   * A straight quote is a different character to search, sorting and screen
   * readers — and it simply looks wrong to a reader of Uzbek.
   */
  test('no string in uz.json uses an ASCII quote as a letter', () => {
    const offenders: string[] = [];
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        if (/\p{L}['`‘’]\p{L}/u.test(node)) offenders.push(`${path}: ${node}`);
        return;
      }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) walk(v, path ? `${path}.${k}` : k);
      }
    };
    walk(uz, '');
    expect(offenders).toEqual([]);
  });
});
