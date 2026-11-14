import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
const environment = vi.hoisted(() => ({ name: 'production', apiBaseUrl: 'https://api.mator.uz',
  httpDomains: '', allowDevOtp: false }));
vi.mock('@/config/environment', () => ({ getAppEnvironment: () => environment, allowLocalDevOtp: () => false, isDedicatedE2EApp: () => false }));
vi.mock('@/services/auth-storage', () => ({ getCurrentSession: () => null }));
import { getApiBaseUrl, shouldUseHttpTransport } from '@/config/api';
import { catalogTransport } from '@/services/catalog-service';
import { searchTransport } from '@/services/search-service';
import { authTransport } from '@/services/auth-api';
import { fetchMakes, fetchModels } from '@/services/reference-catalog';
import { notificationsTransport } from '@/services/notifications-service';

beforeEach(() => {
  vi.stubGlobal('__DEV__', false);
  Object.assign(environment, { name: 'production', apiBaseUrl: 'https://api.mator.uz', httpDomains: '', allowDevOtp: false });
});
afterEach(() => vi.unstubAllGlobals());

test('release enables every real HTTP domain', () => {
  expect(getApiBaseUrl()).toBe('https://api.mator.uz');
  for (const domain of ['auth', 'catalog', 'search', 'garage', 'cart', 'favorites', 'orders', 'chat', 'legal', 'user', 'notifications', 'sales', 'avatar']) {
    expect(shouldUseHttpTransport(domain)).toBe(true);
  }
});
test.each([
  ['staging', 'https://api.staging.mator.uz'],
  ['development', 'https://api.dev.matorui.com'],
])('existing %s release profiles retain their official HTTP endpoints', (name, apiBaseUrl) => {
  Object.assign(environment, { name, apiBaseUrl });
  expect(getApiBaseUrl()).toBe(apiBaseUrl);
});
test.each([
  { apiBaseUrl: '' }, { apiBaseUrl: 'http://localhost:3300' },
  { httpDomains: 'catalog' }, { allowDevOtp: true }, { name: 'local' },
])('release rejects contaminated configuration instead of selecting mocks: %o', (patch) => {
  Object.assign(environment, patch);
  expect(() => shouldUseHttpTransport('cart')).toThrow('Release requires');
});
test('real HTTP 404 remains an error, never a mock catalog/search/auth success', async () => {
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    new Response(JSON.stringify({ message: 'not found' }), { status: 404 }));
  vi.stubGlobal('fetch', fetch);
  await expect(catalogTransport.list({ page: 1, pageSize: 20 })).rejects.toMatchObject({ status: 404 });
  await expect(searchTransport.search({ query: 'unit request' })).rejects.toMatchObject({ status: 404 });
  await expect(authTransport.requestOtp({ channel: 'phone', identifier: 'unit', purpose: 'sign-in', lang: 'ru' }))
    .rejects.toMatchObject({ status: 404 });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fetch.mock.calls.every((call) => String(call[0]).startsWith('https://api.mator.uz/'))).toBe(true);
});
test('a failed reference read stays a failure, never the bundled vehicle catalog', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
  await expect(fetchMakes()).rejects.toMatchObject({ status: 404 });
  await expect(fetchModels('chevrolet')).rejects.toMatchObject({ status: 404 });
});
test('a failed notifications read stays a failure, never an empty mock feed', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
  await expect(notificationsTransport.list()).rejects.toMatchObject({ status: 404 });
});
test('application source never imports a test transport', () => {
  const offenders = execSync(
    `grep -rlE "from '[^']*tests/support|(class|new) Mock[A-Z][a-z]+Transport" app components contexts hooks services config utils --include='*.ts' --include='*.tsx' --exclude='*.test.*' || true`,
    { cwd: join(__dirname, '..'), encoding: 'utf8' },
  ).trim();
  expect(offenders).toBe('');
});
