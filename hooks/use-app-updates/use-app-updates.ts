import * as Updates from 'expo-updates';
import { useCallback, useEffect, useState } from 'react';

/**
 * Over-the-air updates via expo-updates.
 *
 * Typical usage: call `checkAndApply()` once at app start (or on
 * AppState → 'active'). If an update is available it's downloaded
 * and the app reloads with the new bundle.
 *
 * No-op in dev (Expo Go / __DEV__): the call resolves with
 * `applied: false` so the rest of the app proceeds unchanged.
 */

export type UpdateCheckResult = {
  available: boolean;
  applied: boolean;
  error?: string;
};

export type UseAppUpdatesValue = {
  isChecking: boolean;
  isAvailable: boolean;
  /** Run the full flow: check → fetch → reload. Resolves once reload starts. */
  checkAndApply: () => Promise<UpdateCheckResult>;
  /** Force-reload to the currently-installed bundle (no fetch). */
  reload: () => Promise<void>;
};

export function useAppUpdates(): UseAppUpdatesValue {
  const [isChecking, setIsChecking] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

  const checkAndApply = useCallback(async (): Promise<UpdateCheckResult> => {
    // Skip in dev — expo-updates throws or no-ops.
    if (__DEV__) return { available: false, applied: false };
    setIsChecking(true);
    try {
      const update = await Updates.checkForUpdateAsync();
      if (!update.isAvailable) {
        setIsAvailable(false);
        return { available: false, applied: false };
      }
      setIsAvailable(true);
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
      return { available: true, applied: true };
    } catch (err) {
      return {
        available: false,
        applied: false,
        error: err instanceof Error ? err.message : 'Update check failed',
      };
    } finally {
      setIsChecking(false);
    }
  }, []);

  const reload = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      // ignore
    }
  }, []);

  // Auto-check once on mount. Most apps want this; callers that don't
  // can ignore the hook entirely.
  useEffect(() => {
    void checkAndApply();
  }, [checkAndApply]);

  return { isChecking, isAvailable, checkAndApply, reload };
}

export default useAppUpdates;
