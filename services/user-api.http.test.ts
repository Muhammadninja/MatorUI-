/**
 * user-api — HTTP transport contract tests (the REAL PATCH /v1/me path).
 *
 * Guards the strict-whitelist contract (verified live on api.mator.uz 2026-07-21):
 * PATCH /v1/me accepts ONLY first_name/last_name/display_name/avatar_url. Sending
 * phone_e164 or email 400s the WHOLE request ("property phone_e164 should not
 * exist"), so the transport must NOT send them. We mock `apiClient` to assert the
 * exact PATCH body.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => true,
}));

const get = vi.fn();
const patch = vi.fn();
const post = vi.fn();
vi.mock('@/services/api-client', () => ({
  apiClient: { get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a), post: (...a: unknown[]) => post(...a) },
}));

import { userTransport } from './user-api';

beforeEach(() => {
  get.mockReset();
  patch.mockReset();
});

const backendUser = {
  id: 'u1',
  phone_e164: '+998901234567',
  first_name: 'Sardor',
  last_name: 'Karimov',
  avatar_url: null,
  created_at: '2024-03-15T00:00:00Z',
};

describe('HttpUserTransport — getMe', () => {
  test('GETs /v1/me and maps the backend user', async () => {
    get.mockResolvedValueOnce(backendUser);
    const me = await userTransport.getMe();
    expect(get.mock.calls[0]![0]).toBe('/v1/me');
    expect(me).toMatchObject({ id: 'u1', firstName: 'Sardor', phone: '+998901234567' });
  });
});

describe('HttpUserTransport — updateMe (PATCH /v1/me)', () => {
  test('sends first_name, last_name, and display_name', async () => {
    patch.mockResolvedValueOnce({ ...backendUser, first_name: 'Sardor', last_name: 'Aliyev' });
    await userTransport.updateMe({ firstName: 'Sardor', lastName: 'Aliyev' });

    const [url, body] = patch.mock.calls[0]!;
    expect(url).toBe('/v1/me');
    expect(body).toEqual({
      first_name: 'Sardor',
      last_name: 'Aliyev',
      display_name: 'Sardor Aliyev',
    });
  });

  test('NEVER sends phone_e164 — backend rejects unknown props with a 400', async () => {
    patch.mockResolvedValueOnce(backendUser);
    await userTransport.updateMe({ phone: '+998 90 111 22 33', firstName: 'Sardor' });
    const [, body] = patch.mock.calls[0]!;
    expect(body).not.toHaveProperty('phone_e164');
    expect(body).not.toHaveProperty('phone');
    expect(body).toHaveProperty('first_name', 'Sardor');
  });

  test('NEVER sends email — backend has no email field (would 400)', async () => {
    patch.mockResolvedValueOnce(backendUser);
    await userTransport.updateMe({ email: 'x@y.com', firstName: 'Sardor' });
    const [, body] = patch.mock.calls[0]!;
    expect(body).not.toHaveProperty('email');
    expect(body).toHaveProperty('first_name', 'Sardor');
  });

  test('a phone/email-only edit sends an empty body (nothing whitelisted to change)', async () => {
    patch.mockResolvedValueOnce(backendUser);
    await userTransport.updateMe({ phone: '+998901112233', email: 'x@y.com' });
    const [, body] = patch.mock.calls[0]!;
    expect(body).toEqual({});
  });

  test('NEVER sends avatar_url — avatar is owned by POST /v1/me/avatar; PATCH 400s on the upload URL', async () => {
    // The avatar is persisted by the upload endpoint; re-sending its Cloudinary
    // URL here hits PATCH's host validator ("avatar_url must be an HTTPS URL on
    // an allowed asset host") and 400s the whole request, failing the name save.
    patch.mockResolvedValueOnce(backendUser);
    await userTransport.updateMe({
      firstName: 'Sardor',
      avatarUrl: 'https://res.cloudinary.com/mator/image/upload/v1/avatars/x.jpg',
    });
    const [, body] = patch.mock.calls[0]!;
    expect(body).not.toHaveProperty('avatar_url');
    expect(body).toHaveProperty('first_name', 'Sardor');
  });
});
