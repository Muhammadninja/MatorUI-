/**
 * auth-api — mock transport behavior tests.
 *
 * The mock impl is intentionally deterministic-shaped (random ids, but
 * predictable structure) so the auth context can integrate against it
 * end-to-end. These tests pin that shape so future refactors don't
 * silently drift away from the AuthResult contract the context expects.
 */
import { describe, expect, test } from 'vitest';

// Pin to mock impl by ensuring shouldUseHttpTransport returns false.
vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => null,
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => false,
}));

import { vi } from 'vitest';
import { authTransport } from './auth-api';

describe('auth-api mock', () => {
  test('signIn returns session + user with stable shape', async () => {
    const result = await authTransport.signIn({
      email: 'a@b.com',
      password: 'pw',
    });

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

  test('signUp echoes provided firstName / lastName into the user', async () => {
    const result = await authTransport.signUp({
      email: 'c@d.com',
      password: 'pw',
      firstName: 'Casey',
      lastName: 'Doe',
    });
    expect(result.user.firstName).toBe('Casey');
    expect(result.user.lastName).toBe('Doe');
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
    const result = await authTransport.signIn({ email: 'a@b.com', password: 'pw' });
    expect(result.session.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });
});
