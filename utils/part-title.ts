/**
 * Part-title hygiene.
 *
 * Seller-entered titles reach us in whatever shape they were typed: SHOUTED
 * ("ОПОРА, ПЕРЕДНИЙ АМОРТИЗАТОР"), trailing junk ("Фильтр масляный Lada-",
 * "Трупка гидравлики."), the car model glued on the end ("Брызговики комплект
 * Onix B"), spec codes run together with the product name ("Видеорегистратор
 * UNISTAR GL 005 2KA 1080P WI-FI"), the brand repeated when the brand field
 * already carries it, side markers in brackets ("Фара перед (лев)"), and
 * volumes or viscosities tacked on ("Стеклоомывающая жидкость 3L").
 *
 * `normalizePartTitle` turns each of those into a predictable pair:
 *
 *   title  — one line, sentence-cased, the noun phrase a shopper scans
 *   detail — the qualifiers that were buried in it (model, side, spec, volume)
 *
 * It is deliberately conservative: it never invents words, never fixes
 * spelling, and when a rule would leave a title too short to mean anything it
 * declines to apply. React-free and dependency-free so it can be unit-tested
 * under plain Node, like `services/cart-math.ts`.
 *
 * Applied once at the API boundary (`mapPartToCatalogItem`), so every surface
 * — grid, row, detail, cart, order — shows the same cleaned text.
 */

/** Cyrillic / Latin abbreviations that are correctly upper-case. Never
 *  de-shouted, so "Трос переключения АКПП" keeps its АКПП. */
const ACRONYMS = new Set([
  'АКПП',
  'МКПП',
  'КПП',
  'ДВС',
  'ГБЦ',
  'ГРМ',
  'ШРУС',
  'АБС',
  'ЭБУ',
  'ТНВД',
  'ГУР',
  'ЭУР',
  'ДМРВ',
  'ДПКВ',
  'ДПРВ',
  'РХХ',
  'ПТФ',
  'СТО',
  'ЕГР',
  'ТО',
  'ОЖ',
  'УАЗ',
  'ВАЗ',
  'ГАЗ',
  'ABS',
  'EGR',
  'ESP',
  'LED',
  'USB',
  'AUX',
  'GPS',
  'OEM',
  'VIN',
  'DVD',
  'TPMS',
  'DPF',
]);

/** Vehicle model words we recognise at the end of a title. Kept here rather
 *  than imported from `uz-vehicle-catalog` so this module stays dependency-free
 *  (and so a model being dropped from the picker can't change stored titles).
 *  Longest-first on purpose — "Song Plus" must beat "Song". */
const MODEL_WORDS = [
  'Song Plus',
  'Tiggo 7 Pro',
  'Tiggo 8 Pro',
  'Grand Vitara',
  'Cobalt',
  'Malibu',
  'Nexia',
  'Lacetti',
  'Gentra',
  'Spark',
  'Tracker',
  'Captiva',
  'Onix',
  'Damas',
  'Labo',
  'Matiz',
  'Tico',
  'Orlando',
  'Epica',
  'Aveo',
  'Equinox',
  'Trailblazer',
  'Chazor',
  'Han',
  'Seal',
  'Sonata',
  'Tucson',
  'Creta',
  'Sportage',
  'Rio',
  'K5',
  'Niva',
  'Granta',
  'Vesta',
  'Priora',
  'Kalina',
];

/** Car makes. A make at the END of a title is a qualifier (or a duplicate of
 *  the brand field) — never part of the product name. */
const MAKE_WORDS = [
  'Chevrolet',
  'Daewoo',
  'Ravon',
  'Lada',
  'BYD',
  'Kia',
  'Hyundai',
  'Chery',
  'Haval',
  'Geely',
  'Changan',
  'Toyota',
  'Nissan',
  'Volkswagen',
  'Skoda',
  'Opel',
  'Leapmotor',
];

const EDGE_JUNK = /^[\s\-.,;:/\\|•*·]+|[\s\-.,;:/\\|•*·]+$/g;
const VISCOSITY = /\b\d{1,2}W-?\d{2}\b/i;
// No `\b` after the unit: JS word boundaries are ASCII-only, so "4Л" (Cyrillic
// Л at end of string) never matches one. The `$` anchor does that job anyway.
const VOLUME_TAIL = /\s(\d+(?:[.,]\d+)?)\s?(л|l|мл|ml|кг|kg)\.?$/i;

