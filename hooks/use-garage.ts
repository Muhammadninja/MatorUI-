import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  garageService,
  type Vehicle,
  type VehicleInput,
  type VehiclePatch,
} from '@/services/garage-service';

/**
 * Five-state machine matching the convention from the search /
 * catalogue / top-featured hooks. Screens render one of five UI paths:
 *
 *   - 'idle'    → very briefly, before the first refresh fires
 *   - 'loading' → first read in flight (show skeleton)
 *   - 'success' → got vehicles
 *   - 'empty'   → fetch succeeded with zero vehicles (designed empty UI)
 *   - 'error'   → fetch failed (show retry)
 */
export type GarageState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export type UseGarageState = {
  /** Derived state machine. Prefer this over composing `isLoading`,
   *  `error`, and `vehicles.length` manually at the screen layer. */
  state: GarageState;

  vehicles: Vehicle[];
  primaryVehicle: Vehicle | undefined;
  secondaryVehicles: Vehicle[];

  /** Retained for backward compatibility with existing consumers
   *  (`add-vehicle-screen`, `vehicle-detail-screen`). New code should
   *  use `state` instead. */
  isLoading: boolean;
  isMutating: boolean;
  error: string | null;

  refresh: () => Promise<void>;
  addVehicle: (input: VehicleInput) => Promise<Vehicle>;
  updateVehicle: (id: string, patch: VehiclePatch) => Promise<Vehicle>;
  removeVehicle: (id: string) => Promise<void>;
  setPrimary: (id: string) => Promise<void>;
  clearError: () => void;
};

function toMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  return 'Something went wrong';
}

function isAbortError(e: unknown): boolean {
  if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
    return e.name === 'AbortError';
  }
  return e instanceof Error && e.name === 'AbortError';
}

export function useGarage(): UseGarageState {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => garageService.getVehicles());
  const [isLoading, setIsLoading] = useState(!garageService.hasLoadedOnce());
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  /** Controller for the current in-flight READ (refresh / initial load).
   *  Aborted on unmount and on every fresh refresh() call so older fetches
   *  don't fight the newer one. Mutations get their own controllers so
   *  in-flight create/update/delete aren't accidentally killed by a
   *  concurrent refresh. */
  const readAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Subscribe to live cache + trigger initial fetch when the cache is cold.
  useEffect(() => {
    const unsubscribe = garageService.subscribe(setVehicles);
    if (!garageService.hasLoadedOnce()) {
      const controller = new AbortController();
      readAbortRef.current = controller;
      garageService
        .refresh(controller.signal)
        .catch((e) => {
          // Aborts (component unmount, superseded by a newer refresh)
          // are not user-facing errors — silently drop them.
          if (isAbortError(e)) return;
          if (mountedRef.current) setError(toMessage(e));
        })
        .finally(() => {
          if (mountedRef.current) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
    return () => {
      unsubscribe();
      readAbortRef.current?.abort();
    };
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    // Abort any in-flight read before starting the new one.
    readAbortRef.current?.abort();
    const controller = new AbortController();
    readAbortRef.current = controller;
    try {
      await garageService.refresh(controller.signal);
    } catch (e) {
      if (isAbortError(e)) return;
      if (mountedRef.current) setError(toMessage(e));
      throw e;
    }
  }, []);

  const runMutation = useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T> => {
      setIsMutating(true);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        // AbortError here means the mutation's internal refresh was
        // superseded — the write itself succeeded server-side. Don't
        // surface as a user-facing error.
        if (!isAbortError(e) && mountedRef.current) {
          setError(toMessage(e));
        }
        throw e;
      } finally {
        if (mountedRef.current) setIsMutating(false);
      }
    },
    [],
  );

  const addVehicle = useCallback(
    (input: VehicleInput) => runMutation(() => garageService.addVehicle(input)),
    [runMutation],
  );

  const updateVehicle = useCallback(
    (id: string, patch: VehiclePatch) =>
      runMutation(() => garageService.updateVehicle(id, patch)),
    [runMutation],
  );

  const removeVehicle = useCallback(
    (id: string) => runMutation(() => garageService.removeVehicle(id)),
    [runMutation],
  );

  const setPrimary = useCallback(
    (id: string) => runMutation(() => garageService.setPrimary(id)),
    [runMutation],
  );

  const clearError = useCallback(() => setError(null), []);

  const primaryVehicle = useMemo(
    () => vehicles.find((v) => v.isPrimary) ?? vehicles[0],
    [vehicles],
  );

  const secondaryVehicles = useMemo(
    () => vehicles.filter((v) => v.id !== primaryVehicle?.id),
    [vehicles, primaryVehicle],
  );

  // Derive the five-state machine from the underlying flags. Error wins
  // over loading (even while a retry is in flight, the user is in the
  // error context and the retry button just dispatches a new fetch).
  // Loading wins over data (a slow refresh on a populated cache still
  // counts as "loading new data" — screens can choose to keep the data
  // visible if they want a soft-refresh feel).
  const state: GarageState = error
    ? 'error'
    : isLoading
    ? 'loading'
    : !garageService.hasLoadedOnce()
    ? 'idle'
    : vehicles.length === 0
    ? 'empty'
    : 'success';

  return {
    state,
    vehicles,
    primaryVehicle,
    secondaryVehicles,
    isLoading,
    isMutating,
    error,
    refresh,
    addVehicle,
    updateVehicle,
    removeVehicle,
    setPrimary,
    clearError,
  };
}

export default useGarage;
