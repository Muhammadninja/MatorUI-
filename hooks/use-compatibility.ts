/**
 * Fetch part↔vehicle compatibility for the active garage vehicle. Re-runs when
 * the part or the resolved vehicle (id/vin) changes. Fails soft: a transport
 * error or a mock build leaves `result === null`, so the UI shows no fit badge
 * rather than a fabricated one.
 */

import { useEffect, useState } from 'react';

import {
  checkCompatibility,
  type CompatibilityResult,
} from '@/services/compatibility-service';

export function useCompatibility(
  partId: string | null,
  vehicleId?: string,
  vin?: string,
): { result: CompatibilityResult | null; loading: boolean } {
  const [result, setResult] = useState<CompatibilityResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!partId || (!vehicleId && !vin)) {
      setResult(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    checkCompatibility(partId, { vehicleId, vin })
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch(() => {
        if (!cancelled) setResult(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [partId, vehicleId, vin]);

  return { result, loading };
}
