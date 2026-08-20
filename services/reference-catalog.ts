/**
 * Vehicle reference catalog — the backend's canonical make / model / trim /
 * engine tables that `POST /v1/garage/vehicles` validates against.
 *
 * The garage create endpoint keys a vehicle by `make_id` / `model_id`
 * (+ optional `trim_id` / `engine_id`) and rejects any id it doesn't
 * recognise ("Unknown or mismatched make_id/model_id"). Sourcing the
 * Add-Vehicle picker options from these live endpoints guarantees every
 * id the user can pick is one the backend will accept — which is why the
 * old free-text / VIN-guess flow only worked for Chevrolet (the one make
 * that happened to overlap the local catalog ids).
 *
 * Endpoints (public read, no auth):
 *   GET /v1/reference/makes                 → { items: [{ id, name, logo_url }] }
 *   GET /v1/reference/models?makeId=<id>    → { items: [{ id, make_id, name }] }
 *   GET /v1/reference/trims?modelId=<id>    → { items: [{ id, model_id, name }] }
 *   GET /v1/reference/engines?trimId=<id>   → { items: [{ id, name, displacement_cc, fuel_type }] }
 *
 * Offline / mock builds (no `EXPO_PUBLIC_API_BASE_URL`, or the `garage`
 * domain not HTTP-enabled) degrade to the bundled `uz-vehicle-catalog`
 * so the picker still populates. A network failure against a real backend
 * degrades the same way rather than leaving the form empty.
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';
import {
  UZ_BRANDS,
  getModelsForBrand,
} from '@/services/uz-vehicle-catalog';

const BASE = '/v1/reference';

/**
 * The 12 buyer-grid mainCategory buckets. They belong on the home "Shop by
 * category" grid (GET /v1/categories) — NOT in the reference-tree drill — so we
 * strip them from category listings here, keeping the after-brand
 * categories→subcategories flow to real subcategories only.
 */
const MAIN_CATEGORY_BUCKET_IDS = new Set([
  'brakes', 'batteries', 'filters', 'ignition', 'engine', 'electrical-parts',
  'oil-and-fluids', 'belts-and-hoses', 'wipers', 'lighting', 'suspension', 'exterior',
]);

export type RefMake = {
  id: string;
  name: string;
  logoUrl: string | null;
  /** Teaser brand — shown dimmed with a "Soon" badge and not tappable. */
  comingSoon: boolean;
};
export type RefModel = { id: string; makeId: string; name: string };
export type RefTrim = { id: string; modelId: string; name: string };
/**
 * A public part-category reference node (`GET /v1/reference/categories`). Used to
 * list the children of a category — notably the "Другое" (OTHER) subtree whose
 * ids feed the catalog filter (`GET /v1/catalog/parts?category=<id>`). Only
 * ACTIVE categories are ever returned, at any level. Ids are opaque — carry them
 * through verbatim; never hardcode or match by name.
 */
export type RefCategory = {
  id: string;
  name: string;
  /** Localized display titles (buyer app). Null until an admin/seed sets them;
   *  the app falls back to `name`. */
  titleRu: string | null;
  titleUz: string | null;
  slug: string;
  parentId: string | null;
  level: number;
  sortOrder: number;
};

/**
 * The label to show for a category in the given app language: Uzbek → `title_uz`,
 * everything else → `title_ru`, each falling back to the next and finally to the
 * raw `name` so a tile is never blank. `lang` is the i18next language code
 * (`i18n.language`), only its first two chars matter.
 */
export function localizedCategoryName(
  c: Pick<RefCategory, 'name' | 'titleRu' | 'titleUz'>,
  lang?: string,
): string {
  const l = (lang ?? '').slice(0, 2).toLowerCase();
  if (l === 'uz') return c.titleUz || c.titleRu || c.name;
  return c.titleRu || c.name;
}
export type RefEngine = {
  id: string;
  name: string;
  displacementCc?: number;
  fuelType?: string;
};

type Raw = Record<string, unknown>;
type Envelope = { items?: Raw[] | null } | Raw[] | null | undefined;

/** Unwrap the `{ items }` collection envelope (bare arrays also tolerated). */
function asItems(res: Envelope): Raw[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray((res as { items?: Raw[] }).items)) {
    return (res as { items: Raw[] }).items;
  }
  return [];
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

