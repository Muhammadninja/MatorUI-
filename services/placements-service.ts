/**
 * Placements transport — the Explore "MATOR Certified" row.
 *
 * Live data comes from the PUBLIC dealer storefront `GET /v1/dealers`: its rows
 * ARE the verified/certified dealers, and the admin console's certify / suspend
 * writes are reflected here (a suspended dealer drops off the list), so this row
 * stays in sync with what operators do in the panel — same shared DB.
 *
 * Same swap-by-injection pattern as `categories-service`: a mock impl returning
 * the bundled `MATOR_CERTIFIED` seed (offline / error fallback), and an HTTP impl
 * calling `/v1/dealers`. Gated per-domain by `shouldUseHttpTransport('dealers')`,
 * so it stays on the mock until `dealers` is in `EXPO_PUBLIC_HTTP_DOMAINS`.
 *
 * Backend contract (verified live on api.mator.uz 2026-07-28):
 *   GET /v1/dealers → { items: ApiDealer[] }
 *   ApiDealer = { id, name, initial?, color?, orders?: string, years?: number }
 *   (`orders` is a preformatted display string, e.g. "18k+".)
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';
import {
  MATOR_CERTIFIED,
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

// ── HTTP transport — real certified dealers via GET /v1/dealers ────────────

type ApiDealer = {
  id: string;
  name: string;
  initial?: string | null;
  /** Brand logo the operator uploaded in the admin console. Rendered on the card
   *  when present; the monogram tile is the fallback. */
  logoUrl?: string | null;
  logo_url?: string | null;
  /** Preformatted display string, e.g. "18k+". */
  orders?: string | null;
  years?: number | null;
  color?: string | null;
  /** Live badge flags mirrored from the admin dealer console. */
  certified?: boolean | null;
  lowestPrice?: boolean | null;
  lowest_price?: boolean | null;
};

type ApiDealersResponse = { items: ApiDealer[] };

/** "18k+ orders · 12y", or a single part, or nothing if the backend omits both. */
function dealerSubtitle(d: ApiDealer): string | undefined {
  const parts: string[] = [];
  if (d.orders) parts.push(`${d.orders} orders`);
  if (typeof d.years === 'number' && d.years > 0) parts.push(`${d.years}y`);
  return parts.length ? parts.join(' · ') : undefined;
}

/** Map a public dealer storefront row onto a MATOR Certified card. Badges are
 *  driven by the live flags: the endpoint only returns certified dealers, so the
 *  Certified chip always shows, and the Lowest-Price chip follows the real flag —
 *  so disabling either in the admin console updates this card. */
function mapDealer(d: ApiDealer): Placement {
  const lowestPrice = d.lowestPrice ?? d.lowest_price ?? false;
  const badges: string[] = [];
  if (d.certified ?? true) badges.push('MATOR CERTIFIED');
  if (lowestPrice) badges.push('LOWEST PRICE');
  return {
    id: d.id,
    title: d.name,
    subtitle: dealerSubtitle(d),
    badges: badges.length ? badges : undefined,
    visual: {
      // Real brand icon when the operator uploaded one; the card renders the
      // image and only falls back to the monogram tile when it's absent.
      imageUrl: d.logoUrl ?? d.logo_url ?? undefined,
      monogram: d.initial ?? d.name.charAt(0).toUpperCase(),
      color: d.color ?? DEFAULT_PLACEMENT_COLOR,
    },
    // A verified storefront. Taps open the premium certified catalogue labeled
    // for the dealer (no dealer-scoped catalog filter on the backend yet).
    target: { kind: 'dealer', id: d.id, label: d.name },
  };
}

class HttpPlacementsTransport implements PlacementsTransport {
  async list(signal?: AbortSignal): Promise<Placement[]> {
    const res = await apiClient.get<ApiDealersResponse>('/v1/dealers', { signal });
    return (res.items ?? []).map(mapDealer);
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────

export const placementsTransport: PlacementsTransport = shouldUseHttpTransport('dealers')
  ? new HttpPlacementsTransport()
  : new MockPlacementsTransport();

export function fetchPlacements(signal?: AbortSignal): Promise<Placement[]> {
  return placementsTransport.list(signal);
}
