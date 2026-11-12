import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Thin wrapper around expo-location.
 *
 *  - Caches the latest position in state.
 *  - Lazy permission — never asks unless the caller actually invokes
 *    `requestAndGetPosition()` or `getLast()`.
 *  - Cancellation-safe: an in-flight request is dropped on unmount.
 *  - Stable function references so consumers can pass them straight to
 *    memoized children without re-rendering.
 */

export type AppCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
};

export type PermissionStatus = 'unknown' | 'granted' | 'denied';

/** Why the last request returned no position: the user refused access, or the
 *  device could not produce a fix (GPS off, no signal, timeout). */
export type LocationFailure = 'denied' | 'unavailable';

export type UseAppLocationValue = {
  coords: AppCoords | null;
  isLoading: boolean;
  error: string | null;
  permission: PermissionStatus;
  /** Why the last request returned no position (null after a success). Read it
   *  once `requestAndGetPosition` has settled. */
  lastFailure: () => LocationFailure | null;
  /** Asks for permission if needed, then resolves with the current position. */
  requestAndGetPosition: () => Promise<AppCoords | null>;
  /** Returns the last cached position without prompting. */
  getLast: () => AppCoords | null;
  reset: () => void;
};

function toCoords(p: Location.LocationObject): AppCoords {
  return {
    latitude: p.coords.latitude,
    longitude: p.coords.longitude,
    accuracy: p.coords.accuracy,
    timestamp: p.timestamp,
  };
}

export function useAppLocation(): UseAppLocationValue {
  const [coords, setCoords] = useState<AppCoords | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<PermissionStatus>('unknown');
  const failureRef = useRef<LocationFailure | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
    };
  }, []);

  const requestAndGetPosition = useCallback(async (): Promise<AppCoords | null> => {
    setIsLoading(true);
    setError(null);
    failureRef.current = null;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (cancelledRef.current) return null;
      if (perm.status !== 'granted') {
        setPermission('denied');
        setError('Location permission denied');
        failureRef.current = 'denied';
        return null;
      }
      setPermission('granted');
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      if (cancelledRef.current) return null;
      const next = toCoords(position);
      setCoords(next);
      return next;
    } catch (err) {
      if (cancelledRef.current) return null;
      const message = err instanceof Error ? err.message : 'Location request failed';
      setError(message);
      failureRef.current = 'unavailable';
      return null;
    } finally {
      if (!cancelledRef.current) setIsLoading(false);
    }
  }, []);

  const getLast = useCallback(() => coords, [coords]);
  const lastFailure = useCallback(() => failureRef.current, []);

  const reset = useCallback(() => {
    setCoords(null);
    setError(null);
    failureRef.current = null;
    setIsLoading(false);
  }, []);

  return {
    coords,
    isLoading,
    error,
    permission,
    lastFailure,
    requestAndGetPosition,
    getLast,
    reset,
  };
}

export default useAppLocation;