function numOrUndef(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** True when we should hit the live reference endpoints vs. the local fallback. */
function useHttp(): boolean {
  return shouldUseHttpTransport('garage');
}

// ── Local fallback (offline / mock / E2E) ────────────────────────────

function localMakes(): RefMake[] {
  return UZ_BRANDS.map((b) => ({
    id: b.id,
    name: b.label,
    logoUrl: b.logoUrl ?? null,
    comingSoon: false,
  }));
}

function localModels(makeId: string): RefModel[] {
  return getModelsForBrand(makeId).map((m) => ({
    id: m.id,
    makeId,
    name: m.label,
  }));
}

// ── Public fetchers ──────────────────────────────────────────────────

export async function fetchMakes(signal?: AbortSignal): Promise<RefMake[]> {
  if (!useHttp()) return localMakes();
  try {
    const res = await apiClient.get<Envelope>(`${BASE}/makes`, { signal });
    return asItems(res).map((m) => ({
      id: str(m.id),
      name: str(m.name),
      logoUrl: (m.logo_url as string | null) ?? null,
      comingSoon: m.coming_soon === true,
    }));
  } catch {
    // A reachable-but-failing backend shouldn't leave the picker empty.
    return localMakes();
  }
}

export async function fetchModels(
  makeId: string,
  signal?: AbortSignal,
): Promise<RefModel[]> {
  if (!makeId) return [];
  if (!useHttp()) return localModels(makeId);
  try {
    const res = await apiClient.get<Envelope>(
      `${BASE}/models?makeId=${encodeURIComponent(makeId)}`,
      { signal },
    );
    return asItems(res).map((m) => ({
      id: str(m.id),
      makeId: str(m.make_id) || makeId,
      name: str(m.name),
    }));
  } catch {
    return localModels(makeId);
  }
}

/**
 * Resolve a decoded make/model NAME pair to the backend's canonical
 * `make_id` / `model_id`. The VIN decoder can only *guess* catalog ids, and
 * its guesses don't match the live seed — that's the "Unknown or mismatched
 * make_id/model_id" 400 on `POST /v1/garage/vehicles`. So the garage-create
 * path resolves real ids here, from the same reference tables the backend
 * validates against.
 *
 * Returns both ids ONLY when both resolve: a `make_id` without a matching
 * `model_id` is itself a mismatch the backend rejects, so a partial (or no)
 * match degrades to `{}` and the caller sends the VIN alone for server-side
 * decode. On HTTP builds a failed reference lookup also degrades to `{}`
 * (VIN-only) rather than falling back to bundled ids the live backend would
 * reject. On mock/offline builds it resolves against the bundled catalog —
 * harmless, since the mock transport doesn't validate ids.
 */
export async function resolveCatalogIds(
  make: string,
  model: string,
  signal?: AbortSignal,
): Promise<{ makeId?: string; modelId?: string }> {
  const wantMake = make.trim().toLowerCase();
  const wantModel = model.trim().toLowerCase();
  if (!wantMake || !wantModel) return {};

  if (!useHttp()) {
    const lm = localMakes().find((x) => x.name.trim().toLowerCase() === wantMake);
    if (!lm) return {};
    const lmd = localModels(lm.id).find((x) => x.name.trim().toLowerCase() === wantModel);
    return lmd ? { makeId: lm.id, modelId: lmd.id } : {};
  }

  // Live: read the ids straight off the reference endpoints (not via the
  // fetchers above — those fall back to local ids on failure, which would
  // reintroduce the exact mismatch we're fixing). Any failure → {}.
  try {
    const makes = asItems(await apiClient.get<Envelope>(`${BASE}/makes`, { signal }));
    const m = makes.find((x) => str(x.name).trim().toLowerCase() === wantMake);
    if (!m) return {};
    const makeId = str(m.id);
    const models = asItems(
      await apiClient.get<Envelope>(
        `${BASE}/models?makeId=${encodeURIComponent(makeId)}`,
        { signal },
      ),
    );
    const md = models.find((x) => str(x.name).trim().toLowerCase() === wantModel);
    if (!md) return {};
    return { makeId, modelId: str(md.id) };
  } catch {
    return {};
  }
}

export async function fetchTrims(
  modelId: string,
  signal?: AbortSignal,
): Promise<RefTrim[]> {
  if (!modelId || !useHttp()) return [];
  try {
    const res = await apiClient.get<Envelope>(
      `${BASE}/trims?modelId=${encodeURIComponent(modelId)}`,
      { signal },
    );
    return asItems(res).map((t) => ({
      id: str(t.id),
      modelId: str(t.model_id) || modelId,
      name: str(t.name),
    }));
  } catch {
    return [];
  }
}

export async function fetchEngines(
  trimId?: string,
  signal?: AbortSignal,
): Promise<RefEngine[]> {
  if (!trimId || !useHttp()) return [];
  try {
    const res = await apiClient.get<Envelope>(
      `${BASE}/engines?trimId=${encodeURIComponent(trimId)}`,
      { signal },
    );
    return asItems(res).map((e) => ({
      id: str(e.id),
      name: str(e.name),
      displacementCc: numOrUndef(e.displacement_cc),
      fuelType: e.fuel_type ? str(e.fuel_type) : undefined,
    }));
  } catch {
    return [];
  }
}

/**
 * List the children of a part category (`GET /v1/reference/categories`). Pass a
 * `parentId` to list that node's children — e.g. the OTHER root's id to get the
 * oil sub-buckets; omit it for the roots. Only active categories come back.
 *
 * Gated on the `catalog` domain (not `garage`) because it feeds catalog browsing.
 * On mock/offline builds there is no bundled category tree, so this degrades to
 * an empty list rather than fabricating one. A `404` (unknown parentId) is
 * surfaced as `[]` too — an empty result and a missing parent both mean "nothing
 * to show here".
 */
export async function fetchReferenceCategories(
  parentId?: string,
  signal?: AbortSignal,
): Promise<RefCategory[]> {
  if (!shouldUseHttpTransport('catalog')) return [];
  const qs = parentId ? `?parentId=${encodeURIComponent(parentId)}` : '';
  try {
    const res = await apiClient.get<Envelope>(`${BASE}/categories${qs}`, { signal });
    // The reference node ships camelCase (`parentId`, `sortOrder`) per the spec;
    // tolerate snake_case too so a backend tweak can't silently blank the fields.
    return asItems(res)
      .filter((c) => !MAIN_CATEGORY_BUCKET_IDS.has(str(c.id)))
      .map((c) => ({
      id: str(c.id),
      name: str(c.name),
      titleRu: (c.titleRu as string | null) ?? (c.title_ru as string | null) ?? null,
      titleUz: (c.titleUz as string | null) ?? (c.title_uz as string | null) ?? null,
      slug: str(c.slug),
      parentId: (c.parentId as string | null) ?? (c.parent_id as string | null) ?? null,
      level: numOrUndef(c.level) ?? 0,
      sortOrder: numOrUndef(c.sortOrder) ?? numOrUndef(c.sort_order) ?? 0,
    }));
  } catch {
    return [];
  }
}
