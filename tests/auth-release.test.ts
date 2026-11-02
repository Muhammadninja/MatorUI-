import { afterEach, expect, test, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/config/api', () => ({ shouldUseHttpTransport: () => false }));
vi.mock('expo-constants', () => ({ default: {
  expoConfig: { extra: { appEnvironment: { name: 'local', apiBaseUrl: 'http://127.0.0.1:3300',
    httpDomains: '', allowDevOtp: true } } },
} }));
vi.mock('@/services/api-client', () => ({
  apiClient: { post }, ApiError: class ApiError extends Error {},
}));

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

test('release forces server auth and ignores OTP echo even with a contaminated dev manifest and disabled HTTP gate', async () => {
  vi.stubGlobal('__DEV__', false);
  post.mockResolvedValueOnce({ request_id: 'real-request', dev_otp_code: '123456' });
  const { authTransport } = await import('@/services/auth-api');
  const result = await authTransport.requestOtp({ channel: 'phone', identifier: '+998900000001',
    purpose: 'sign-in', lang: 'ru' });
  expect(post).toHaveBeenCalledWith('/v1/auth/phone/request-otp', expect.any(Object), expect.any(Object));
  expect(result.otpToken).toBe('real-request');
  expect(result.devCode).toBeUndefined();
});
