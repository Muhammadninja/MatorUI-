// Staging proxy access travels in its own header next to the app's Bearer
// token, never replaces it, never reaches production, and a proxy refusal is
// never mistaken for an expired session.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const environment = vi.hoisted(() => ({ name: 'production', apiBaseUrl: 'https://api.mator.uz',
  httpDomains: '', allowDevOtp: false }));
const session = vi.hoisted(() => ({ current: null as null | { accessToken: string; refreshToken: string } }));
vi.mock('@/config/environment', () => ({ getAppEnvironment: () => environment, allowLocalDevOtp: () => false,
  isDedicatedE2EApp: () => false }));
vi.mock('@/services/auth-storage', () => ({ getCurrentSession: () => session.current }));

import * as SecureStore from 'expo-secure-store';

import { apiClient, ApiError, setUnauthorizedHandler } from '@/services/api-client';
import { GarageRealtimeClient } from '@/services/garage-realtime';
import { paymentsTransport } from '@/services/payments-service';
import {
  hasStagingAccess, loadStagingAccess, saveStagingAccess, STAGING_ACCESS_HEADER,
  stagingAccessHeaders, verifyStagingAccess,
} from '@/services/staging-access';

const TOKEN = 'a'.repeat(64);
const STAGING = { name: 'staging', apiBaseUrl: 'https://api.staging.mator.uz', httpDomains: '', allowDevOtp: false };
const PRODUCTION = { name: 'production', apiBaseUrl: 'https://api.mator.uz', httpDomains: '', allowDevOtp: false };

