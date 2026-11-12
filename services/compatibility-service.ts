/**
 * Part↔vehicle compatibility check, against the live backend contract:
 *
 *   POST /v1/catalog/parts/:id/check-compatibility  { vehicleId?, vin? }
 *     → { partId, vehicleId, status, isCompatible, badge{text,color}, details }
 *
 * Gated on the HTTP catalog transport: in mock/offline builds there is no
 * backend, so we return `null` (the UI simply shows no fit badge — never a
 * fabricated "fits"). Any network/HTTP failure also degrades to `null`.
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';

export type CompatibilityStatus =
  | 'EXACT_MATCH'
  | 'UNIVERSAL'
  | 'NOT_COMPATIBLE'
  | 'UNCERTAIN';

export type CompatibilityVerdict = 'compatible' | 'incompatible' | 'unknown';

/** Use the backend status as the verdict; its badge copy is legacy and may
 * incorrectly tell customers to check a VIN when fitment data is simply absent. */
export function compatibilityVerdict(status: CompatibilityStatus | string): CompatibilityVerdict {
  if (status === 'EXACT_MATCH' || status === 'UNIVERSAL') return 'compatible';
  if (status === 'NOT_COMPATIBLE') return 'incompatible';
  return 'unknown';
}

/** The badge's words for a status. A universal part says so rather than claiming
 *  a confirmed fit for this car; anything unconfirmed says exactly that. */
export function compatibilityLabelKey(status: CompatibilityStatus | string): string {
  if (status === 'UNIVERSAL') return 'catalog.universalFit';
  const verdict = compatibilityVerdict(status);
  return verdict === 'compatible'
    ? 'itemDetail.fitConfirmed'
    : verdict === 'incompatible'
      ? 'itemDetail.fitNotCompatible'
      : 'itemDetail.fitUnknown';
}

export type CompatibilityColor = 'green' | 'red' | 'yellow';

export type CompatibilityResult = {
  partId: string;
  vehicleId: string | null;
  status: CompatibilityStatus;
  isCompatible: boolean;
  badge: { text: string; color: CompatibilityColor };
  details: {
    matchedBy: 'MODEL_REF' | 'OEM_NUMBER' | 'UNIVERSAL';
    oemNumber: string | null;
  };
};

/**
 * Check whether `partId` fits the given vehicle. Returns `null` when the check
 * can't run (mock transport, no vehicle identifier, or a transport error) so
 * callers can treat "no answer" and "unknown" distinctly from a real status.
 */
export async function checkCompatibility(
  partId: string,
  vehicle: { vehicleId?: string; vin?: string },
): Promise<CompatibilityResult | null> {
  if (!shouldUseHttpTransport('catalog')) return null;
  if (!vehicle.vehicleId && !vehicle.vin) return null;
  return apiClient.post<CompatibilityResult>(
    `/v1/catalog/parts/${encodeURIComponent(partId)}/check-compatibility`,
    { vehicleId: vehicle.vehicleId, vin: vehicle.vin },
  );
}
