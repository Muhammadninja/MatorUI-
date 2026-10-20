/**
 * Categories transport — the "Shop by category" grid on Explore (home).
 *
 * Same shape as the other transports (top-featured, catalog, garage): an
 * interface, a Mock impl that returns the bundled tile list, and an HTTP impl
 * that calls the real `GET /v1/categories` endpoint through `apiClient`. The
 * swap is gated per-domain by `shouldUseHttpTransport('categories')`, so the
 * grid can be brought online independently of the rest of the app.
 *
 * Backend contract (GET /v1/categories?scope=main|vehicle):
 *   { items: [{ id, name, label, name_ru, name_uz, name_en, slug, count,
 *               iconKey, color }] }
 *
 * Two scopes, and they are NOT interchangeable:
 *   • `main`    — the 12 home tiles; this is what the home grid uses. A tile's
 *                 `id` is its slug ("brakes"). Its `count` and
 *                 `/v1/catalog/parts?category=<id>` both roll up by each part's
 *                 `main_category` bucket, so a tap lists what the tile counted.
 *   • `vehicle` — the 8 vehicle-system buckets (`BRAKE_SYSTEM`, …), whose ids
 *                 filter the parts list through `vehicle_category`. Not used by
 *                 the home grid.
 *
 * `vehicle` rows come back without the `name_*` i18n columns (the enum has no
 * translation table on the server), so the UI resolves those labels from the
 * app's own catalogue — see `category.vehicle.*` in `locales/`.
 *
 * The HTTP impl maps that onto the app's `CategoryTileData`. `iconKey` is the
 * server's stable icon handle (e.g. "electrical") which `AutoPartIcon` resolves
 * even when the display `name` ("Electrical Parts") doesn't match a legacy key.
 *
 * i18n: `name` is the backend's INTERNAL canonical name (always English) — it
 * is kept for icon resolution, placeholder detection and logs, but is never
 * rendered. `label` is the server-resolved display string for the request's
 * `Accept-Language`; the UI renders that. The three `name_*` fields let a
 * cached tile re-render on a language switch without a refetch.
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';
import { MATOR_CAT_TILES } from '@/mocks/mator-catalog';
import { cleanCategoryName } from '@/utils/category-label';

/** One "Shop by category" grid cell, normalized for the UI. */
export type CategoryTileData = {
  /** Stable category id / slug used for routing (e.g. "ENGINE"). */
  id: string;
  /** INTERNAL canonical name (English). Icon resolution, placeholder
   *  detection, logs — never rendered. Use `label` for display. */
  name: string;
  /** Server-resolved display text for the request's language. Falls back to
   *  `name` when the backend hasn't shipped the i18n columns yet. */
  label: string;
  /** Display name per language, for re-rendering a cached tile after a
   *  language switch without refetching. Absent pre-migration. */
  nameRu?: string;
  nameUz?: string;
  nameEn?: string;
  /** Parts count from the server (0 is meaningful — show it). */
  count: number;
  /** Accent color for the tile. */
  color: string;
  /** Server icon handle; falls back to `name` for the mock tiles. */
  iconKey: string;
};

/** Which hierarchy `/v1/categories` should return (see the module note). */
export type CategoryScope = 'main' | 'vehicle';

export interface CategoriesTransport {
  list(scope: CategoryScope, signal?: AbortSignal): Promise<CategoryTileData[]>;
}

const MOCK_LATENCY_MS = 280;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

// ── Mock transport ─────────────────────────────────────────────────────

class MockCategoriesTransport implements CategoriesTransport {
  // The bundled tiles are one flat list; the scope only matters to the live
  // backend, so it is accepted and ignored here.
  async list(_scope: CategoryScope, signal?: AbortSignal): Promise<CategoryTileData[]> {
    await delay(MOCK_LATENCY_MS, signal);
    // The bundled tiles key their icon by display name, so iconKey === name.
    return MATOR_CAT_TILES.map((t) => ({
      id: t.name,
      name: t.name,
      // The bundled tiles carry a single name, so it doubles as the label.
      label: t.name,
      count: t.count,
      color: t.color,
      iconKey: t.name,
    }));
  }
}

// ── HTTP transport (backend.json wire shape) ────────────────────────────

type ApiCategory = {
  id: string;
  /** INTERNAL canonical name — English, never rendered. */
  name: string;
  /** Already resolved for the request's `Accept-Language`. Optional because
   *  it is absent until the backend's category-i18n migration is applied. */
  label?: string;
  name_ru?: string;
  name_uz?: string;
  name_en?: string;
  slug?: string;
  count?: number;
  iconKey?: string;
  color?: string;
};

type ApiCategoriesResponse = { items: ApiCategory[] };

/** Fallback tint when the server omits a color, so a tile never renders blank. */
const DEFAULT_TILE_COLOR = '#4285f4';

class HttpCategoriesTransport implements CategoriesTransport {
  async list(scope: CategoryScope, signal?: AbortSignal): Promise<CategoryTileData[]> {
    const res = await apiClient.get<ApiCategoriesResponse>(`/v1/categories?scope=${scope}`, {
      signal,
    });
    return (
      (res.items ?? [])
        // Never surface the backend's "Uncategorized" bucket as a tile — show a
        // real category or nothing.
        // Matched against the INTERNAL `name`, not `label`: the placeholder is
        // an English backend sentinel, and its localized label wouldn't match.
        .filter((c) => cleanCategoryName(c.name))
        .map((c) => ({
          id: c.id,
          name: c.name,
          // Pre-migration the server omits `label`; fall back to `name` so a
          // tile is never blank (it just reads English, as it did before).
          // `||` not `??` so an empty/whitespace label falls through too.
          label: c.label?.trim() || c.name,
          nameRu: c.name_ru,
          nameUz: c.name_uz,
          nameEn: c.name_en,
          count: c.count ?? 0,
          color: c.color ?? DEFAULT_TILE_COLOR,
          // Icon handles are keyed off the internal name, never the label.
          iconKey: c.iconKey ?? c.name,
        }))
    );
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

export const categoriesTransport: CategoriesTransport = shouldUseHttpTransport('categories')
  ? new HttpCategoriesTransport()
  : new MockCategoriesTransport();

export function fetchCategories(
  scope: CategoryScope = 'vehicle',
  signal?: AbortSignal,
): Promise<CategoryTileData[]> {
  return categoriesTransport.list(scope, signal);
}
