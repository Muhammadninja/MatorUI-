import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';

import { garageService } from '@/services/garage-service';

/** At most one foreground refresh per minute, however many screens mount the hook. */
export const GARAGE_FOREGROUND_REFRESH_MS = 60_000;

let lastRefreshAt = Date.now();

/** Whether coming back to the foreground should re-read the Garage now. */
export function shouldRefreshOnForeground(
  next: AppStateStatus,
  now: number,
  lastAt: number,
): boolean {
  return next === 'active' && now - lastAt >= GARAGE_FOREGROUND_REFRESH_MS;
}

/** Test hook: reset the shared throttle. */
export function resetGarageForegroundRefresh(at = 0): void {
  lastRefreshAt = at;
}

/**
 * When the app returns to the foreground, re-read the Garage list and every
 * vehicle image state. An image approved while the app was in the background
 * (by a person, for a vehicle saved long ago) then appears on its own: no
 * reinstall, no logout, no delete-and-re-add, no app update. Failures are
 * silent: the screen keeps what it shows.
 */
export function useGarageForegroundRefresh(enabled: boolean): void {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!enabled) return undefined;
    const subscription = AppState.addEventListener('change', (next) => {
      const now = Date.now();
      if (!shouldRefreshOnForeground(next, now, lastRefreshAt)) return;
      lastRefreshAt = now;
      void garageService.refresh().catch(() => undefined);
      void queryClient.invalidateQueries({ queryKey: ['vehicle-image'] });
    });
    return () => subscription.remove();
  }, [enabled, queryClient]);
}
