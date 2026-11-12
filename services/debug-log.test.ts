import { afterEach, expect, test, vi } from 'vitest';
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
import { redact } from './debug-log';
test('PII and credentials are fully removed from nested payloads', () => {
  const input = { access_token: 'secret-token', user: { phone_e164: 'private-phone', first_name: 'private-name', email: 'private-email', address: 'private-address', vin: 'private-vin' } };
  const output = JSON.stringify(redact(input));
  for (const value of ['secret-token', 'private-phone', 'private-name', 'private-email', 'private-address', 'private-vin']) expect(output).not.toContain(value);
  expect(input.access_token).toBe('secret-token');
});
test('depth limits redact the subtree instead of returning raw secrets; cycles terminate', () => {
  const nested = { a: { b: { c: { d: { e: { access_token: 'deep-secret' } } } } } };
  expect(JSON.stringify(redact(nested))).not.toContain('deep-secret');
  const cycle: Record<string, unknown> = {}; cycle.self = cycle;
  expect(() => JSON.stringify(redact(cycle))).not.toThrow();
});

test('public debug flag cannot enable payload logging in a release build', async () => {
  vi.resetModules();
  vi.stubGlobal('__DEV__', false);
  vi.stubEnv('EXPO_PUBLIC_DEBUG_API', '1');
  const { DEBUG_API_ENABLED, debugLog } = await import('./debug-log');
  const log = vi.spyOn(console, 'log').mockImplementation(() => {});
  expect(DEBUG_API_ENABLED).toBe(false);
  debugLog('auth', 'release', { phone: 'private-phone' });
  expect(log).not.toHaveBeenCalled();
  log.mockRestore();
});
