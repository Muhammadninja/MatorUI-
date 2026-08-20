/**
 * Uzbekistan civilian licence-plate formatting.
 *
 * Modern UZ (O'zbekiston) government plates for private cars come in two
 * civilian layouts, both starting with a 2-digit region code (01–99;
 * e.g. 01 Toshkent city, 10 Toshkent region, 30 Andijon):
 *
 *   Format A — region · series letter · 3 digits · 2 letters   →  01 A 123 BC
 *   Format B — region · 3 digits · 3 letters                   →  10 777 AFG
 *
 * They're distinguished by the first character AFTER the region: a letter
 * means Format A, a digit means Format B. Stored/back-end form is compact
 * and un-spaced (`01A123BC` / `10777AFG`, matching `text/backend.json`'s
 * `license_plate`); the UI shows it grouped. The region prefix is what the
 * backend derives `registration_region_code` from, so the first two digits
 * matter in both formats.
 *
 * `normalizeUzPlate` is a slot-aware mask: each incoming char is kept only
 * if it fits the next expected slot (digit vs letter) of the format the
 * input has committed to, so typing `10 777 afg` or pasting `01-A-123-BC`
 * both land on the canonical value and stray characters are dropped rather
 * than corrupting the shape.
 */

const isDigit = (ch: string) => ch >= '0' && ch <= '9';
const isAlpha = (ch: string) => ch >= 'A' && ch <= 'Z';

// Slot classes for the tail (everything after the 2-digit region).
// D = digit slot, L = letter slot.
const TAIL_A = ['L', 'D', 'D', 'D', 'L', 'L'] as const; // A 123 BC
const TAIL_B = ['D', 'D', 'D', 'L', 'L', 'L'] as const; // 777 AFG

/** Compact, canonical, un-spaced plate (`01A123BC` / `10777AFG`) — persist this. */
export function normalizeUzPlate(raw: string): string {
  const chars = (raw ?? '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  let out = '';
  let i = 0;

  // Region — up to 2 leading digits.
  while (i < chars.length && out.length < 2 && isDigit(chars[i])) out += chars[i++];
  if (out.length < 2) return out; // still typing the region

  // Choose the tail template from the first remaining char: letter → A, digit → B.
  const rest = chars.slice(i);
  if (rest.length === 0) return out;
  const tail = isAlpha(rest[0]) ? TAIL_A : TAIL_B;

  let ti = 0;
  for (const ch of rest) {
    const slot = tail[ti];
    if (!slot) break; // tail is full
    if (slot === 'D' ? isDigit(ch) : isAlpha(ch)) {
      out += ch;
      ti++;
    }
    // A char that doesn't match the expected slot is skipped (mask behavior).
  }
  return out;
}

/** Grouped display form (`01 A 123 BC` or `10 777 AFG`). Works on partial input. */
export function formatUzPlate(raw: string): string {
  const n = normalizeUzPlate(raw);
  if (n.length <= 2) return n;
  const region = n.slice(0, 2);
  // Format A when the char after the region is a letter, else Format B.
  if (isAlpha(n[2])) {
    return [region, n.slice(2, 3), n.slice(3, 6), n.slice(6, 8)].filter(Boolean).join(' ');
  }
  return [region, n.slice(2, 5), n.slice(5, 8)].filter(Boolean).join(' ');
}

/** True only for a complete, well-formed plate in either civilian format. */
export function isValidUzPlate(raw: string): boolean {
  const n = normalizeUzPlate(raw);
  return /^\d{2}[A-Z]\d{3}[A-Z]{2}$/.test(n) || /^\d{5}[A-Z]{3}$/.test(n);
}

/** Grouped-form character length — the maxLength for a plate input.
 *  Format A ("01 A 123 BC" = 11) is the longer of the two, so it's the cap. */
export const UZ_PLATE_DISPLAY_MAXLENGTH = '01 A 123 BC'.length; // 11
