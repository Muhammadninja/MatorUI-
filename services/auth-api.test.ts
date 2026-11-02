/**
 * auth-api — mock transport behavior tests (passwordless OTP).
 *
 * The mock impl is intentionally deterministic-shaped (random ids, but
 * predictable structure) so the auth context can integrate against it
 * end-to-end. These tests pin that shape so future refactors don't
 * silently drift away from the AuthResult contract the context expects.
 */
import { describe, expect, test } from 'vitest';

vi.mock('@/config/environment', () => ({ allowLocalDevOtp: () => false }));

// Pin to mock impl by ensuring shouldUseHttpTransport returns false.
vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => null,
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => false,
}));

import { vi } from 'vitest';
import { authTransport } from './auth-api';

describe('auth-api mock (OTP)', () => {
  test('requestOtp returns a token + devCode for demo builds', async () => {
    const result = await authTransport.requestOtp({
      channel: 'phone',
      identifier: '+998901234567',
      purpose: 'sign-in',
      lang: 'en',
    });
    expect(result.otpToken).toMatch(/^otp_/);
    expect(result.expiresIn).toBeGreaterThan(0);
    expect(result.devCode).toMatch(/^\d{6}$/);
  });

  test('verifyOtp with a valid code returns session + user with stable shape', async () => {
    const { otpToken, devCode } = await authTransport.requestOtp({
      channel: 'email',
      identifier: 'a@b.com',
      purpose: 'sign-in',
      lang: 'en',
    });
    const result = await authTransport.verifyOtp({ otpToken, code: devCode! });
    expect(result).toMatchObject({
      session: {
        accessToken: expect.stringMatching(/^mock_access_/),
        refreshToken: expect.stringMatching(/^mock_refresh_/),
        expiresAt: expect.any(Number),
      },
      user: {
        id: expect.stringMatching(/^usr_/),
        email: 'a@b.com',
        firstName: expect.any(String),
        lastName: expect.any(String),
        username: 'a',
        avatarUrl: null,
        memberSince: expect.any(String),
      },
    });
  });

  test('verifyOtp echoes the sign-up name into the user', async () => {
    const { otpToken, devCode } = await authTransport.requestOtp({
      channel: 'email',
      identifier: 'c@d.com',
      purpose: 'sign-up',
      lang: 'en',
      firstName: 'Casey',
      lastName: 'Doe',
    });
    const result = await authTransport.verifyOtp({ otpToken, code: devCode! });
    expect(result.user.firstName).toBe('Casey');
    expect(result.user.lastName).toBe('Doe');
  });

  test('verifyOtp rejects a non-6-digit code', async () => {
    const { otpToken } = await authTransport.requestOtp({
      channel: 'phone',
      identifier: '+998901234567',
      purpose: 'sign-in',
      lang: 'en',
    });
    await expect(authTransport.verifyOtp({ otpToken, code: '12' })).rejects.toThrow();
  });

  test('refresh returns a fresh session (mock never fails)', async () => {
    const result = await authTransport.refresh('any-refresh-token');
    expect(result).not.toBeNull();
    expect(result?.session.accessToken).toMatch(/^mock_access_/);
  });

  test('signOut resolves without throwing', async () => {
    await expect(authTransport.signOut('any-refresh-token')).resolves.toBeUndefined();
  });

  test('expiresAt is in the future', async () => {
    const { otpToken, devCode } = await authTransport.requestOtp({
      channel: 'phone',
      identifier: '+998901234567',
      purpose: 'sign-in',
      lang: 'en',
    });
    const result = await authTransport.verifyOtp({ otpToken, code: devCode! });
    expect(result.session.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
