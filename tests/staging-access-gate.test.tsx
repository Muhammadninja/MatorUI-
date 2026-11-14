// The token screen covers a staging build until the proxy accepts a token,
// and never appears in any other build.
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
}));
const environment = vi.hoisted(() => ({ name: 'staging', apiBaseUrl: 'https://api.staging.mator.uz',
  httpDomains: '', allowDevOtp: false }));

vi.mock('@/config/environment', () => ({ getAppEnvironment: () => environment }));
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 59, bottom: 34 }) }));
vi.mock('react-native', () => ({ TextInput: host('text-input'), StyleSheet: { absoluteFill: {} } }));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ scheme: 'light', tokens: new Proxy({}, { get: (_t, k) => `#${String(k)}` }) }),
}));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('app-text') }));
vi.mock('@/components/shared/app-view', () => ({ AppView: host('app-view') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('app-button') }));

import * as SecureStore from 'expo-secure-store';

import { StagingAccessGate } from '@/components/shared/staging-access-gate';
import { hasStagingAccess, loadStagingAccess } from '@/services/staging-access';

const TOKEN = 'f'.repeat(64);
let tree: ReactTestRenderer;
const find = (testID: string) => tree.root.findAll((n) => n.props.testID === testID && typeof n.type === 'string');
const render = () => act(() => { tree = create(<StagingAccessGate />); });

beforeEach(async () => {
  (SecureStore as unknown as { __resetSecureStore(): void }).__resetSecureStore();
  environment.name = 'staging';
  await loadStagingAccess();
});
afterEach(() => { act(() => tree?.unmount()); vi.unstubAllGlobals(); });

test('renders nothing outside staging', () => {
  environment.name = 'production';
  render();
  expect(tree.toJSON()).toBeNull();
});

test('a refused token keeps the screen up with an explanation', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Mator Staging"' } })));
  render();
  await act(async () => { find('staging-access-input')[0].props.onChangeText(TOKEN); });
  await act(async () => { await find('staging-access-submit')[0].props.onPress(); });
  expect(find('staging-access-error')[0].props.children).toMatch(/refused/);
  expect(hasStagingAccess()).toBe(false);
});

test('a malformed token is rejected without a network call', async () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  render();
  await act(async () => { find('staging-access-input')[0].props.onChangeText('mator-tester:password'); });
  await act(async () => { await find('staging-access-submit')[0].props.onPress(); });
  expect(fetch).not.toHaveBeenCalled();
  expect(find('staging-access-error')).toHaveLength(1);
});

test('an accepted token is saved and the screen goes away', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })));
  render();
  expect(find('staging-access-gate')).toHaveLength(1);
  await act(async () => { find('staging-access-input')[0].props.onChangeText(TOKEN); });
  await act(async () => { await find('staging-access-submit')[0].props.onPress(); });
  expect(hasStagingAccess()).toBe(true);
  expect(tree.toJSON()).toBeNull();
  expect(await SecureStore.getItemAsync('mator_staging_access_v1')).toBe(TOKEN);
});