type Call = { url: string; headers: Record<string, string> };
const calls: Call[] = [];
function stubFetch(...responses: Response[]) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: { ...(init?.headers as Record<string, string>) } });
    return responses.shift() ?? new Response('{}', { status: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}
const proxyRefusal = () => new Response('<html>401</html>', { status: 401,
  headers: { 'WWW-Authenticate': 'Basic realm="Mator Staging"' } });

beforeEach(async () => {
  vi.stubGlobal('__DEV__', false);
  calls.length = 0;
  session.current = { accessToken: 'jwt.access.token', refreshToken: 'refresh' };
  (SecureStore as unknown as { __resetSecureStore(): void }).__resetSecureStore();
  Object.assign(environment, STAGING);
  await loadStagingAccess();
});
afterEach(() => {
  setUnauthorizedHandler(null);
  vi.unstubAllGlobals();
  Object.assign(environment, PRODUCTION);
});

describe('production', () => {
  test('requests carry no staging header and are otherwise unchanged', async () => {
    await saveStagingAccess(TOKEN);
    Object.assign(environment, PRODUCTION);
    stubFetch();
    await apiClient.get('/v1/me');
    expect(calls[0].url).toBe('https://api.mator.uz/v1/me');
    expect(calls[0].headers.Authorization).toBe('Bearer jwt.access.token');
    expect(Object.keys(calls[0].headers).map((h) => h.toLowerCase())).not.toContain('x-mator-staging-access');
    expect(stagingAccessHeaders()).toEqual({});
    expect(hasStagingAccess()).toBe(true);
  });

  test('a Basic challenge from production is still an ordinary 401 for the auth layer', async () => {
    Object.assign(environment, PRODUCTION);
    const handler = vi.fn(async () => { session.current = null; });
    setUnauthorizedHandler(handler);
    stubFetch(proxyRefusal());
    await expect(apiClient.get('/v1/me')).rejects.toMatchObject({ status: 401 });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  test('a token cannot be saved outside staging', async () => {
    Object.assign(environment, PRODUCTION);
    await expect(saveStagingAccess(TOKEN)).rejects.toThrow();
  });
});

describe('staging', () => {
  test('starts without access until a tester enters a token', () => {
    expect(hasStagingAccess()).toBe(false);
    expect(stagingAccessHeaders()).toEqual({});
  });

  test('rejects malformed tokens and keeps valid ones in the device-only keychain', async () => {
    await expect(saveStagingAccess('short')).rejects.toThrow();
    await expect(saveStagingAccess(`${'b'.repeat(40)}:pw`)).rejects.toThrow();
    const set = vi.spyOn(SecureStore, 'setItemAsync');
    await saveStagingAccess(`  ${TOKEN}  `);
    expect(set).toHaveBeenCalledWith('mator_staging_access_v1', TOKEN,
      { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    set.mockRestore();
    expect(await loadStagingAccess()).toBe(true);
    expect(stagingAccessHeaders()).toEqual({ [STAGING_ACCESS_HEADER]: TOKEN });
  });

  test('sends the proxy token beside the Bearer token, never instead of it', async () => {
    await saveStagingAccess(TOKEN);
    stubFetch();
    await apiClient.get('/v1/me');
    await apiClient.post('/v1/auth/otp/request', { phone: 'x' }, { skipAuth: true });
    expect(calls[0].headers).toMatchObject({ Authorization: 'Bearer jwt.access.token', [STAGING_ACCESS_HEADER]: TOKEN });
    expect(calls[1].headers[STAGING_ACCESS_HEADER]).toBe(TOKEN);
    expect(calls[1].headers.Authorization).toBeUndefined();
    expect(JSON.stringify(calls)).not.toMatch(/Basic /);
  });

  test('a proxy refusal keeps the session, skips refresh and asks for a new token', async () => {
    await saveStagingAccess(TOKEN);
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    stubFetch(proxyRefusal());
    const error = await apiClient.get('/v1/me').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: 'STAGING_ACCESS_DENIED' });
    expect((error as ApiError).isUnauthorized).toBe(false);
    expect(handler).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
    await vi.waitFor(() => expect(hasStagingAccess()).toBe(false));
    expect(await SecureStore.getItemAsync('mator_staging_access_v1')).toBeNull();
    expect(session.current).not.toBeNull();
  });

  test('an API 401 still goes through the normal refresh flow', async () => {
    await saveStagingAccess(TOKEN);
    const handler = vi.fn(async () => { session.current = { accessToken: 'fresh', refreshToken: 'r2' }; });
    setUnauthorizedHandler(handler);
    stubFetch(new Response(JSON.stringify({ code: 'TOKEN_EXPIRED' }), { status: 401 }), new Response('{"ok":true}'));
    await expect(apiClient.get('/v1/me')).resolves.toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(calls[1].headers).toMatchObject({ Authorization: 'Bearer fresh', [STAGING_ACCESS_HEADER]: TOKEN });
  });

  test('verifies a candidate against /health before it is saved', async () => {
    stubFetch(new Response('{}', { status: 200 }), proxyRefusal(), new Response('', { status: 502 }));
    await expect(verifyStagingAccess(TOKEN)).resolves.toBe('ok');
    await expect(verifyStagingAccess(TOKEN)).resolves.toBe('denied');
    await expect(verifyStagingAccess(TOKEN)).resolves.toBe('unreachable');
    expect(calls[0]).toEqual({ url: 'https://api.staging.mator.uz/health',
      headers: { Accept: 'application/json', [STAGING_ACCESS_HEADER]: TOKEN } });
    expect(hasStagingAccess()).toBe(false);
  });

  test('never opens an online payment, and never asks the server for an invoice', async () => {
    await saveStagingAccess(TOKEN);
    const fetch = stubFetch();
    await expect(paymentsTransport.startPayment({ orderId: 'ord_1', provider: 'payme',
      returnUrl: 'mator-staging://payment-return' })).rejects.toMatchObject({ code: 'STAGING_PAYMENTS_DISABLED' });
    expect(fetch).not.toHaveBeenCalled();
  });

  test('the realtime socket carries the proxy token as a handshake header', async () => {
    await saveStagingAccess(TOKEN);
    const opened: unknown[][] = [];
    vi.stubGlobal('WebSocket', class { readyState = 0; constructor(...args: unknown[]) { opened.push(args); } close() {} send() {} });
    const client = new GarageRealtimeClient();
    client.configure({ url: 'wss://api.staging.mator.uz/realtime', getAuthToken: () => 'jwt', userId: 'usr_1' });
    client.start();
    await vi.waitFor(() => expect(opened).toHaveLength(1));
    client.stop();
    expect(opened[0][1]).toEqual(['mator.bearer', 'jwt']);
    expect(opened[0][2]).toEqual({ headers: { [STAGING_ACCESS_HEADER]: TOKEN } });
  });
});
