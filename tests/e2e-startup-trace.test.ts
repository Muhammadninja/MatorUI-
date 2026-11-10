import { afterEach, expect, test, vi } from 'vitest';
const state = vi.hoisted(() => ({ dedicated: false }));
vi.mock('@/config/environment', () => ({ isDedicatedE2EApp: () => state.dedicated }));
import { traceStartup, traceStartupLink, traceStartupRoutes } from '@/services/e2e-startup-trace';
afterEach(() => { vi.restoreAllMocks(); state.dedicated = false; });

test('ordinary/production apps cannot emit startup diagnostics', () => {
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  traceStartup('index-gate', { chosen: false });
  traceStartupRoutes({ routes: [{ name: 'sign-in' }] });
  traceStartupLink('mator-e2e://sign-in');
  expect(log).not.toHaveBeenCalled();
});

test('dedicated diagnostics omit params, unknown route names and URL queries', () => {
  state.dedicated = true;
  const log = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  traceStartupRoutes({ index: 1, routes: [{ name: 'ignored' }, { name: '(auth)',
    params: { token: 'PRIVATE_TOKEN' }, state: { routes: [{ name: 'select-language', params: { phone: 'PRIVATE_PHONE' } }] } }] });
  traceStartupRoutes({ routes: [{ name: 'PRIVATE_ROUTE' }] });
  traceStartupLink('mator-e2e://sign-in?token=PRIVATE_TOKEN');
  traceStartupLink('https://private.invalid/PRIVATE_PATH?phone=PRIVATE_PHONE');
  traceStartup('auth-language', { hydrating: true, session: false,
    unsupported: 'PRIVATE_STRING' as never });
  const output = JSON.stringify(log.mock.calls);
  expect(output).toContain('(auth) > select-language');
  expect(output).toContain('sign-in');
  expect(output).toContain('other');
  expect(output).not.toContain('PRIVATE');
  expect(output).not.toContain('token=');
});
