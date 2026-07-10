/**
 * Catalog "region" (market of origin) filter — China / Europe / Russia /
 * Korea / USA. Until the backend tags every part with an origin, the region
 * is inferred client-side from the brand/title; `normalizeRegion` coerces a
 * backend-supplied value onto the same key set. Single source of truth for
 * both the filter UI and the catalog service.
 */

export type CatalogRegion = 'china' | 'europe' | 'russia' | 'korea' | 'usa';

export const CATALOG_REGIONS: { key: CatalogRegion; label: string }[] = [
  { key: 'china', label: 'China' },
  { key: 'europe', label: 'Europe' },
  { key: 'russia', label: 'Russia' },
  { key: 'korea', label: 'Korea' },
  { key: 'usa', label: 'USA' },
];

/** Brand keywords grouped by their market of origin (lowercase, substring match). */
const BRAND_REGION: { region: CatalogRegion; brands: string[] }[] = [
  { region: 'usa', brands: ['chevrolet', 'chevy', 'gmc', 'gm', 'ford', 'jeep', 'tesla', 'cadillac', 'ravon'] },
  { region: 'korea', brands: ['hyundai', 'kia', 'daewoo', 'genesis', 'ssangyong'] },
  { region: 'europe', brands: ['volkswagen', 'vw', 'skoda', 'audi', 'bmw', 'mercedes', 'renault', 'peugeot', 'opel', 'fiat', 'volvo', 'porsche', 'seat'] },
  { region: 'russia', brands: ['lada', 'vaz', 'gaz', 'uaz', 'niva'] },
  { region: 'china', brands: ['byd', 'chery', 'haval', 'geely', 'changan', 'jac', 'exeed', 'omoda', 'jetour', 'foton', 'dongfeng', 'great wall', 'gwm', 'jaecoo', 'xitoy'] },
];

/** Best-effort region inference from a brand name or free text (title/description). */
export function brandRegion(text?: string | null): CatalogRegion | undefined {
  if (!text) return undefined;
  const t = text.toLowerCase();
  for (const { region, brands } of BRAND_REGION) {
    if (brands.some((b) => t.includes(b))) return region;
  }
  return undefined;
}

/**
 * General Motors brand family. In the UZ market GM (UzAuto) is dominant —
 * Chevrolet / Ravon / Daewoo — so "GM only" is a first-class quick filter.
 * Unambiguous marques only (no bare "gm", which would false-match substrings
 * like "seGMent").
 */
export const GM_BRANDS = ['chevrolet', 'chevy', 'ravon', 'daewoo', 'gmc', 'cadillac', 'buick', 'holden'];

/** True when a brand name / title / description belongs to the GM family. */
export function isGmBrand(text?: string | null): boolean {
  if (!text) return false;
  const t = text.toLowerCase();
  return GM_BRANDS.some((b) => t.includes(b));
}

/** Coerce a backend-supplied region string (any locale/casing) onto a known key. */
export function normalizeRegion(v?: string | null): CatalogRegion | undefined {
  if (!v) return undefined;
  const map: Record<string, CatalogRegion> = {
    china: 'china', cn: 'china', chinese: 'china', xitoy: 'china',
    europe: 'europe', eu: 'europe', european: 'europe', evropa: 'europe',
    russia: 'russia', ru: 'russia', russian: 'russia', rossiya: 'russia',
    korea: 'korea', kr: 'korea', korean: 'korea', koreya: 'korea', 'south korea': 'korea',
    usa: 'usa', us: 'usa', america: 'usa', american: 'usa', amerika: 'usa',
  };
  return map[v.toLowerCase().trim()];
}
