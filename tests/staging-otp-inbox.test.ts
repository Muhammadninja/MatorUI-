// The staging-only "Get test code" lookup: it reads the calling tester's inbox
// through the staging proxy header the device already has, never sends the app
// session, never runs outside staging, and never logs the code.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const environment = vi.hoisted(() => ({ name: 'staging', apiBaseUrl: 'https://api.staging.mator.uz',
  httpDomains: '', allowDevOtp: false }));
vi.mock('@/config/environment', () => ({ getAppEnvironment: () => environment, allowLocalDevOtp: () => false,
  isDedicatedE2EApp: () => false }));
vi.mock('@/services/auth-storage', () => ({
  getCurrentSession: () => ({ accessToken: 'jwt.access.token', refreshToken: 'refresh' }),
}));

import * as SecureStore from 'expo-secure-store';

import { loadStagingAccess, saveStagingAccess } from '@/services/staging-access';
import { fetchStagingOtpCode } from '@/services/staging-otp-inbox';

const TOKEN = 'b'.repeat(64);
type Call = { url: string; headers: Record<string, string> };
const calls: Call[] = [];
function stubFetch(response: Response) {
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), headers: { ...(init?.headers as Record<string, string>) } });
    return response;
  }));
}
const inbox = (items: unknown[]) => new Response(JSON.stringify({ items }), { status: 200 });

beforeEach(async () => {
  vi.stubGlobal('__DEV__', true);
  calls.length = 0;
  (SecureStore as unknown as { __resetSecureStore(): void }).__resetSecureStore();
  Object.assign(environment, { name: 'staging', apiBaseUrl: 'https://api.staging.mator.uz' });
  await loadStagingAccess();
  await saveStagingAccess(TOKEN);
});
afterEach(() => vi.unstubAllGlobals());

describe('fetchStagingOtpCode', () => {
  test('returns the code for this request, via the tester header and no app session', async () => {
    stubFetch(inbox([
      { request_id: 'other', code: '111111' },
      { request_id: 'req-1', code: '483917', phone: '+998901234567' },
    ]));
    await expect(fetchStagingOtpCode('req-1')).resolves.toEqual({ status: 'found', code: '483917' });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://api.staging.mator.uz/v1/staging/otp/inbox');
    expect(calls[0].headers['X-Mator-Staging-Access']).toBe(TOKEN);
    expect(calls[0].headers.Authorization).toBeUndefined();
  });

  test('another request, an empty inbox or a malformed code is "none"', async () => {
    stubFetch(inbox([{ request_id: 'other', code: '111111' }]));
    await expect(fetchStagingOtpCode('req-1')).resolves.toEqual({ status: 'none' });
    stubFetch(inbox([]));
    await expect(fetchStagingOtpCode('req-1')).resolves.toEqual({ status: 'none' });
    stubFetch(inbox([{ request_id: 'req-1', code: '<script>' }]));
    await expect(fetchStagingOtpCode('req-1')).resolves.toEqual({ status: 'none' });
  });

  test('a 404 (not a tester, or the inbox is off) is "unavailable"', async () => {
    stubFetch(new Response('{"code":"NOT_FOUND"}', { status: 404 }));
    await expect(fetchStagingOtpCode('req-1')).resolves.toEqual({ status: 'unavailable' });
  });

  test('outside staging it makes no request at all', async () => {
    Object.assign(environment, { name: 'production', apiBaseUrl: 'https://api.mator.uz' });
    stubFetch(inbox([{ request_id: 'req-1', code: '483917' }]));
    await expect(fetchStagingOtpCode('req-1')).resolves.toEqual({ status: 'unavailable' });
    expect(calls).toHaveLength(0);
  });

  test('the code never reaches the console, even with API debug logging on', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    stubFetch(inbox([{ request_id: 'req-1', code: '483917' }]));
    await fetchStagingOtpCode('req-1');
    const printed = JSON.stringify([...log.mock.calls, ...warn.mock.calls]);
    expect(printed).not.toContain('483917');
    expect(printed).not.toContain(TOKEN);
    log.mockRestore();
    warn.mockRestore();
  });
});
