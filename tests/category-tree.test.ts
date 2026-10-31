/**
 * The app's category tree against the category table itself.
 *
 * `fixtures/part_categories.csv` is the `part_categories` export the catalogue
 * is checked against. The reference endpoint is mocked to answer exactly as the
 * backend does for those rows (see `fixtures/part-categories.ts`), so these
 * tests pin, row by row:
 *   - the home grid shows the 10 roots the backend serves — "Другое" included,
 *     and never one the app made up;
 *   - every other active row is reachable through the drill, under its real
 *     parent (wheel-hubs-bearings → ball/roller bearings included);
 *   - `cat_uncategorized` and `rul` are never listed;
 *   - every name on screen is the table's own name for the active language;
 *   - each root has its own icon.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

import {
  CATEGORY_BY_ID,
  CATEGORY_ROWS,
  LANGS,
  ROOT_PRODUCTS_COUNT,
  csvName,
  referenceCategories,
  referenceNode,
} from './fixtures/part-categories';

vi.mock('@/config/api', () => ({ shouldUseHttpTransport: () => true }));

const get = vi.fn();
vi.mock('@/services/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a) },
}));

// The icon module renders through these; the tests only call its resolver.
vi.mock('lucide-react-native', () => ({ LayoutGrid: () => null }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/components/shared/app-view', () => ({ AppView: () => null }));

import { resolvePartIcon } from '@/components/screens-components/catalog/auto-part-icon';
import { HOME_ROOT_ORDER, ROOT_META, fetchRootCategories } from '@/services/categories-service';
import { fetchReferenceCategories, localizedCategoryName } from '@/services/reference-catalog';
import { localizedCategoryLabel } from '@/utils/category-label';

import AcCompressor from '@/assets/3D _Icons/atlts.png';
import Battery from '@/assets/3D _Icons/battery.png';
import BrakePad from '@/assets/3D _Icons/brake.png';
import WheelRim from '@/assets/3D _Icons/disk.png';
import Oil from '@/assets/3D _Icons/oil.png';
import OilFilter from '@/assets/3D _Icons/oilfilter.png';
import Piston from '@/assets/3D _Icons/p.png';
import Susp from '@/assets/3D _Icons/susp.png';
import EngineIcon from '@/assets/auto-parts/engine.png';

/** Never on the storefront, whatever the table says. */
const EXCLUDED = new Set(['cat_uncategorized', 'rul']);
const ROOTS = CATEGORY_ROWS.filter((r) => r.parentId === null && r.level === 0);
/** Every active, non-excluded row below a root — what the drill must reach. */
const VISIBLE_CHILDREN = CATEGORY_ROWS.filter(
  (r) => r.parentId !== null && r.isActive && !EXCLUDED.has(r.id),
);

beforeEach(() => {
  get.mockReset();
  get.mockImplementation(async (url: string) => referenceCategories(url));
});

// ── the table itself ───────────────────────────────────────────────────

describe('the category table', () => {
  test('has the 10 roots the home grid shows', () => {
    expect(ROOTS.map((r) => r.id).sort()).toEqual([...HOME_ROOT_ORDER].sort());
  });

  test('nests wheel-hubs-bearings under suspension-and-steering, bearings under it', () => {
    expect(CATEGORY_BY_ID.get('wheel-hubs-bearings')).toMatchObject({
      parentId: 'suspension-and-steering',
      level: 1,
    });
    for (const id of ['ball-bearings', 'roller-bearings']) {
      expect(CATEGORY_BY_ID.get(id)).toMatchObject({ parentId: 'wheel-hubs-bearings', level: 2 });
    }
  });
});

// ── home grid ──────────────────────────────────────────────────────────

