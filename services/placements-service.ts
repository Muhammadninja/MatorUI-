/**
 * Placements transport — the Explore "MATOR Certified" row.
 *
 * The row is a MONETIZABLE slot: each entry is a generic
 * `MatorCertifiedPlacement` (a certified category like "Certified Batteries", a
 * verified dealer, or a sold/sponsored ad unit). Same swap-by-injection pattern
 * as `categories-service`: a mock impl returning the bundled seed, and an HTTP
 * impl calling the (future) `GET /v1/placements` endpoint. Gated per-domain by
 * `shouldUseHttpTransport('placements')`, so it stays on the mock until the
 * backend ships the endpoint and the `placements` key is added to
 * `EXPO_PUBLIC_HTTP_DOMAINS` — a one-line enable, no code change.
 *
 * Backend contract (proposed — confirm field names from the first real payload):
 *   GET /v1/placements → { items: ApiPlacement[] }
 *   ApiPlacement = {
 *     id, title, subtitle?, badges?: string[],
 *     visual: { monogram?, image_url?, color },
 *     target: { kind:'catalogue', label, certified?:'oem'|'gm', query? }
 *           | { kind:'category', id, label }
 *           | { kind:'dealer', id, label }
 *           | { kind:'search', query }
 *           | { kind:'url', href },
 *     sponsor?: { name, sponsored }
 *   }
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';
import {
  MATOR_CERTIFIED,
  type CertifiedTarget,
  type MatorCertifiedPlacement,
} from '@/mocks/mator-catalog';

/** The UI-normalized placement shape (re-exported so callers import from here). */
export type Placement = MatorCertifiedPlacement;

export interface PlacementsTransport {
  list(signal?: AbortSignal): Promise<Placement[]>;
}

const MOCK_LATENCY_MS = 260;
/** Accent used when the backend omits a placement color, so a card never renders blank. */
const DEFAULT_PLACEMENT_COLOR = '#2A6FDB';

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

// ── Mock transport ──────────────────────────────────────────────────────

class MockPlacementsTransport implements PlacementsTransport {
  async list(signal?: AbortSignal): Promise<Placement[]> {
    await delay(MOCK_LATENCY_MS, signal);
    return MATOR_CERTIFIED.map((p) => ({ ...p }));
  }
}

// ── HTTP transport (proposed wire shape) ──────────────────────────────────

type ApiTarget =
  | { kind: 'catalogue'; label: string; certified?: 'oem' | 'gm'; query?: string }
  | { kind: 'category'; id: string; label?: string }
  | { kind: 'dealer'; id: string; label?: string }
  | { kind: 'search'; query: string }
  | { kind: 'url'; href: string };

type ApiPlacement = {
  id: string;
  title: string;
  subtitle?: string | null;
  badges?: string[] | null;
  visual?: {
    monogram?: string | null;
    image_url?: string | null;
    imageUrl?: string | null;
    color?: string | null;
  } | null;
  target?: ApiTarget | null;
  sponsor?: { name?: string | null; sponsored?: boolean | null } | null;
};

type ApiPlacementsResponse = { items: ApiPlacement[] };

/** Map the backend target onto the app's `CertifiedTarget`, defaulting unknown/
 *  missing targets to a labeled listing so a tap is never a dead end. */
function mapTarget(t: ApiTarget | null | undefined, fallbackLabel: string): CertifiedTarget {
  switch (t?.kind) {
    case 'catalogue':
      return {
        kind: 'catalogue',
        label: t.label ?? fallbackLabel,
        certified: t.certified,
        query: t.query,
      };
    case 'category':
      return { kind: 'category', id: String(t.id), label: t.label ?? fallbackLabel };
    case 'dealer':
      return { kind: 'dealer', id: String(t.id), label: t.label ?? fallbackLabel };
    case 'search':
      return { kind: 'search', query: String(t.query ?? fallbackLabel) };
    case 'url':
      return { kind: 'url', href: String(t.href ?? '') };
    default:
      // Unknown/missing target → open the premium certified catalogue labeled
      // with the placement title, so a tap is never a dead end.
      return { kind: 'catalogue', label: fallbackLabel };
  }
}

function mapPlacement(p: ApiPlacement): Placement {
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle ?? undefined,
    badges: p.badges ?? undefined,
    visual: {
      monogram: p.visual?.monogram ?? undefined,
      imageUrl: p.visual?.image_url ?? p.visual?.imageUrl ?? undefined,
      color: p.visual?.color ?? DEFAULT_PLACEMENT_COLOR,
    },
    target: mapTarget(p.target, p.title),
    sponsor: p.sponsor
      ? { name: p.sponsor.name ?? '', sponsored: p.sponsor.sponsored ?? false }
      : undefined,
  };
}

class HttpPlacementsTransport implements PlacementsTransport {
  async list(signal?: AbortSignal): Promise<Placement[]> {
    const res = await apiClient.get<ApiPlacementsResponse>('/v1/placements', { signal });
    return (res.items ?? []).map(mapPlacement);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

export const placementsTransport: PlacementsTransport = shouldUseHttpTransport('placements')
  ? new HttpPlacementsTransport()
  : new MockPlacementsTransport();

export function fetchPlacements(signal?: AbortSignal): Promise<Placement[]> {
  return placementsTransport.list(signal);
}
