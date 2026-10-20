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

/** Zero-width space: a break OPPORTUNITY for the text engine, invisible when
 *  the line has room and never copied as a visible character. A soft hyphen
 *  (U+00AD) would read better typographically but Android does not render it
 *  reliably, so the break is hyphen-less. */
const ZWSP = '​';

/** Word parts the catalogue's long names are built from. Breaking right after
 *  one reads as a seam in a compound word ("Электро‑оборудование"); breaking
 *  anywhere else orphans a syllable, which is what a narrow grid cell did on
 *  its own ("Электрооборудован / ие"). */
const COMPOUND_HEADS = [
  'электро',
  'стекло',
  'тепло',
  'гидро',
  'термо',
  'турбо',
  'авто',
  'мото',
  'радио',
  'масло',
  'топливо',
  'водо',
  'бензо',
  'свето',
  'шумо',
  'газо',
  'микро',
];

/** Vowels (Cyrillic + Latin). A break that lands just after one falls between
 *  syllables rather than inside a consonant cluster. */
const VOWEL = /[аеёиоуыэюяaeiouáàâäéèêëíïîóôöúùûü]/i;

/**
 * Add break opportunities to any word longer than `maxWordLength`, so a narrow
 * column can wrap it between word parts at the FULL type size instead of
 * shrinking the label or snapping it mid-syllable.
 *
 * `maxWordLength` is how many characters the column fits on one line — the
 * caller owns that number because it owns the column. Words that already fit
 * are returned untouched, so the string a user sees is character-for-character
 * the server's label; only the invisible break hints are added.
 */
export function softWrapLabel(label: string, maxWordLength: number): string {
  // The separators are captured so the original spacing is rebuilt exactly.
  return label
    .split(/(\s+)/)
    .map((part) => (part.length > maxWordLength ? breakLongWord(part, maxWordLength) : part))
    .join('');
}

function breakLongWord(word: string, maxWordLength: number): string {
  const lower = word.toLowerCase();
  // A compound head only counts when what follows is a word rather than a
  // two-letter remainder ("Автомат" must not become "Авто / мат").
  const head = COMPOUND_HEADS.find(
    (h) => lower.startsWith(h) && word.length - h.length >= MIN_SEGMENT,
  );
  const at = head ? head.length : midSyllableBreak(word);
  if (at <= 0) return word;
  const tail = word.slice(at);
  // A three-part compound still leaves a long tail — keep breaking until every
  // segment fits the column.
  return `${word.slice(0, at)}${ZWSP}${
    tail.length > maxWordLength ? breakLongWord(tail, maxWordLength) : tail
  }`;
}

/** Shortest piece a break may leave on a line. Below this the second line is
 *  an orphan syllable — the very thing the break is there to prevent — so a
 *  word that can only be split closer to its edge is left whole. */
const MIN_SEGMENT = 4;

/** The break nearest the word's middle that follows a vowel and precedes a
 *  consonant. Returns 0 when the word has no such seam (an acronym, a part
 *  number), which leaves it unbroken — the caller's column may overflow, but
 *  an invented break would be worse. */
function midSyllableBreak(word: string): number {
  const middle = Math.ceil(word.length / 2);
  for (let offset = 0; offset < word.length; offset += 1) {
    for (const i of [middle - offset, middle + offset]) {
      if (i < MIN_SEGMENT || i > word.length - MIN_SEGMENT) continue;
      if (VOWEL.test(word[i - 1]) && !VOWEL.test(word[i])) return i;
    }
  }
  return 0;
}
