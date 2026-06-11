import { useCallback, useRef, useState } from 'react';

import { extractVinFromScan, validateVin, type VinValidationResult } from '@/utils/vin';

/**
 * Orchestration hook for the VIN scanner modal. Owns the open/close
 * state, the result callback, and a debounce guard so a barcode that
 * the camera reads frame-by-frame doesn't fire `onResult` 60 times a
 * second once a valid VIN locks in.
 *
 * Designed to be hosted at the screen that owns the form (Vehicle
 * Detail OR Add-Vehicle Wizard step 2). The modal component itself
 * stays a pure renderer that asks for permissions, mounts the camera,
 * and yields decoded barcode strings up — the hook decides what to do
 * with them.
 */

export type UseVinScannerOptions = {
  /** Called when a valid VIN locks in. Receives the normalized 17-char
   *  string; the modal will auto-close immediately after. */
  onResult: (vin: string, validation: VinValidationResult) => void;
  /** When true, the hook accepts VINs whose ISO 3779 checksum fails.
   *  Lets the team opt into stricter validation later by flipping a
   *  call-site default. Today defaults to true since many UZ-market
   *  Chevrolets ship with non-North-American check-digit conventions. */
  acceptInvalidChecksum?: boolean;
};

export type UseVinScannerValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  /** Forward this to the camera component as its onBarcodeScanned
   *  prop (or equivalent). Idempotent — once a valid VIN is captured,
   *  subsequent scans of the same VIN are ignored until `close()`. */
  onBarcodeScanned: (raw: string) => void;
};

export function useVinScanner(options: UseVinScannerOptions): UseVinScannerValue {
  const [isOpen, setIsOpen] = useState(false);
  const lockedRef = useRef<string | null>(null);

  const open = useCallback(() => {
    lockedRef.current = null;
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const onBarcodeScanned = useCallback(
    (raw: string) => {
      if (!isOpen) return;
      if (lockedRef.current) return;
      const candidate = extractVinFromScan(raw);
      if (!candidate) return;
      const validation = validateVin(candidate);
      if (!validation.isShapeValid) return;
      if (!options.acceptInvalidChecksum && !validation.isChecksumValid) return;
      lockedRef.current = validation.vin;
      options.onResult(validation.vin, validation);
      setIsOpen(false);
    },
    [isOpen, options],
  );

  return { isOpen, open, close, onBarcodeScanned };
}

export default useVinScanner;
