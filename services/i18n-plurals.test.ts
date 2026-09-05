import { describe, expect, it } from 'vitest';

import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';

/**
 * Guards the two ways a translated screen can silently leak English counts:
 *
 *  1. A locale is missing a CLDR plural form, so i18next falls through to the
 *     English fallback for that count ("3 parts" under a Russian UI).
 *  2. The runtime has no `Intl.PluralRules` — Hermes ships Intl WITHOUT it —
 *     so i18next degrades to a dummy one/other rule and Russian `_few`/`_many`
 *     become unreachable. `services/i18n.ts` imports the `intl-pluralrules`
 *     polyfill to prevent this; the second block simulates the bare engine to
 *     prove the polyfill (not Node's own full-ICU build) is doing the work.
 */

type Json = { [k: string]: string | Json };

const PLURAL_SUFFIXES = ['zero', 'one', 'two', 'few', 'many', 'other'] as const;

/** Every `<key>_<form>` base found in a bundle, with the forms it defines. */
function pluralKeys(bundle: Json, prefix = '', acc = new Map<string, Set<string>>()) {
  for (const [k, v] of Object.entries(bundle)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') {
      const m = /^(.*)_(zero|one|two|few|many|other)$/.exec(path);
      if (m) {
        const forms = acc.get(m[1]) ?? new Set<string>();
        forms.add(m[2]);
        acc.set(m[1], forms);
      }
    } else {
      pluralKeys(v, path, acc);
    }
  }
  return acc;
}

/** The forms CLDR can actually select for a language's cardinal plurals. */
function requiredForms(lang: string): string[] {
  return new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
}

describe('locale plural coverage', () => {
  it.each([
    ['en', en as unknown as Json],
    ['ru', ru as unknown as Json],
    ['uz', uz as unknown as Json],
  ])('%s defines every CLDR plural form it can select', (lang, bundle) => {
    const required = requiredForms(lang);
    const missing: string[] = [];
    for (const [key, forms] of pluralKeys(bundle)) {
      for (const form of required) {
        if (!forms.has(form)) missing.push(`${key}_${form}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('only uses suffixes i18next recognises', () => {
    for (const bundle of [en, ru, uz] as unknown as Json[]) {
      for (const forms of pluralKeys(bundle).values()) {
        for (const form of forms) {
          expect(PLURAL_SUFFIXES).toContain(form);
        }
      }
    }
  });
});

describe('Russian counts on an engine without Intl.PluralRules (Hermes)', () => {
  it('still selects few / many instead of falling back to English', async () => {
    const intl = Intl as unknown as { PluralRules?: typeof Intl.PluralRules };
    const nativePluralRules = intl.PluralRules;
    delete intl.PluralRules; // emulate Hermes, which ships Intl without it
    try {
      await import('intl-pluralrules');
      const { default: i18next } = await import('i18next');
      const instance = i18next.createInstance();
      await instance.init({
        resources: { en: { translation: en }, ru: { translation: ru } },
        lng: 'ru',
        fallbackLng: 'en',
        compatibilityJSON: 'v4',
        interpolation: { escapeValue: false },
      });

      expect(instance.t('category.partsCount', { count: 1 })).toBe('1 запчасть');
      expect(instance.t('category.partsCount', { count: 3 })).toBe('3 запчасти');
      expect(instance.t('category.partsCount', { count: 8 })).toBe('8 запчастей');
      expect(instance.t('category.partsCount', { count: 0 })).toBe('0 запчастей');
    } finally {
      intl.PluralRules = nativePluralRules;
    }
  });
});
