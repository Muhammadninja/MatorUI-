import { ApiError } from '@/services/api-client';
import type { RefModel } from '@/services/reference-catalog';

/** Years offered when the catalog states no start for a model: 24 reaches the
 *  early 2000s, which covers the Nexias and Damas still on the road here. */
export const DEFAULT_YEARS_BACK = 24;

/**
 * The build years the add-car picker offers for a model, newest first.
 *
 * The backend states each model's accepted range (`year_from` / `year_to` on
 * `/v1/reference/models`, the same range `POST /v1/garage/vehicles` checks), so
 * a discontinued car (Lacetti, last built 2024) offers no later year and a new
 * one (Onix, from 2012) none before it. A model with no stated start keeps the
 * open window back from this year. The newest year offered is never in the
 * future, even when the backend accepts next year.
 */
export function modelYearChoices(
  model: Pick<RefModel, 'yearFrom' | 'yearTo'> | undefined,
  currentYear: number,
): number[] {
  const to = Math.min(model?.yearTo ?? currentYear, currentYear);
  const from = model?.yearFrom ?? currentYear - (DEFAULT_YEARS_BACK - 1);
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
