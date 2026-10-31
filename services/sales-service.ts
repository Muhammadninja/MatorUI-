/**
 * Sales transport — the operator-run discount campaigns surfaced on catalog
 * cards (the "-15%" pill next to the price).
 *
 * Sales are NOT a per-product field: the backend models them as standalone
 * campaigns (`GET /v1/sales`), each with a discount and a scope that targets
 * ALL products, or a set of product / category / dealer ids. So the client
 * fetches the active campaigns once and matches each catalog item against them
 * locally (`resolveItemSale`), rather than reading a discount off the part.
 *
 * Same swap-by-injection pattern as `categories-service`: a mock impl (empty —
 * there are no offline sales to seed) and an HTTP impl calling `/v1/sales`.
 * Gated per-domain by `shouldUseHttpTransport('sales')`, so it stays on the mock
 * until `sales` is in `EXPO_PUBLIC_HTTP_DOMAINS`.
 *
 * Backend contract (verified live on api.mator.uz 2026-07-31):
 *   GET /v1/sales → { items: ApiSale[] }   (public; lists only ACTIVE sales)
 *   ApiSale = {
 *     id, title, description?,
 *     discountType: 'PERCENT' | 'FIXED',   // PERCENT: 0<v<=100; FIXED: UZS
 *     discountValue: number,
 *     scopeType: 'ALL_PRODUCTS' | 'PRODUCTS' | 'CATEGORIES' | 'DEALERS',
 *     targetIds?: string[],                 // required for every scope but ALL_PRODUCTS
 *     priority?: number,                    // higher wins when several match a product
 *     startAt, endAt,
 *   }
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';

export type SaleDiscountType = 'PERCENT' | 'FIXED';
export type SaleScopeType = 'ALL_PRODUCTS' | 'PRODUCTS' | 'CATEGORIES' | 'DEALERS';

/** UI-normalized active campaign. */
export type Sale = {
  id: string;
  title: string;
  discountType: SaleDiscountType;
  discountValue: number;
  scopeType: SaleScopeType;
  /** Product / category / dealer ids the sale applies to. Empty for ALL_PRODUCTS. */
  targetIds: string[];
  /** Higher wins when several sales match one product. Defaults to 0. */
  priority: number;
};

export interface SalesTransport {
  list(signal?: AbortSignal): Promise<Sale[]>;
}

// ── Mock transport ─────────────────────────────────────────────────────────
// No offline sales to seed — an empty list simply renders no discount pills,
// which is the correct "no active campaigns" state.
class MockSalesTransport implements SalesTransport {
  async list(): Promise<Sale[]> {
    return [];
  }
}

// ── HTTP transport — real campaigns via GET /v1/sales ──────────────────────
type ApiSale = {
  id: string;
  title?: string | null;
  discountType?: string | null;
  discountValue?: number | null;
  scopeType?: string | null;
  targetIds?: string[] | null;
  priority?: number | null;
};

type ApiSalesResponse = { items?: ApiSale[] | null };

const DISCOUNT_TYPES: readonly SaleDiscountType[] = ['PERCENT', 'FIXED'];
const SCOPE_TYPES: readonly SaleScopeType[] = [
  'ALL_PRODUCTS',
  'PRODUCTS',
  'CATEGORIES',
  'DEALERS',
];

/** Map a raw campaign to the normalized `Sale`, or drop it (return null) when a
 *  required field is missing/unknown so a malformed row can't crash a card. */
function mapSale(s: ApiSale): Sale | null {
  const discountType = DISCOUNT_TYPES.find((t) => t === s.discountType);
  const scopeType = SCOPE_TYPES.find((t) => t === s.scopeType);
  const discountValue = typeof s.discountValue === 'number' ? s.discountValue : NaN;
  if (!s.id || !discountType || !scopeType || !(discountValue > 0)) return null;
  return {
    id: s.id,
    title: s.title ?? '',
    discountType,
    discountValue,
    scopeType,
    targetIds: Array.isArray(s.targetIds) ? s.targetIds : [],
    priority: typeof s.priority === 'number' ? s.priority : 0,
  };
}