/** A token that reads as a spec code, not a word: anything with a digit, or a
 *  short all-caps Latin cluster ("GL", "WI-FI", "SL/CF"). */
function isSpecToken(token: string): boolean {
  if (/\d/.test(token)) return true;
  return /^[A-Z][A-Z0-9/\-]{0,4}$/.test(token);
}

/** Collapse exotic whitespace, quotes and dashes; squeeze runs of spaces. */
function baseClean(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[    ]/g, ' ')
    .replace(/[“”«»„]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripEdges(value: string): string {
  let out = value.trim();
  let previous = '';
  while (out !== previous) {
    previous = out;
    out = out.replace(EDGE_JUNK, '').trim();
  }
  return out;
}

/**
 * Lower-case SHOUTED Cyrillic words, leaving acronyms, Latin brand clusters
 * ("AMINOL PREMIUM") and anything with a digit alone.
 *
 * Two modes, because the safe threshold depends on the whole string. When the
 * title has NO lower-case Cyrillic at all it was typed with caps lock on, so
 * every Cyrillic word comes down — including the one- and two-letter ones
 * ("СТЕКЛО В СБОРЕ" → "стекло в сборе"). In a mixed title a short upper-case
 * token is far more likely to be meaningful (a trim letter, an initial), so
 * only words of three letters or more are touched ("БОЛТ поддона" → "Болт
 * поддона", but the "B" in "Onix B" survives).
 */
function deShout(value: string): string {
  const hasCyrillic = /[А-ЯЁа-яё]/u.test(value);
  const shoutingThroughout = hasCyrillic && !/[а-яё]/u.test(value);
  const minLength = shoutingThroughout ? 1 : 3;
  return value
    .split(' ')
    .map((token) => {
      const core = token.replace(/[^\p{L}]/gu, '');
      if (core.length < minLength) return token;
      if (!/^[А-ЯЁ]+$/u.test(core)) return token;
      if (ACRONYMS.has(core)) return token;
      return token.toLowerCase();
    })
    .join(' ');
}

/** Upper-case the first letter, unless it opens with an acronym or a Latin
 *  token that is already cased the way its owner wants it. */
function sentenceCase(value: string): string {
  if (!value) return value;
  const first = value[0];
  if (first !== first.toLowerCase()) return value;
  return first.toLocaleUpperCase('ru-RU') + value.slice(1);
}

/** Index of the last token that starts a known model (or make) phrase, or -1.
 *  Matching runs over the suffix so multi-word models are caught whole. */
function modelPhraseStart(tokens: string[], words: string[]): number {
  for (let i = 0; i < tokens.length; i += 1) {
    const suffix = tokens.slice(i).join(' ').toLowerCase();
    for (const word of words) {
      const w = word.toLowerCase();
      if (suffix === w || suffix.startsWith(`${w} `)) return i;
    }
  }
  return -1;
}

export type NormalizePartTitleOptions = {
  /** The part's brand, when the catalog carries it separately. A brand
   *  repeated at the END of the title is dropped rather than shown twice. */
  brand?: string | null;
};

export type NormalizedPartTitle = {
  /** One-line product name. Never empty when the input had any letters. */
  title: string;
  /** The qualifiers lifted out of the title, joined with " · ". */
  detail?: string;
};

/** Words must survive in the title for a rule to be allowed to fire. */
const MIN_TITLE_WORDS = 2;
const MIN_TITLE_CHARS = 3;

/**
 * Normalize one seller-entered part title into `{ title, detail }`.
 *
 * Order matters: brackets and the brand duplicate go first (they're unambiguous
 * noise), then the tails that belong on the second line (volume, viscosity,
 * spec codes, model), then structural splits (glued hyphen, long comma
 * clause). Each tail rule refuses to run if it would leave fewer than two
 * words in the title.
 */
export function normalizePartTitle(
  raw?: string | null,
  options: NormalizePartTitleOptions = {},
): NormalizedPartTitle {
  const cleaned = sentenceCase(deShout(stripEdges(baseClean(raw ?? ''))));
  if (!cleaned) return { title: '' };

  const details: string[] = [];
  let title = cleaned;

  const wordCount = (v: string) => v.split(' ').filter(Boolean).length;
  /** Apply `next` as the new title only if it still reads as a product name. */
  const accept = (next: string, lifted?: string): boolean => {
    const candidate = stripEdges(next);
    if (candidate.length < MIN_TITLE_CHARS || wordCount(candidate) < MIN_TITLE_WORDS) return false;
    title = candidate;
    const tail = lifted ? stripEdges(lifted) : '';
    if (tail) details.push(tail);
    return true;
  };

  // 1. Bracketed asides — "(лев)", "[в сборе]" — are always qualifiers.
  title = title.replace(/\s*[([]([^)\]]{1,40})[)\]]\s*/g, (_m, inner: string) => {
    const aside = stripEdges(deShout(inner));
    if (aside) details.push(aside);
    return ' ';
  });
  title = stripEdges(title.replace(/\s+/g, ' '));

  // 2. Brand repeated at the end ("Фильтр масляный Lada" + brand Lada) — drop
  //    it outright; the brand already has its own line in every surface.
  const brand = (options.brand ?? '').trim();
  if (brand) {
    const re = new RegExp(`\\s+${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    if (re.test(title)) accept(title.replace(re, ''));
  }

  // 3. Volume tail — "… 3L", "… 4Л" — normalized to "3 л".
  const volume = title.match(VOLUME_TAIL);
  if (volume) {
    const unit = /^(l|л)$/i.test(volume[2]) ? 'л' : volume[2].toLowerCase();
    accept(title.slice(0, volume.index), `${volume[1].replace(',', '.')} ${unit}`);
  }

  // 4. Oil viscosity onward is all specification ("10W40 SL/CF").
  const viscosity = title.match(VISCOSITY);
  if (viscosity?.index != null && viscosity.index > 0) {
    accept(title.slice(0, viscosity.index), title.slice(viscosity.index));
  }

  // 5. Model / make tail ("… Onix B", "… Damas Evakor"). Everything from the
  //    model word on belongs to the fitment note, not the product name. Runs
  //    BEFORE the spec sweep so a trim letter trailing a model ("Onix B") is
  //    lifted with its model instead of being mistaken for a spec code.
  {
    const tokens = title.split(' ');
    const start = modelPhraseStart(tokens, [...MODEL_WORDS, ...MAKE_WORDS]);
    if (start > 0) accept(tokens.slice(0, start).join(' '), tokens.slice(start).join(' '));
  }

  // 6. Trailing run of spec codes ("GL 005 2KA 1080P WI-FI"). Two tokens
  //    minimum: a lone code at the end is usually part of the product name
  //    ("AMINOL PREMIUM PMG3"), not a spec tacked onto it.
  {
    const tokens = title.split(' ');
    let cut = tokens.length;
    while (cut > 0 && isSpecToken(tokens[cut - 1])) cut -= 1;
    if (tokens.length - cut >= 2) {
      accept(tokens.slice(0, cut).join(' '), tokens.slice(cut).join(' '));
    }
  }

  // 7. Two multi-word halves glued by a hyphen ("Стекло в сборе-ветровое
  //    стекло"). Only when a side has a space, so "5W-30" and "WI-FI" are safe.
  {
    const glued = title.match(/^(.*\S\s\S.*?)-(.+)$/);
    if (glued && /[\p{L}]{3}/u.test(glued[2])) accept(glued[1], glued[2]);
  }

  // 8. A long comma clause is a qualifier ("… в комплекте, лв"). Needs three
  //    words ahead of the comma, so "Опора, передний амортизатор" stays whole.
  {
    const comma = title.indexOf(', ');
    if (comma > 0 && wordCount(title.slice(0, comma)) >= 3) {
      accept(title.slice(0, comma), title.slice(comma + 1));
    }
  }

  const detail = Array.from(new Set(details.filter(Boolean))).join(' · ');
  return detail ? { title, detail } : { title };
}

export default normalizePartTitle;
