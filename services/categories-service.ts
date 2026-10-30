/**
 * Category-tree roots as tiles — the home "Shop by category" grid and the
 * systems list a make → model pick lands on.
 *
 * Both show the ROOTS of the category tree, exactly as
 * `GET /v1/reference/categories` (no parentId) serves them — Brake System,
 * Motor Oils, Engine… and "Другое". Ids, names and the set of roots all come
 * from the backend; the app adds no root of its own.
 *
 * The reference node carries no presentation (`iconKey`/`color`), so it is
 * attached here from ROOT_META, keyed on the stable root id. A root the map
 * doesn't know still shows, after the known ones, with the default icon.
 *
 * i18n: `name` is the INTERNAL canonical name — kept for icon resolution,
 * placeholder detection and logs, never rendered. `nameRu`/`nameUz`/`nameEn`
 * are the display names; the hooks resolve `label` from them for the active
 * language, so a language switch re-renders the tiles in place.
 */

import { fetchReferenceCategories, type RefCategory } from '@/services/reference-catalog';

/** One category tile or row, normalized for the UI. */
export type CategoryTileData = {
  /** Category id — the tree node id, carried verbatim into navigation. */
  id: string;
  /** INTERNAL canonical name. Icon resolution, placeholder detection, logs —
   *  never rendered. Use `label` for display. */
  name: string;
  /** Display text for the active language (the hooks resolve it from the
   *  per-language names below). Falls back to `name` for a row without them. */
  label: string;
  /** Display name per language. */
  nameRu?: string;
  nameUz?: string;
  nameEn?: string;
  /** Parts count, when the source has one. The tree roots carry none, so the
   *  home grid shows no count line. */
  count?: number;
  /** Accent color for the tile. */
  color: string;
  /** Icon handle `AutoPartIcon` resolves (e.g. "brakes"). */
  iconKey: string;
};

/** Root id → presentation. Colors are the category table's own values. */
export const ROOT_META: Record<string, { iconKey: string; color: string }> = {
  'brake-system': { iconKey: 'brakes', color: '#EA4335' },
  'motor-oil': { iconKey: 'oil', color: '#00ACC1' },
  'electrical-and-lighting': { iconKey: 'electrical', color: '#A142F4' },
  'tuning-and-accessories': { iconKey: 'tuning', color: '#9C27B0' },
  transmission: { iconKey: 'transmission', color: '#3F51B5' },
  'maintenance-and-fluids': { iconKey: 'maintenance', color: '#00ACC1' },
  'suspension-and-steering': { iconKey: 'suspension', color: '#009688' },
  'engine-system': { iconKey: 'engine', color: '#4285F4' },
  'heating-and-cooling': { iconKey: 'climate', color: '#03A9F4' },
  other: { iconKey: 'other', color: '#5F6368' },
};

/** The home grid's tile order. */
export const HOME_ROOT_ORDER: readonly string[] = [
  'brake-system',
  'motor-oil',
  'electrical-and-lighting',
  'tuning-and-accessories',
  'transmission',
  'maintenance-and-fluids',
  'suspension-and-steering',
  'engine-system',
  'heating-and-cooling',
  'other',
];

/** The systems list's row order (after a make → model pick). */
const SYSTEMS_ROOT_ORDER: readonly string[] = [
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
];

/** Where a root list renders — decides its order. */
export type RootSurface = 'home' | 'systems';

const DEFAULT_TILE_COLOR = '#4285f4';

/** One served root as a tile. */
function rootTile(root: RefCategory): CategoryTileData {
  const meta = ROOT_META[root.id];
  return {
    id: root.id,
    name: root.name,
    // Re-resolved for the active language by the hooks.
    label: root.titleRu ?? root.name,
    nameRu: root.titleRu ?? undefined,
    nameUz: root.titleUz ?? undefined,
    nameEn: root.titleEn ?? undefined,
    color: meta?.color ?? DEFAULT_TILE_COLOR,
    iconKey: meta?.iconKey || root.slug || root.id,
  };
}

/** Known roots in `order`; a root it doesn't list keeps its server order after them. */
function sortRoots(tiles: CategoryTileData[], order: readonly string[]): CategoryTileData[] {
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  return [...tiles].sort((a, b) => rank(a.id) - rank(b.id));
}

/**
 * The tree roots the backend serves, as tiles in the surface's order. `[]` when
 * it served none — a mock/offline build, or a failed read.
 */
export async function fetchRootCategories(
  surface: RootSurface,
  signal?: AbortSignal,
): Promise<CategoryTileData[]> {
  const roots = await fetchReferenceCategories(undefined, signal);
  return sortRoots(roots.map(rootTile), surface === 'home' ? HOME_ROOT_ORDER : SYSTEMS_ROOT_ORDER);
}