describe('home grid', () => {
  test('shows the 10 roots the backend serves, "Другое" included, in the home order', async () => {
    const tiles = await fetchRootCategories('home');
    expect(tiles.map((t) => t.id)).toEqual([...HOME_ROOT_ORDER]);
  });

  test('shows no subcategory, no uncategorized node and no rul', async () => {
    const ids = (await fetchRootCategories('home')).map((t) => t.id);
    for (const id of ids)
      expect(CATEGORY_BY_ID.get(id)).toMatchObject({ parentId: null, level: 0 });
    expect(ids).not.toContain('cat_uncategorized');
    expect(ids).not.toContain('rul');
    expect(ids).not.toContain('brakes');
  });

  test("labels every tile with the table's name in each language", async () => {
    const tiles = await fetchRootCategories('home');
    for (const lang of LANGS) {
      for (const tile of tiles) {
        expect(localizedCategoryLabel(tile, lang)).toBe(
          csvName(CATEGORY_BY_ID.get(tile.id)!, lang),
        );
      }
    }
  });

  test("carries each root's parts count exactly as the backend served it", async () => {
    const tiles = await fetchRootCategories('home');
    expect(Object.fromEntries(tiles.map((t) => [t.id, t.count]))).toEqual(ROOT_PRODUCTS_COUNT);
  });

  test('carries no count from a backend that serves none', async () => {
    get.mockImplementation(async (url: string) => ({
      items: referenceCategories(url).items.map(({ productsCount: _count, ...node }) => node),
    }));
    for (const tile of await fetchRootCategories('home')) expect(tile.count).toBeUndefined();
  });

  test('never adds "Другое" itself: a backend that omits it gets a grid without it', async () => {
    get.mockImplementation(async (url: string) => {
      const res = referenceCategories(url);
      return { items: res.items.filter((c) => c.id !== 'other') };
    });
    const ids = (await fetchRootCategories('home')).map((t) => t.id);
    expect(ids).toHaveLength(9);
    expect(ids).not.toContain('other');
  });

  test('carries presentation only — no root names of its own', () => {
    for (const meta of Object.values(ROOT_META)) {
      expect(Object.keys(meta).sort()).toEqual(['color', 'iconKey']);
    }
  });

  test('keeps a root the app does not know, after the known ones', async () => {
    get.mockImplementation(async (url: string) => {
      const res = referenceCategories(url);
      const extra = {
        ...referenceNode(CATEGORY_BY_ID.get('transmission')!),
        id: 'new-root',
        nameEn: 'New root',
      };
      return { items: [extra, ...res.items] };
    });
    const tiles = await fetchRootCategories('home');
    expect(tiles.map((t) => t.id)).toEqual([...HOME_ROOT_ORDER, 'new-root']);
    expect(localizedCategoryLabel(tiles.at(-1)!, 'en')).toBe('New root');
  });

  test('without a server answer, has nothing to show (the screen offers a retry)', async () => {
    get.mockRejectedValue(new Error('offline'));
    expect(await fetchRootCategories('home')).toEqual([]);
  });
});

// ── systems list after a make → model pick ─────────────────────────────

describe('systems list', () => {
  test('lists every root the endpoint serves in its own order, "Другое" last', async () => {
    const tiles = await fetchRootCategories('systems');
    expect(tiles.map((t) => t.id)).toEqual([
      'brake-system',
      'engine-system',
      'suspension-and-steering',
      'transmission',
      'heating-and-cooling',
      'electrical-and-lighting',
      'maintenance-and-fluids',
      'motor-oil',
      'tuning-and-accessories',
      'other',
    ]);
  });

  test('carries no parts count: it follows a model pick, the count spans every model', async () => {
    for (const tile of await fetchRootCategories('systems')) expect(tile.count).toBeUndefined();
  });
});

// ── drill: every subcategory under its parent ───────────────────────────

type Reached = Map<string, { parentId: string | null; label: Record<string, string> }>;

/** Walk the tree the way the drill does: from each root, list children, recurse. */
async function walk(): Promise<Reached> {
  const seen: Reached = new Map();
  const queue = [...HOME_ROOT_ORDER];
  while (queue.length) {
    const parentId = queue.shift()!;
    for (const child of await fetchReferenceCategories(parentId)) {
      const label = Object.fromEntries(LANGS.map((l) => [l, localizedCategoryName(child, l)]));
      seen.set(child.id, { parentId: child.parentId, label });
      queue.push(child.id);
    }
  }
  return seen;
}

