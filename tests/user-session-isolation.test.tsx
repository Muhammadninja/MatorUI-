import { createElement } from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { beforeEach, expect, test, vi } from 'vitest';

const state = vi.hoisted(() => ({
  session: null as unknown,
  getMe: vi.fn(), updateMe: vi.fn(), verifyOtp: vi.fn(), refresh: vi.fn(),
  load: vi.fn(), save: vi.fn(), clear: vi.fn(), garageSession: vi.fn(), cartSession: vi.fn(),
  handler: null as null | (() => Promise<void>), cache: vi.fn(), cacheRead: vi.fn(),
}));
vi.mock('expo-router', () => ({ router: { replace: vi.fn() } }));
vi.mock('@/services/api-client', () => ({
  setUnauthorizedHandler: (handler: typeof state.handler) => { state.handler = handler; },
  invalidateAuthRequests: vi.fn(), ApiError: class extends Error {},
}));
vi.mock('@/services/garage-service', () => ({ garageService: { setSession: state.garageSession } }));
vi.mock('@/services/cart-api', () => ({ cartTransport: { setSession: state.cartSession } }));
vi.mock('@/services/auth-storage', () => ({
  loadAuthSession: state.load, saveAuthSession: state.save, clearAuthSession: state.clear,
  getCurrentSession: () => state.session,
  setCurrentSession: (session: unknown) => { state.session = session; },
}));
vi.mock('@/services/user-api', () => ({ userTransport: { getMe: state.getMe, updateMe: state.updateMe } }));
vi.mock('@/services/auth-api', () => ({ authTransport: {
  verifyOtp: state.verifyOtp, refresh: state.refresh, signOut: vi.fn(async () => undefined),
} }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: {
  getItem: state.cacheRead, setItem: state.cache, removeItem: state.cache,
} }));
vi.mock('@/services/debug-log', () => ({ debugLog: vi.fn() }));
import { UserProvider, useUserContext } from '@/contexts/user.context';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const user = { id: 'account-a', firstName: 'A', lastName: '', username: 'a', phone: '+998900000001', memberSince: '2026' };
const session = { accessToken: 'synthetic-a', refreshToken: 'synthetic-refresh-a' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
beforeEach(() => {
  vi.clearAllMocks();
  state.session = null;
  state.load.mockReset().mockResolvedValue(session);
  state.getMe.mockReset().mockResolvedValue(user);
  state.updateMe.mockReset(); state.refresh.mockReset(); state.verifyOtp.mockReset();
  state.save.mockReset().mockResolvedValue(undefined);
  state.clear.mockReset().mockResolvedValue(undefined);
  state.cacheRead.mockReset().mockResolvedValue(null);
});
async function renderUser() {
  let value!: ReturnType<typeof useUserContext>;
  function Probe() { value = useUserContext(); return null; }
  let tree!: TestRenderer.ReactTestRenderer;
  await act(async () => { tree = TestRenderer.create(createElement(UserProvider, null, createElement(Probe))); });
  return { get: () => value, unmount: async () => { await act(async () => tree.unmount()); } };
}

test('cold-boot cached owner is available while /me is pending and survives an offline refresh', async () => {
  state.cacheRead.mockResolvedValue(JSON.stringify(user));
  const pending = deferred<typeof user>();
  state.getMe.mockReturnValueOnce(pending.promise);
  const screen = await renderUser();
  expect(screen.get().isHydrating).toBe(true);
  expect(screen.get().profile?.id).toBe(user.id);
  expect(state.session).toEqual(session);
  await act(async () => { pending.reject(new Error('offline')); });
  expect(screen.get().isHydrating).toBe(false);
  expect(screen.get().profile?.id).toBe(user.id);
  expect(state.session).toEqual(session);
  expect(state.clear).not.toHaveBeenCalled();
  await screen.unmount();
});

test('a profile refresh resolving after logout cannot restore the previous account', async () => {
  const screen = await renderUser();
  const pending = deferred<typeof user>();
  state.getMe.mockReturnValueOnce(pending.promise);
  let refresh!: Promise<void>;
  await act(async () => { refresh = screen.get().refreshProfile(); });
  await act(async () => { await screen.get().signOut(); });
  await act(async () => { pending.resolve(user); await refresh; });
  expect(screen.get().profile).toBeNull();
  expect(state.session).toBeNull();
  expect(state.garageSession).toHaveBeenLastCalledWith(null);
  expect(state.cartSession).toHaveBeenLastCalledWith(null);
  await screen.unmount();
});

test.each(['resolve', 'reject'] as const)('late profile update %s cannot undo logout', async (outcome) => {
  const screen = await renderUser();
  const pending = deferred<typeof user>();
  state.updateMe.mockReturnValueOnce(pending.promise);
  let update!: Promise<void>;
  await act(async () => { update = screen.get().updateProfile({ firstName: 'Changed' }); });
  await act(async () => { await screen.get().signOut(); });
  await act(async () => {
    if (outcome === 'resolve') pending.resolve(user);
    else pending.reject(new Error('offline'));
    await update;
  });
  expect(screen.get().profile).toBeNull();
  expect(screen.get().error).toBeNull();
  await screen.unmount();
});

test('token refresh resolving after logout cannot persist its old session', async () => {
  const screen = await renderUser();
  const pending = deferred<{ session: typeof session; user: typeof user }>();
  state.refresh.mockReturnValueOnce(pending.promise);
  let refresh!: Promise<void>;
  await act(async () => { refresh = state.handler!(); });
  await act(async () => { await screen.get().signOut(); });
  await act(async () => { pending.resolve({ session, user }); await refresh; });
  expect(state.save).not.toHaveBeenCalled();
  expect(state.session).toBeNull();
  expect(screen.get().profile).toBeNull();
  await screen.unmount();
});

test('a delayed cold-boot profile response cannot restore a signed-out account', async () => {
  const pending = deferred<typeof user>();
  state.getMe.mockReturnValueOnce(pending.promise);
  const screen = await renderUser();
  await act(async () => { await screen.get().signOut(); });
  await act(async () => { pending.resolve(user); });
  expect(screen.get().profile).toBeNull();
  expect(screen.get().isHydrating).toBe(false);
  await screen.unmount();
});

test('a late token refresh cannot replace a newly signed-in account', async () => {
  const screen = await renderUser();
  const pending = deferred<{ session: typeof session; user: typeof user }>();
  state.refresh.mockReturnValueOnce(pending.promise);
  let refresh!: Promise<void>;
  await act(async () => { refresh = state.handler!(); });
  const nextUser = { ...user, id: 'account-b', firstName: 'B' };
  const nextSession = { accessToken: 'synthetic-b', refreshToken: 'synthetic-refresh-b' };
  state.verifyOtp.mockResolvedValueOnce({ user: nextUser, session: nextSession });
  await act(async () => { await screen.get().verifyOtp({ otpToken: 'local', code: '123456' }); });
  await act(async () => { pending.resolve({ session, user }); await refresh; });
  expect(screen.get().profile?.id).toBe('account-b');
  expect(state.session).toEqual(nextSession);
  expect(state.save).toHaveBeenCalledOnce();
  await screen.unmount();
});

test('logout clears storage after an already-started token persistence finishes', async () => {
  const screen = await renderUser();
  const persistence = deferred<void>();
  state.save.mockReturnValueOnce(persistence.promise);
  state.refresh.mockResolvedValueOnce({ user, session: { ...session, accessToken: 'rotated-a' } });
  let refresh!: Promise<void>;
  await act(async () => { refresh = state.handler!(); });
  expect(state.save).toHaveBeenCalledOnce();
  let logout!: Promise<void>;
  await act(async () => { logout = screen.get().signOut(); });
  expect(state.session).toBeNull();
  expect(screen.get().profile).toBeNull();
  expect(state.clear).not.toHaveBeenCalled();
  await act(async () => { persistence.resolve(); await Promise.all([refresh, logout]); });
  expect(state.clear).toHaveBeenCalledOnce();
  expect(screen.get().profile).toBeNull();
  expect(state.session).toBeNull();
  await screen.unmount();
});
