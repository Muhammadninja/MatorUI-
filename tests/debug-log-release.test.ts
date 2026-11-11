import { afterEach, expect, test, vi } from 'vitest';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });

test.each([false, undefined])('release does not log API payloads with __DEV__=%s and a stale debug override', async (dev) => {
  vi.stubGlobal('__DEV__', dev);
  vi.stubEnv('EXPO_PUBLIC_DEBUG_API', '1');
  const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  const { debugLog, DEBUG_API_ENABLED } = await import('@/services/debug-log');
  debugLog('unit', 'payload', { firstName: 'unit-private-value' });
  expect(DEBUG_API_ENABLED).toBe(false);
  expect(log).not.toHaveBeenCalled();
});

test('development can explicitly disable API logs', async () => {
  vi.stubGlobal('__DEV__', true);
  vi.stubEnv('EXPO_PUBLIC_DEBUG_API', '0');
  const { DEBUG_API_ENABLED } = await import('@/services/debug-log');
  expect(DEBUG_API_ENABLED).toBe(false);
});
