/**
 * Categories transport — the "Shop by category" grid on Explore (home).
 *
 * Same shape as the other transports (top-featured, catalog, garage): an
 * interface, a Mock impl that returns the bundled tile list, and an HTTP impl
 * that calls the real `GET /v1/categories` endpoint through `apiClient`. The
 * swap is gated per-domain by `shouldUseHttpTransport('categories')`, so the
 * grid can be brought online independently of the rest of the app.
 *
 * Backend contract (GET /v1/categories):
 *   { items: [{ id, name, slug, count, iconKey, color }] }
 *
 * The HTTP impl maps that onto the app's `CategoryTileData`. `iconKey` is the
 * server's stable icon handle (e.g. "electrical") which `AutoPartIcon` resolves
 * even when the display `name` ("Electrical Parts") doesn't match a legacy key.
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';
import { MATOR_CAT_TILES } from '@/mocks/mator-catalog';
import { cleanCategoryName } from '@/utils/category-label';

/** One "Shop by category" grid cell, normalized for the UI. */
export type CategoryTileData = {
  /** Stable category id / slug used for routing (e.g. "ENGINE"). */
  id: string;
  /** Display name shown on the tile. */
  name: string;
  /** Parts count from the server (0 is meaningful — show it). */
  count: number;
  /** Accent color for the tile. */
  color: string;
  /** Server icon handle; falls back to `name` for the mock tiles. */
  iconKey: string;
};

export interface CategoriesTransport {
  list(signal?: AbortSignal): Promise<CategoryTileData[]>;
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
  async list(signal?: AbortSignal): Promise<CategoryTileData[]> {
    await delay(MOCK_LATENCY_MS, signal);
    // The bundled tiles key their icon by display name, so iconKey === name.
    return MATOR_CAT_TILES.map((t) => ({
      id: t.name,
      name: t.name,
      count: t.count,
      color: t.color,
      iconKey: t.name,
    }));
  }
}

// ── HTTP transport (backend.json wire shape) ────────────────────────────

type ApiCategory = {
  id: string;
  name: string;
  slug?: string;
  count?: number;
  iconKey?: string;
  color?: string;
};

type ApiCategoriesResponse = { items: ApiCategory[] };

/** Fallback tint when the server omits a color, so a tile never renders blank. */
const DEFAULT_TILE_COLOR = '#4285f4';

class HttpCategoriesTransport implements CategoriesTransport {
  async list(signal?: AbortSignal): Promise<CategoryTileData[]> {
    const res = await apiClient.get<ApiCategoriesResponse>('/v1/categories', { signal });
    return (res.items ?? [])
      // Never surface the backend's "Uncategorized" bucket as a tile — show a
      // real category or nothing.
      .filter((c) => cleanCategoryName(c.name))
      .map((c) => ({
        id: c.id,
        name: c.name,
        count: c.count ?? 0,
        color: c.color ?? DEFAULT_TILE_COLOR,
        iconKey: c.iconKey ?? c.name,
      }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

export const categoriesTransport: CategoriesTransport = shouldUseHttpTransport('categories')
  ? new HttpCategoriesTransport()
  : new MockCategoriesTransport();

export function fetchCategories(signal?: AbortSignal): Promise<CategoryTileData[]> {
  return categoriesTransport.list(signal);
}
