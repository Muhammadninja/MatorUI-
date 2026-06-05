import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  garageService,
  type Vehicle,
  type VehicleInput,
  type VehiclePatch,
} from '@/services/garage-service';

export type UseGarageState = {
  vehicles: Vehicle[];
  primaryVehicle: Vehicle | undefined;
  secondaryVehicles: Vehicle[];

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

export function useGarage(): UseGarageState {
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => garageService.getVehicles());
  const [isLoading, setIsLoading] = useState(!garageService.hasLoadedOnce());
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

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
      garageService
        .refresh()
        .catch((e) => {
          if (mountedRef.current) setError(toMessage(e));
        })
        .finally(() => {
          if (mountedRef.current) setIsLoading(false);
        });
    } else {
      setIsLoading(false);
    }
    return unsubscribe;
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      await garageService.refresh();
    } catch (e) {
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
        if (mountedRef.current) setError(toMessage(e));
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

  return {
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
