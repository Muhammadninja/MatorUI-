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
  const requestKey = JSON.stringify([partId, vehicleId, vin]);
  const [check, setCheck] = useState<{
    key: string | null;
    result: CompatibilityResult | null;
    loading: boolean;
  }>({ key: null, result: null, loading: false });

  useEffect(() => {
    if (!partId || (!vehicleId && !vin)) {
      setCheck({ key: requestKey, result: null, loading: false });
      return;
    }
    let cancelled = false;
    setCheck({ key: requestKey, result: null, loading: true });
    checkCompatibility(partId, { vehicleId, vin })
      .then((r) => {
        if (!cancelled) setCheck({ key: requestKey, result: r, loading: false });
      })
      .catch(() => {
        if (!cancelled) setCheck({ key: requestKey, result: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [partId, vehicleId, vin, requestKey]);

  // Props change before the effect runs. Never show the previous vehicle's
  // positive badge for even that first render of the new selection.
  return check.key === requestKey
    ? { result: check.result, loading: check.loading }
    : { result: null, loading: Boolean(partId && (vehicleId || vin)) };
}
