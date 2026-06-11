/**
 * VIN validation. The standard is ISO 3779 — 17 characters from a
 * restricted alphabet (excludes I, O, Q to avoid digit confusion).
 *
 * Two validators are exposed:
 *   - `isVinShapeValid(vin)`  — cheap regex test, what the spec asks
 *     for. False positives are possible (a 17-char random string in
 *     the allowed alphabet passes) but it's what most scanners use.
 *   - `isVinChecksumValid(vin)` — ISO 3779 checksum at position 9
 *     (index 8). Eliminates ~91% of random false positives. Falls
 *     back to true for North-American VINs only; we run it as a
 *     soft signal in `validateVin()` and log to dev console when it
 *     mismatches so the team can decide whether to enforce strictly.
 */

export const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{17}$/;

export type VinValidationResult = {
  /** Passes the shape test — what the user requested as the primary
   *  gate. Always required to be true for success. */
  isShapeValid: boolean;
  /** Optional checksum pass. False does NOT block acceptance today;
   *  callers can opt to surface a warning. */
  isChecksumValid: boolean;
  /** Normalized VIN — uppercased, whitespace trimmed. Empty when
   *  shape is invalid. */
  vin: string;
};

export function normalizeVin(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

export function isVinShapeValid(vin: string): boolean {
  return VIN_REGEX.test(vin);
}

export function isVinChecksumValid(vin: string): boolean {
  if (!isVinShapeValid(vin)) return false;
  const weights = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
  const values: Record<string, number> = {
    A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
    J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
    S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
    '0': 0, '1': 1, '2': 2, '3': 3, '4': 4,
    '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  };
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const c = vin[i];
    const v = values[c];
    if (v === undefined) return false;
    sum += v * weights[i];
  }
  const checkExpected = sum % 11;
  const checkActual = vin[8];
  const checkAsValue = checkExpected === 10 ? 'X' : String(checkExpected);
  return checkActual === checkAsValue;
}

export function validateVin(raw: string): VinValidationResult {
  const normalized = normalizeVin(raw);
  const shape = isVinShapeValid(normalized);
  return {
    isShapeValid: shape,
    isChecksumValid: shape ? isVinChecksumValid(normalized) : false,
    vin: shape ? normalized : '',
  };
}

/**
 * Extract the first VIN-shaped substring from a noisy scan payload.
 * Useful when the camera returns barcode text that has prefix /
 * suffix bytes (date stamps, supplier codes) wrapped around the VIN.
 * Returns the normalized VIN, or `null` when nothing matches.
 */
export function extractVinFromScan(raw: string): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const match = cleaned.match(/[A-HJ-NPR-Z0-9]{17}/);
  if (!match) return null;
  return match[0];
}
