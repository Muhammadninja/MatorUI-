/**
 * auth-api — HTTP transport contract tests (the REAL backend path).
 *
 * The mock tests (auth-api.test.ts) pin the shape the context integrates
 * against; these pin the WIRE CONTRACT against api.mator.uz so the only
 * remaining unknown before release is SMS delivery on the backend. We mock
 * `apiClient` so each endpoint's request/response is a controlled input and
 * assert the exact URL + payload the backend expects (backend.json §Auth*).
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

// Force the HTTP transport singleton (not the mock) at module load.
vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => true,
}));

// Controlled apiClient — we assert the calls the transport makes. We keep the
// REAL `ApiError` export (via importOriginal) so the transport's
// `err instanceof ApiError` status check works against realistic rejections.
const post = vi.fn();
const get = vi.fn();
const patch = vi.fn();
vi.mock('@/services/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/api-client')>();
  return {
    ...actual,
    apiClient: { post: (...a: unknown[]) => post(...a), get: (...a: unknown[]) => get(...a), patch: (...a: unknown[]) => patch(...a) },
  };
});

import { ApiError } from '@/services/api-client';
import { authTransport, mapBackendUser } from './auth-api';

beforeEach(() => {
  post.mockReset();
  get.mockReset();
  patch.mockReset();
});

// A representative verify-otp response straight from backend.json.
function verifyResponse() {
  return {
    user: {
      id: '9a8e1d2c-4b7f-4d3e-8c2a-1f0e2b6c9d4a',
      phone_e164: '+998901234567',
      display_name: null,
      avatar_url: null,
      created_at: '2026-06-11T14:30:11.412Z',
    },
    tokens: {
      access_token: 'access.jwt.value',
      access_token_expires_at: '2026-06-11T15:30:11.000Z',
      refresh_token: 'rt_01HXC3KAB7P5N4LK9N1ZAC3X8U',
      refresh_token_expires_at: '2026-09-09T14:30:11.000Z',
      token_type: 'Bearer',
    },
  };
}

describe('HttpAuthTransport — request-otp', () => {
  test('normalizes phone to E.164 and posts the backend contract payload', async () => {
    post.mockResolvedValueOnce({
      request_id: 'otp_ABC',
      phone_e164: '+998901234567',
      expires_at: '2999-01-01T00:00:00.000Z',
      resend_after_seconds: 60,
    });

    const res = await authTransport.requestOtp({
      channel: 'phone',
      identifier: '+998 90 123 45 67', // spaces stripped
      purpose: 'sign-in',
      lang: 'ru',
    });

    const [url, body, opts] = post.mock.calls[0]!;
    expect(url).toBe('/v1/auth/phone/request-otp');
    expect(body).toEqual({
      phone_e164: '+998901234567',
      country_iso2: 'UZ',
      channel: 'sms',
      lang: 'ru',
    });
    expect(opts).toMatchObject({ skipAuth: true }); // no token yet → must not 401
    expect(res.otpToken).toBe('otp_ABC');
    expect(res.expiresIn).toBeGreaterThan(0);
  });

  // Regression: a Russian user got the SMS in Uzbek. RequestOtpDto.lang is the
  // ONLY input the backend reads for the SMS language (request-otp ignores
  // Accept-Language) and it falls back to `uz` when the field is absent — so
  // the chosen language must be on the wire for every supported language.
  test.each(['ru', 'uz', 'en'] as const)('sends lang=%s as the SMS language', async (lang) => {
    post.mockResolvedValueOnce({ request_id: 'otp_L' });
    await authTransport.requestOtp({
      channel: 'phone',
      identifier: '+998901234567',
      purpose: 'sign-in',
      lang,
    });
    expect(post.mock.calls[0]![1]).toMatchObject({ lang });
  });

  test.each([
    ['+998 90 123 45 67', '+998901234567'],
    ['998901234567', '+998901234567'],
    ['901234567', '+998901234567'], // bare 9-digit local number (no +998)
    ['0901234567', '+998901234567'], // trunk-prefixed local number
  ])('normalizes %s → %s', async (input, expected) => {
    post.mockResolvedValueOnce({ request_id: 'otp_N' });
    await authTransport.requestOtp({ channel: 'phone', identifier: input, purpose: 'sign-in', lang: 'en' });
    expect(post.mock.calls[0]![1]).toMatchObject({ phone_e164: expected });
  });

  test('falls back to resend_after_seconds when expires_at is absent', async () => {
    post.mockResolvedValueOnce({ request_id: 'otp_X', resend_after_seconds: 45 });
    const res = await authTransport.requestOtp({
      channel: 'phone',
      identifier: '+998901112233',
      purpose: 'sign-in',
      lang: 'en',
    });
    expect(res.expiresIn).toBe(45);
  });

  test('surfaces dev_otp_code as devCode (undefined on a real backend)', async () => {
    post.mockResolvedValueOnce({ request_id: 'otp_Y', dev_otp_code: '424242' });
    const res = await authTransport.requestOtp({
      channel: 'phone',
      identifier: '+998901112233',
      purpose: 'sign-in',
      lang: 'en',
    });
    expect(res.devCode).toBe('424242');
  });
});

describe('HttpAuthTransport — verify-otp', () => {
  test('sends request_id + phone + code and maps { user, tokens }', async () => {
    post.mockResolvedValueOnce({ request_id: 'otp_R', phone_e164: '+998901234567' });
    const { otpToken } = await authTransport.requestOtp({
      channel: 'phone',
      identifier: '+998 90 123 45 67',
      purpose: 'sign-in',
      lang: 'en',
    });

    post.mockResolvedValueOnce(verifyResponse());
    const result = await authTransport.verifyOtp({ otpToken, code: '483917' });

    const [url, body, opts] = post.mock.calls[1]!;
    expect(url).toBe('/v1/auth/phone/verify-otp');
    // phone_e164 must be the one remembered from request-otp.
    expect(body).toEqual({ request_id: 'otp_R', phone_e164: '+998901234567', otp_code: '483917' });
    expect(opts).toMatchObject({ skipAuth: true });

    expect(result.session.accessToken).toBe('access.jwt.value');
    expect(result.session.refreshToken).toBe('rt_01HXC3KAB7P5N4LK9N1ZAC3X8U');
    expect(result.session.expiresAt).toBeGreaterThan(0);
    expect(result.user.id).toBe('9a8e1d2c-4b7f-4d3e-8c2a-1f0e2b6c9d4a');
    expect(result.user.phone).toBe('+998901234567');
  });
});

describe('HttpAuthTransport — refresh', () => {
  test('returns a fresh session on success', async () => {
    post.mockResolvedValueOnce({ tokens: verifyResponse().tokens });
    const result = await authTransport.refresh('rt_valid');
    expect(post.mock.calls[0]![0]).toBe('/v1/auth/token/refresh');
    expect(post.mock.calls[0]![1]).toEqual({ refresh_token: 'rt_valid' });
    expect(result?.session.accessToken).toBe('access.jwt.value');
  });

  test('returns null when the refresh token is rejected (so context signs out)', async () => {
    post.mockRejectedValueOnce(new ApiError(401, 'invalid_grant', '401 invalid_grant'));
    const result = await authTransport.refresh('rt_expired');
    expect(result).toBeNull();
  });
});

describe('mapBackendUser — tolerant wire mapping', () => {
  test('maps snake_case /v1/me shape', () => {
    const u = mapBackendUser({
      id: 'u1',
      phone_e164: '+998901234567',
      first_name: 'Sardor',
      last_name: 'Karimov',
      avatar_url: 'https://cdn/x.webp',
      created_at: '2024-03-15T00:00:00Z',
    });
    expect(u).toMatchObject({
      id: 'u1',
      firstName: 'Sardor',
      lastName: 'Karimov',
      phone: '+998901234567',
      avatarUrl: 'https://cdn/x.webp',
      memberSince: '2024-03-15T00:00:00Z',
    });
  });

  test('accepts the camelCase variant from /v1/auth/me', () => {
    const u = mapBackendUser({ id: 'u2', phoneE164: '+998900000000', firstName: 'A', lastName: 'B', avatarUrl: null });
    expect(u.phone).toBe('+998900000000');
    expect(u.firstName).toBe('A');
    expect(u.lastName).toBe('B');
  });

  test('splits legacy display_name when first/last are absent', () => {
    const u = mapBackendUser({ id: 'u3', display_name: 'Bobur Toshpolatov' });
    expect(u.firstName).toBe('Bobur');
    expect(u.lastName).toBe('Toshpolatov');
  });

  test('a brand-new user with a null name maps to empty strings, not "null"', () => {
    const u = mapBackendUser({ id: 'u4', phone_e164: '+998901234567', display_name: null });
    expect(u.firstName).toBe('');
    expect(u.lastName).toBe('');
    // username falls back to the phone so the UI never shows a blank handle.
    expect(u.username).toBe('+998901234567');
  });
});

// Refresh must tolerate ANY plausible token shape — a mismatch here used to
// return null → the 401 handler signed the user out on every launch.
describe('HttpAuthTransport — refresh (shape tolerance regression)', () => {
  test('nested snake: { tokens: { access_token, refresh_token } }', async () => {
    post.mockResolvedValueOnce({ tokens: { access_token: 'A', refresh_token: 'R' } });
    const r = await authTransport.refresh('old');
    expect(r?.session).toMatchObject({ accessToken: 'A', refreshToken: 'R' });
  });

  test('flat snake: { access_token, refresh_token }', async () => {
    post.mockResolvedValueOnce({ access_token: 'A2', refresh_token: 'R2' });
    const r = await authTransport.refresh('old');
    expect(r?.session).toMatchObject({ accessToken: 'A2', refreshToken: 'R2' });
  });

  test('flat camel: { accessToken, refreshToken }', async () => {
    post.mockResolvedValueOnce({ accessToken: 'A3', refreshToken: 'R3' });
    const r = await authTransport.refresh('old');
    expect(r?.session).toMatchObject({ accessToken: 'A3', refreshToken: 'R3' });
  });

  test('access-only response (no rotation) keeps the current refresh token', async () => {
    post.mockResolvedValueOnce({ access_token: 'A4' });
    const r = await authTransport.refresh('old-refresh');
    expect(r?.session).toMatchObject({ accessToken: 'A4', refreshToken: 'old-refresh' });
  });

  test('a 2xx response with no access token → throws (backend bug is transient, keep session)', async () => {
    post.mockResolvedValueOnce({ message: 'nope' });
    await expect(authTransport.refresh('old')).rejects.toThrow();
  });

  test('a 401 ApiError → null (definitive rejection → caller signs out)', async () => {
    post.mockRejectedValueOnce(new ApiError(401, 'UNAUTHORIZED', 'Unauthorized'));
    expect(await authTransport.refresh('old')).toBeNull();
  });

  test('a 403 ApiError → null (definitive rejection)', async () => {
    post.mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Forbidden'));
    expect(await authTransport.refresh('old')).toBeNull();
  });

  test('a network/5xx error → throws (transient, keep session and retry)', async () => {
    post.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'));
    await expect(authTransport.refresh('old')).rejects.toThrow();
    post.mockRejectedValueOnce(new ApiError(503, 'HTTP_503', 'unavailable'));
    await expect(authTransport.refresh('old')).rejects.toThrow();
  });
});