class HttpSalesTransport implements SalesTransport {
  async list(signal?: AbortSignal): Promise<Sale[]> {
    const res = await apiClient.get<ApiSalesResponse>('/v1/sales', { signal });
    return (res.items ?? []).map(mapSale).filter((s): s is Sale => s !== null);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────
export const salesTransport: SalesTransport = shouldUseHttpTransport('sales')
  ? new HttpSalesTransport()
  : new MockSalesTransport();

export function fetchSales(signal?: AbortSignal): Promise<Sale[]> {
  return salesTransport.list(signal);
}

// ── Matching ───────────────────────────────────────────────────────────────

/** The minimal catalog-item view the matcher needs. */
export type SaleTarget = {
  id: string;
  categoryId?: string;
  sellerId?: string;
  /** List price in UZS — needed to express a FIXED (flat-UZS) discount as a %. */
  priceUzs?: number;
};

export type ItemSale = {
  /** The winning campaign. */
  sale: Sale;
  /** Effective discount as a whole-number percent, for the "-15%" pill. */
  percent: number;
};

function saleApplies(s: Sale, item: SaleTarget): boolean {
  switch (s.scopeType) {
    case 'ALL_PRODUCTS':
      return true;
    case 'PRODUCTS':
      return s.targetIds.includes(item.id);
    case 'CATEGORIES':
      return item.categoryId != null && s.targetIds.includes(item.categoryId);
    case 'DEALERS':
      return item.sellerId != null && s.targetIds.includes(item.sellerId);
    default:
      return false;
  }
}

/**
 * Express a campaign as a whole-number percent off. The card treats the
 * catalog price as the FINAL (post-discount) price — so what the shopper pays
 * matches the cart, which charges the raw part price — and reconstructs the
 * struck-through "was" from this percent. A FIXED (flat-UZS) discount is
 * therefore converted to the equivalent percent of the pre-discount price
 * (`original = price + discount`).
 */
function salePercent(s: Sale, priceUzs?: number): number {
  if (s.discountType === 'PERCENT') return Math.round(s.discountValue);
  if (!priceUzs || priceUzs <= 0) return 0;
  return Math.round((s.discountValue / (priceUzs + s.discountValue)) * 100);
}

/**
 * Resolve the single sale that applies to a catalog item, or null. When several
 * campaigns match, the highest `priority` wins (ties keep the backend's order,
 * which is already deterministic). Returns null when nothing matches or the
 * winning discount rounds to 0%.
 */
export function resolveItemSale(item: SaleTarget, sales: Sale[]): ItemSale | null {
  let winner: Sale | null = null;
  for (const s of sales) {
    if (!saleApplies(s, item)) continue;
    if (!winner || s.priority > winner.priority) winner = s;
  }
  if (!winner) return null;
  const percent = salePercent(winner, item.priceUzs);
  if (percent <= 0 || percent >= 100) return null;
  return { sale: winner, percent };
}

/** Display pricing for one catalog item: the discount badge + the struck "was". */
export type ItemPricing = {
  /** Whole-number percent off. 0 when nothing is discounted. */
  savePct: number;
  /** Pre-discount price in UZS to strike through. 0 when there is none. */
  wasUzs: number;
};

/**
 * Resolve what a product surface should SHOW for price: the discount percent
 * and the struck-through "was".
 *
 * Prefers the backend-resolved sale carried on the part (authoritative — the
 * server already resolved scope/priority, `priceUzs` is the sale price and
 * `originalPriceUzs` the pre-discount one). Falls back to the client
 * `/v1/sales` matcher, which can only match ALL_PRODUCTS campaigns since the
 * public endpoint omits target ids, and reconstructs the "was" from the
 * percent. Shared by the listing card and Item Detail so both agree.
 */
export function resolveItemPricing(
  item: SaleTarget & { price?: string; salePercent?: number; originalPriceUzs?: number },
  sales: Sale[],
): ItemPricing {
  const backendPct = item.salePercent && item.salePercent > 0 ? item.salePercent : 0;
  const clientSale = resolveItemSale(item, sales);
  const savePct = backendPct > 0 ? Math.round(backendPct) : (clientSale?.percent ?? 0);
  const amountNum = item.priceUzs ?? (parseInt((item.price ?? '').replace(/\D/g, ''), 10) || 0);
  const wasUzs =
    backendPct > 0 && item.originalPriceUzs
      ? Math.round(item.originalPriceUzs)
      : savePct > 0 && amountNum > 0
        ? Math.round(amountNum / (1 - savePct / 100))
        : 0;
  return { savePct, wasUzs };
}