describe('drill', () => {
  test('reaches every active subcategory of the table, under its real parent', async () => {
    const reached = await walk();
    expect([...reached.keys()].sort()).toEqual(VISIBLE_CHILDREN.map((r) => r.id).sort());
    for (const row of VISIBLE_CHILDREN) {
      expect(reached.get(row.id)?.parentId).toBe(row.parentId);
    }
  });

  test('serves the six children of "Другое" from the backend', async () => {
    const children = await fetchReferenceCategories('other');
    expect(children.map((c) => c.id).sort()).toEqual([
      'agricultural-machinery',
      'fasteners-and-clips',
      'industrial-oil',
      'motorcycle-oil',
      'other-lubricants',
      'wiper-blades',
    ]);
  });

  test('lists the former home-grid buckets under their systems', async () => {
    const reached = await walk();
    const buckets = CATEGORY_ROWS.filter((r) => r.mainCategory !== null);
    expect(buckets).toHaveLength(12);
    for (const bucket of buckets) expect(reached.get(bucket.id)?.parentId).toBe(bucket.parentId);
  });

  test('wheel-hubs-bearings drills one level deeper into the bearings', async () => {
    const hubs = await fetchReferenceCategories('suspension-and-steering');
    expect(hubs.map((c) => c.id)).toContain('wheel-hubs-bearings');

    const bearings = await fetchReferenceCategories('wheel-hubs-bearings');
    expect(bearings.map((c) => c.id).sort()).toEqual(['ball-bearings', 'roller-bearings']);
    for (const b of bearings)
      expect(b).toMatchObject({ parentId: 'wheel-hubs-bearings', level: 2 });
  });

  test('never lists cat_uncategorized or rul, even if the server sends them', async () => {
    get.mockResolvedValue({
      items: ['rul', 'cat_uncategorized', 'shock-absorbers'].map((id) =>
        referenceNode(CATEGORY_BY_ID.get(id)!),
      ),
    });
    const ids = (await fetchReferenceCategories('suspension-and-steering')).map((c) => c.id);
    expect(ids).toEqual(['shock-absorbers']);
  });

  test("labels every subcategory with the table's name in each language", async () => {
    const reached = await walk();
    for (const row of VISIBLE_CHILDREN) {
      for (const lang of LANGS) expect(reached.get(row.id)?.label[lang]).toBe(csvName(row, lang));
    }
  });
});

// ── icons ──────────────────────────────────────────────────────────────

describe('root icons', () => {
  const iconFor = (rootId: string) => resolvePartIcon(rootId, ROOT_META[rootId].iconKey);

  test('each root shows a part from its own system', () => {
    expect(iconFor('brake-system')).toEqual({ image: BrakePad });
    expect(iconFor('motor-oil')).toEqual({ image: Oil });
    expect(iconFor('electrical-and-lighting')).toEqual({ image: Battery });
    expect(iconFor('tuning-and-accessories')).toEqual({ image: WheelRim });
    expect(iconFor('transmission')).toEqual({ image: Piston });
    expect(iconFor('maintenance-and-fluids')).toEqual({ image: OilFilter });
    expect(iconFor('suspension-and-steering')).toEqual({ image: Susp });
    expect(iconFor('engine-system')).toEqual({ image: EngineIcon });
    expect(iconFor('heating-and-cooling')).toEqual({ image: AcCompressor });
    expect(iconFor('other')).toHaveProperty('glyph');
  });

  test('no two roots share an icon', () => {
    const icons = HOME_ROOT_ORDER.map((id) => {
      const icon = iconFor(id);
      return 'image' in icon ? icon.image : icon.glyph;
    });
    expect(new Set(icons).size).toBe(HOME_ROOT_ORDER.length);
  });

  test("the table's own icon key for Heating & Cooling resolves too", () => {
    expect(resolvePartIcon('Heating & Cooling', 'cooling')).toEqual({ image: AcCompressor });
  });
});
