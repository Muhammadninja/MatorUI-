import type { LanguageCode } from '@/services/language-storage';

/**
 * Digit grouping per app language.
 *
 * Uzbek maps to the Russian locale on purpose: both group thousands with a
 * space, and Hermes ships patchy ICU data for `uz`, where `toLocaleString`
 * can silently fall back to the en-US comma. Asking for `ru-RU` gets the
 * right shape on every engine we run on.
 */
const GROUPING_LOCALE: Record<LanguageCode, string> = {
  en: 'en-US',
  ru: 'ru-RU',
  uz: 'ru-RU',
};

/**
 * Odometer reading for display, e.g. `67 420 km` / `67,420 km`.
 *
 * Returns an empty string for a vehicle with no reading, so callers can use
 * it directly in a `[a, b].filter(Boolean).join(' · ')` sub-line without
 * leaving a dangling separator.
 *
 * Every garage surface used to inline `km.toLocaleString('en-US')`, which
 * printed `67,420` to a Russian and Uzbek UI where the separator is a space.
 */
export function formatMileage(
  km: number | null | undefined,
  unit: string,
  language: LanguageCode,
): string {
  if (km === null || km === undefined || !Number.isFinite(km)) return '';
  // ru-RU groups with a NON-BREAKING space (U+00A0). Normalise it to a plain
  // space so the string measures and wraps the same as the rest of the UI.
  const grouped = km.toLocaleString(GROUPING_LOCALE[language] ?? 'en-US').replace(/ /g, ' ');
  return `${grouped} ${unit}`;
}
