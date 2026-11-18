import { ApiError } from '@/services/api-client';
import type { RefModel } from '@/services/reference-catalog';

/** Years offered when the catalog states no start for a model: 24 reaches the
 *  early 2000s, which covers the Nexias and Damas still on the road here. */
export const DEFAULT_YEARS_BACK = 24;

/**
 * Earliest model year for reference rows whose API `year_from` is still null.
 * Keys use the backend's canonical `make_id:model_id`, so this covers the live
 * catalog even where its IDs differ from the bundled fitment catalog.
 * The dates follow manufacturer histories: Kia Heritage, Toyota archives,
 * Nissan Heritage, Volkswagen Newsroom, Genesis Newsroom, Chery and KGM histories.
 */
export const REFERENCE_MODEL_YEAR_STARTS: Readonly<Record<string, number>> = {
  'chevrolet:suburban': 1936,
  'daewoo:matiz': 1998,
  'daewoo:tico': 1991,
  'kia:kia-k5': 2010,
  'kia:kia-sportage': 1993,
  'kia:kia-rio': 1999,
  'kia:kia-k3': 2012,
  'kia:kia-sorento': 2002,
  'kia:kia-carens': 1999,
  'kia:kia-carnival': 1998,
  'kia:kia-bongo': 1980,
  'chery:chery-tiggo-7-pro': 2020,
  'chery:chery-tiggo-8-pro': 2021,
  'chery:chery-tiggo-2-pro': 2021,
  'lada:lada-niva': 1977,
  'lada:lada-granta': 2011,
  'toyota:toyota-camry': 1982,
  'toyota:toyota-rav4': 1994,
  'toyota:toyota-land-cruiser-prado': 1990,
  'nissan:nissan-patrol': 1951,
  'volkswagen:polo': 1975,
  'volkswagen:jetta': 1979,
  'volkswagen:passat': 1973,
  'volkswagen:golf': 1974,
  'volkswagen:caddy': 1982,
  'ravon:r4-cobalt': 2016,
  'ssangyong:torres': 2022,
  'ssangyong:rexton': 2001,
  'ssangyong:korando': 1983,
  'ssangyong:musso': 1993,
};

/** End years for discontinued badge/model combinations still marked open by API. */
export const REFERENCE_MODEL_YEAR_ENDS: Readonly<Record<string, number>> = {
  'daewoo:tico': 2001,
  'ravon:r4-cobalt': 2020,
};

export function referenceModelYearStart(makeId: string, modelId: string): number | undefined {
  return REFERENCE_MODEL_YEAR_STARTS[`${makeId}:${modelId}`];
}

export function referenceModelYearEnd(makeId: string, modelId: string): number | undefined {
  return REFERENCE_MODEL_YEAR_ENDS[`${makeId}:${modelId}`];
}

/**
 * The build years the add-car picker offers for a model, newest first.
 *
 * Prefer the API or bundled range. When the API has an upper bound but no
 * known start, offer only the upper-bound year instead of guessing a 24-year
 * history. The 24-year fallback is reserved for older catalogs with no range.
 * The newest year offered is never in the future, even when the backend accepts
 * next year.
 */
export function modelYearChoices(
  model: Pick<RefModel, 'yearFrom' | 'yearTo'> | undefined,
  currentYear: number,
): number[] {
  const to = Math.min(model?.yearTo ?? currentYear, currentYear);
  const hasRange = model?.yearFrom !== undefined || model?.yearTo !== undefined;
  const from = model?.yearFrom ?? (hasRange ? to : currentYear - (DEFAULT_YEARS_BACK - 1));
  const years: number[] = [];
  for (let y = to; y >= from; y -= 1) years.push(y);
  return years;
}

/** The range from a `VEHICLE_YEAR_UNSUPPORTED` rejection, or null for any other error. */
export function unsupportedYearRange(
  error: unknown,
): { yearFrom: number | null; yearTo: number } | null {
  if (!(error instanceof ApiError) || error.code !== 'VEHICLE_YEAR_UNSUPPORTED') return null;
  const details = (error.response as { details?: { year_from?: unknown; year_to?: unknown } } | undefined)?.details;
  const to = details?.year_to;
  if (typeof to !== 'number' || !Number.isInteger(to)) return null;
  const from = details?.year_from;
  return { yearFrom: typeof from === 'number' && Number.isInteger(from) ? from : null, yearTo: to };
}
