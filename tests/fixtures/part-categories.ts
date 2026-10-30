/**
 * TEST-ONLY: the `part_categories` export (`part_categories.csv`, alongside) as
 * typed rows, and `GET /v1/reference/categories` answered from them the way the
 * backend answers it: active rows only, ordered by sort order then internal
 * name; without `parentId` the level-0 roots ("Другое" included — the
 * level-1 `cat_uncategorized` is not a root), with it that node's children.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type CategoryRow = {
  id: string;
  name: string;
  parentId: string | null;
  slug: string | null;
  sortOrder: number;
  isActive: boolean;
  mainCategory: string | null;
  level: number;
  nameRu: string;
  nameUz: string;
  nameEn: string;
};

/** One CSV record: quoted fields, unquoted NULL / True / False / numbers. */
function parseLine(line: string): (string | null)[] {
  const fields: (string | null)[] = [];
  let cur = '';
  let quoted = false;
  let wasQuoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') {
      quoted = true;
      wasQuoted = true;
    } else if (ch === ',') {
      fields.push(!wasQuoted && cur === 'NULL' ? null : cur);
      cur = '';
      wasQuoted = false;
    } else cur += ch;
  }
  fields.push(!wasQuoted && cur === 'NULL' ? null : cur);
  return fields;
}

const [header, ...records] = readFileSync(join(__dirname, 'part_categories.csv'), 'utf8')
  .split(/\r?\n/)
  .filter(Boolean)
  .map(parseLine);
const col = (name: string) => header.indexOf(name);

export const CATEGORY_ROWS: CategoryRow[] = records.map((f) => ({
  id: f[col('id')]!,
  name: f[col('name')]!,
  parentId: f[col('parent_id')],
  slug: f[col('slug')],
  sortOrder: Number(f[col('sort_order')]),
  isActive: f[col('is_active')] === 'True',
  mainCategory: f[col('main_category')],
  level: Number(f[col('level')]),
  nameRu: f[col('name_ru')]!,
  nameUz: f[col('name_uz')]!,
  nameEn: f[col('name_en')]!,
}));

export const CATEGORY_BY_ID = new Map(CATEGORY_ROWS.map((r) => [r.id, r]));

export const LANGS = ['ru', 'uz', 'en'] as const;

export const csvName = (r: CategoryRow, lang: (typeof LANGS)[number]) =>
  lang === 'ru' ? r.nameRu : lang === 'uz' ? r.nameUz : r.nameEn;

/** A row in the reference endpoint's node shape (PartCategoryService.toNode). */
export function referenceNode(r: CategoryRow) {
  return {
    id: r.id,
    name: r.name,
    nameRu: r.nameRu,
    nameUz: r.nameUz,
    nameEn: r.nameEn,
    slug: r.slug ?? r.id,
    parentId: r.parentId,
    level: r.level,
    sortOrder: r.sortOrder,
  };
}

const bySortOrder = (a: CategoryRow, b: CategoryRow) =>
  a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/**
 * Each root's `productsCount` as the backend serves it. The export holds
 * categories, not parts, so the numbers are made up — picked to land on every
 * Russian plural form (1/21 one, 22/84/1043 few, 0/5/47/125/312 many).
 */
export const ROOT_PRODUCTS_COUNT: Record<string, number> = {
  'brake-system': 125,
  'motor-oil': 84,
  'electrical-and-lighting': 312,
  'tuning-and-accessories': 21,
  transmission: 1,
  'maintenance-and-fluids': 0,
  'suspension-and-steering': 47,
  'engine-system': 1043,
  'heating-and-cooling': 22,
  other: 5,
};

type ReferenceItem = ReturnType<typeof referenceNode> & { productsCount?: number };

/** The `{ items, total }` body of `url` (`/v1/reference/categories[?parentId=…]`):
 *  the roots with their `productsCount`, or a node's children without one. */
export function referenceCategories(url: string): { items: ReferenceItem[]; total: number } {
  const parentId = new URL(url, 'https://api.test').searchParams.get('parentId');
  const rows = CATEGORY_ROWS.filter((r) =>
    parentId
      ? r.parentId === parentId && r.isActive
      : r.parentId === null && r.level === 0 && r.isActive,
  ).sort(bySortOrder);
  const items = parentId
    ? rows.map(referenceNode)
    : rows.map((r) => ({ ...referenceNode(r), productsCount: ROOT_PRODUCTS_COUNT[r.id] ?? 0 }));
  return { items, total: rows.length };
}
