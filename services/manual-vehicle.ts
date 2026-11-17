import { ApiError } from '@/services/api-client';

/** Longest make or model name an owner may type (backend VARCHAR(60)). */
export const MANUAL_NAME_MAX = 60;

/** Oldest build year offered for a car entered by hand. */
export const MANUAL_YEAR_MIN = 1980;

// Control characters and bidi overrides the backend refuses.
const UNSAFE = /[\u0000-\u001f\u007f-\u009f‪-‮⁦-⁩]/;

/**
 * The same rules as the backend's normalizeVehicleName: NFC, trimmed, inner
 * whitespace collapsed. Returns the clean name, or why it can't be saved.
 */
export function checkManualName(raw: string): { name: string } | { error: 'empty' | 'invalid' | 'tooLong' } {
  const name = raw.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (!name) return { error: 'empty' };
  if (UNSAFE.test(name) || !/[\p{L}\p{N}]/u.test(name)) return { error: 'invalid' };
  if (name.length > MANUAL_NAME_MAX) return { error: 'tooLong' };
  return { name };
}

/**
 * Build years for a hand-entered car, newest first: this year back to
 * MANUAL_YEAR_MIN. Never a future year (the backend refuses one for a manual
 * vehicle), since nothing tells us when an unlisted model was built.
 */
export function manualYearChoices(currentYear: number): number[] {
  const years: number[] = [];
  for (let y = currentYear; y >= MANUAL_YEAR_MIN; y -= 1) years.push(y);
  return years;
}

/** Why the backend refused a manual vehicle, for a message the owner can act on. */
export type ManualVehicleRejection =
  | { kind: 'inCatalog'; makeId: string; modelId: string | null }
  | { kind: 'futureYear'; yearTo: number }
  | { kind: 'invalidName' };

export function manualVehicleRejection(error: unknown): ManualVehicleRejection | null {
  if (!(error instanceof ApiError)) return null;
  const details = (error.response as { details?: Record<string, unknown> } | undefined)?.details ?? {};
  if (error.code === 'VEHICLE_IN_CATALOG' && typeof details.make_id === 'string') {
    return {
      kind: 'inCatalog',
      makeId: details.make_id,
      modelId: typeof details.model_id === 'string' ? details.model_id : null,
    };
  }
  if (error.code === 'VEHICLE_YEAR_IN_FUTURE' && typeof details.year_to === 'number') {
    return { kind: 'futureYear', yearTo: details.year_to };
  }
  if (error.code === 'VEHICLE_MANUAL_NAME_INVALID') return { kind: 'invalidName' };
  return null;
}

/**
 * Params for the "parts for my car" screen. A hand-entered car's model name is
 * the owner's text, not a catalog model, so it never scopes the list as an exact
 * fit: only a catalog make is passed, and `custom` makes the screen say so.
 */
export function vehiclePartsParams(v: {
  make?: string;
  model?: string;
  year?: string | number;
  label: string;
  isCustom?: boolean;
  brandId?: string;
}): Record<string, string> {
  const year = v.year === undefined ? undefined : String(v.year);
  const base = { label: v.label, ...(year ? { year } : {}) };
  if (!v.isCustom) return { ...base, ...(v.make ? { make: v.make } : {}), ...(v.model ? { model: v.model } : {}) };
  return { ...base, ...(v.brandId && v.make ? { make: v.make } : {}), custom: '1' };
}

/** Case- and space-insensitive key, the backend's rule for "same name as the catalog". */
export const manualNameKey = (name: string) =>
  name.normalize('NFC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('en');

/** The listed choice whose name the owner typed, if any. */
export function findListedByName<T extends { label: string }>(choices: readonly T[], typed: string): T | null {
  const key = manualNameKey(typed);
  return key ? (choices.find((c) => manualNameKey(c.label) === key) ?? null) : null;
}
