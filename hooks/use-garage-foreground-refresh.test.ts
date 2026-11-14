import { afterEach, describe, expect, test, vi } from 'vitest';

const listeners: Array<(state: string) => void> = [];
vi.mock('react-native', () => ({
  AppState: {
    addEventListener: (_event: string, listener: (state: string) => void) => {
      listeners.push(listener);
      return { remove: () => listeners.splice(listeners.indexOf(listener), 1) };
    },
  },
}));
const refresh = vi.fn().mockResolvedValue(undefined);
vi.mock('@/services/garage-service', () => ({ garageService: { refresh: () => refresh() } }));
const invalidateQueries = vi.fn().mockResolvedValue(undefined);
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries }) }));
vi.mock('react', () => ({ useEffect: (effect: () => (() => void) | undefined) => { effect(); } }));

import {
  GARAGE_FOREGROUND_REFRESH_MS,
  resetGarageForegroundRefresh,
  shouldRefreshOnForeground,
  useGarageForegroundRefresh,
} from './use-garage-foreground-refresh';

afterEach(() => {
  listeners.splice(0);
  refresh.mockClear();
  invalidateQueries.mockClear();
  vi.useRealTimers();
});

describe('Garage foreground refresh', () => {
  test('only on becoming active, at most once a minute', () => {
    expect(shouldRefreshOnForeground('active', 120_000, 0)).toBe(true);
    expect(shouldRefreshOnForeground('active', GARAGE_FOREGROUND_REFRESH_MS - 1, 0)).toBe(false);
    expect(shouldRefreshOnForeground('background', 120_000, 0)).toBe(false);
    expect(shouldRefreshOnForeground('inactive', 120_000, 0)).toBe(false);
  });

  test('re-reads the Garage and the image states, once for every mounted screen', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    resetGarageForegroundRefresh(0);
    useGarageForegroundRefresh(true);
    useGarageForegroundRefresh(true);
    listeners.forEach((listener) => listener('active'));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['vehicle-image'] });
    vi.setSystemTime(1_000_000 + GARAGE_FOREGROUND_REFRESH_MS);
    listeners.forEach((listener) => listener('active'));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  test('does nothing for a guest or an empty Garage', () => {
    resetGarageForegroundRefresh(0);
    useGarageForegroundRefresh(false);
    expect(listeners).toHaveLength(0);
  });
});
