/**
 * Types for the AutoZone-style multi-tier catalog navigation
 * (Systems → Parts). The `Part` shape is a UI-normalized view derived from
 * the backend `CatalogItem` (see `catalog-parts-screen`).
 */

import type { CatalogRegion } from '@/constants/catalog-regions';

/** A Master System (top-level "core category" like Brakes / Engine). */
export interface Category {
  id: string;
  /** English label. */
  label: string;
  /** Russian label (shown as the subtitle). */
  labelRu: string;
  /** Backend category key this system maps to for the parts query. */
  categoryKey: string;
}

/** A sub-grouping under a Master System (e.g. "Pads", "Rotors" under Brakes). */
export interface SubCategory {
  id: string;
  categoryId: string;
  label: string;
  labelRu?: string;
}

/** A single catalog part, normalized for the parts list UI. */
export interface Part {
  id: string;
  title: string;
  brand: string;
  /** Display price, e.g. "UZS 850,750". */
  price: string;
  /** Numeric price in som, for range filtering / sorting. */
  priceUzs: number;
  inStock: boolean;
  oem?: string;
  /** True when the part is OEM-grade (drives the "OEM" quick filter). */
  isOem: boolean;
  images: string[];
  categoryId: string;
}

export type CatalogSortBy = 'relevance' | 'price_asc' | 'price_desc' | 'newest';

/** Local filter state for the parts screen (client-side until the backend
 *  exposes filter params). */
export interface FilterState {
  /** Selected brand names; empty = all. */
  brands: string[];
  /** Selected market-of-origin regions; empty = all. */
  regions: CatalogRegion[];
  oemOnly: boolean;
  /** Restrict to General Motors brands (Chevrolet / Ravon / Daewoo …). */
  gmOnly: boolean;
  sortBy: CatalogSortBy;
}
