import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import en from '@/locales/en.json';
import ru from '@/locales/ru.json';
import uz from '@/locales/uz.json';

/**
 * Guards the failure that has now shipped twice: a screen renders `t()` for a
 * key that no locale defines, so the UI shows the raw id ("garage.emptyPickLead")
 * instead of a sentence.
 *
 * It bites because the two halves live apart — a component gains a `t('…')`
 * call in one commit and the locale files are updated in another, and nothing
 * between them fails. Static-analysing the call sites closes that gap: every
 * literal key a component asks for must exist in EVERY bundle, not just English
 * (a key present only in `en` silently serves English inside a Russian UI via
 * `fallbackLng`, which is the same bug wearing a better disguise).
 *
 * Only literal keys are checked. `t(dynamicVar)` and template strings are
 * skipped: they cannot be resolved without running the app, and a false
 * failure here would train people to ignore this test.
 *
 * A counted key is stored under its CLDR forms, never bare -- code calls
 * `t('cart.titleWithCount', { count })` while the bundle holds
 * `titleWithCount_one` / `_other`. Resolving a plural base therefore means
 * "at least one plural form exists", which is also why this file does not
 * re-check WHICH forms are present: `i18n-plurals.test.ts` already owns that.
 */

const ROOTS = ['app', 'components', 'hooks', 'services', 'utils'];
const BUNDLES = { en, ru, uz } as Record<string, unknown>;

/** `t('a.b.c')` / `t("a.b.c", { … })`, literal single-argument keys only. */
const T_CALL = /\bt\(\s*['"]([A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+)['"]/g;

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) acc.push(full);
  }
  return acc;
}

const PLURAL_FORMS = ['one', 'other', 'zero', 'two', 'few', 'many'] as const;

function lookup(bundle: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>(
    (node, part) =>
      node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
    bundle,
  );
}

/** Whether the bundle can answer this key: a plain string, or any plural form. */
function resolves(bundle: unknown, key: string): boolean {
  if (typeof lookup(bundle, key) === 'string') return true;
  return PLURAL_FORMS.some((form) => typeof lookup(bundle, `${key}_${form}`) === 'string');
}

describe('i18n key coverage', () => {
  const used = new Map<string, string>(); // key → first file that asks for it

  for (const root of ROOTS) {
    for (const file of sourceFiles(root)) {
      const src = readFileSync(file, 'utf8');
      for (const [, key] of src.matchAll(T_CALL)) {
        if (!used.has(key)) used.set(key, file);
      }
    }
  }

  it('finds t() call sites to check', () => {
    // A regex that silently stops matching would make every assertion below
    // vacuously pass, so pin that the scan actually found work to do.
    expect(used.size).toBeGreaterThan(100);
  });

  for (const lang of Object.keys(BUNDLES)) {
    it(`every key used in code exists in ${lang}.json`, () => {
      const missing = [...used.entries()]
        .filter(([key]) => !resolves(BUNDLES[lang], key))
        .map(([key, file]) => `${key}  (${file})`);
      expect(missing).toEqual([]);
    });
  }
});
