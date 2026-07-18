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
