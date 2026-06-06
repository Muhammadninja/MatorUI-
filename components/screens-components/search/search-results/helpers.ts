import type { SearchResult } from '@/types/search';

/** Strip currency formatting → number. Treats unparseable as 0. */
export function parsePrice(s: string): number {
  const n = Number(s.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Find the cheapest result id relative to the currently displayed set.
 * Returns null when there are fewer than 2 results (nothing to compare).
 */
export function findCheapestId(results: SearchResult[]): string | null {
  if (results.length < 2) return null;
  let bestId: string | null = null;
  let bestPrice = Infinity;
  for (const r of results) {
    const p = parsePrice(r.price);
    if (p > 0 && p < bestPrice) {
      bestPrice = p;
      bestId = r.id;
    }
  }
  return bestId;
}
