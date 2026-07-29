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

export type RefMake = {
  id: string;
  name: string;
  logoUrl: string | null;
  /** Teaser brand — shown dimmed with a "Soon" badge and not tappable. */
  comingSoon: boolean;
};
export type RefModel = { id: string; makeId: string; name: string };
export type RefTrim = { id: string; modelId: string; name: string };
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
