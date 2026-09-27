/**
 * The home grid's category labels must follow the interface language, not the
 * language whichever fetch happened to win.
 *
 * The bug this pins: switching to English left "Тормоза" on the tiles. The
 * grid rendered the server-resolved `label`, which is resolved for the
 * request's `Accept-Language` — and on a switch that header could still be the
 * old language, because the query refetches from a child effect while the
 * header is set from a provider effect (child effects run first). The
 * wrong-language rows then sat in the cache under the NEW language's key, so
 * nothing ever corrected them. Resolving the label from the per-language names
 * the row already carries makes the display independent of that ordering.
 */

import { describe, expect, test } from 'vitest';

import { localizedCategoryLabel } from '@/utils/category-label';

const BRAKES = {
  name: 'Brakes',
  // What a fetch under Accept-Language: ru returns.
  label: 'Тормоза',
  nameRu: 'Тормоза',
  nameUz: 'Tormozlar',
  nameEn: 'Brakes',
};

describe('localizedCategoryLabel', () => {
  test('follows the interface language even when `label` came back in another one', () => {
    expect(localizedCategoryLabel(BRAKES, 'en')).toBe('Brakes');
    expect(localizedCategoryLabel(BRAKES, 'uz')).toBe('Tormozlar');
    expect(localizedCategoryLabel(BRAKES, 'ru')).toBe('Тормоза');
  });

  test('accepts a region-tagged tag (en-US) and is case-insensitive', () => {
    expect(localizedCategoryLabel(BRAKES, 'en-US')).toBe('Brakes');
    expect(localizedCategoryLabel(BRAKES, 'UZ-Latn')).toBe('Tormozlar');
  });

  test('an unknown or missing language falls back to Russian, the fullest catalogue', () => {
    expect(localizedCategoryLabel(BRAKES, 'de')).toBe('Тормоза');
    expect(localizedCategoryLabel(BRAKES, undefined)).toBe('Тормоза');
  });

  test('missing translation for the asked language degrades, it does not blank', () => {
    const noEn = { name: 'Brakes', nameRu: 'Тормоза', nameUz: 'Tormozlar' };
    expect(localizedCategoryLabel(noEn, 'en')).toBe('Тормоза');

    const onlyUz = { name: 'Brakes', nameUz: 'Tormozlar' };
    expect(localizedCategoryLabel(onlyUz, 'en')).toBe('Tormozlar');
  });

  test('a pre-i18n row (no name_* columns) keeps the server label, then the name', () => {
    expect(localizedCategoryLabel({ name: 'Brakes', label: 'Тормоза' }, 'ru')).toBe('Тормоза');
    expect(localizedCategoryLabel({ name: 'Brakes' }, 'en')).toBe('Brakes');
  });

  test('blank strings are skipped rather than rendered as an empty tile', () => {
    const blankEn = { name: 'Brakes', label: '  ', nameEn: '   ', nameRu: 'Тормоза' };
    expect(localizedCategoryLabel(blankEn, 'en')).toBe('Тормоза');
    expect(localizedCategoryLabel({ name: 'Brakes', label: '   ' }, 'en')).toBe('Brakes');
  });
});
