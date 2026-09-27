/**
 * Category-label hygiene. The backend buckets parts with no real category under
 * a placeholder label ("Uncategorized"). The product surface should show a
 * *real* category or nothing at all — never the placeholder — so every place
 * that renders a category name runs its value through `cleanCategoryName`.
 */

/** Matches the backend's "no category" placeholder in its common spellings
 *  ("Uncategorized" / "Uncategorised", with an optional space or hyphen). */
const PLACEHOLDER_CATEGORY = /^un[\s-]?categor(?:ized|ised)$/i;

/**
 * Returns the trimmed category name, or `undefined` when it's empty or the
 * "Uncategorized" placeholder — so callers can omit the segment entirely
 * rather than render the placeholder text.
 */
export function cleanCategoryName(name?: string | null): string | undefined {
  const trimmed = (name ?? '').trim();
  if (!trimmed || PLACEHOLDER_CATEGORY.test(trimmed)) return undefined;
  return trimmed;
}

/** The per-language names a category row carries, plus the server's already
 *  resolved `label` and the internal English `name`. Structural on purpose so
 *  both the home-grid tile and any future category row can pass their own
 *  shape without importing each other's types. */
export type LocalizableCategory = {
  name: string;
  label?: string;
  nameRu?: string;
  nameUz?: string;
  nameEn?: string;
};

/**
 * The display string for `lang`, resolved on the CLIENT from the names the row
 * already carries.
 *
 * Why not just trust the server's `label`: it is resolved for the request's
 * `Accept-Language`, so it is only right if that header matched the language
 * the UI is currently showing. On a language switch those can disagree for one
 * fetch (the query refetches from a child effect, the header is set from a
 * provider effect), and the wrong-language rows then sit in the cache under
 * the new language's key. Resolving here makes the switch immediate and
 * independent of that ordering.
 *
 * Fallback order matches `localizedCategoryName` in reference-catalog: the
 * asked-for language, then Russian (the catalogue's most complete language),
 * then whatever else exists, then the server label, then the internal name —
 * so a row from a pre-i18n backend still renders text.
 */
export function localizedCategoryLabel(c: LocalizableCategory, lang?: string): string {
  const l = (lang ?? '').slice(0, 2).toLowerCase();
  const order =
    l === 'uz'
      ? [c.nameUz, c.nameRu, c.nameEn]
      : l === 'en'
        ? [c.nameEn, c.nameRu, c.nameUz]
        : [c.nameRu, c.nameEn, c.nameUz];
  // Each candidate is tested AFTER trimming: a column holding whitespace is
  // an untranslated row, and it must fall through to the next language rather
  // than swallow the fallback chain and land on the internal English name.
  for (const candidate of [...order, c.label]) {
    const text = candidate?.trim();
    if (text) return text;
  }
  return c.name;
}
