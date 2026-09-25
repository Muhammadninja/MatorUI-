/**
 * auth-api — legal acceptance on verify-otp.
 *
 * Guards the registration contract: the accepted versions ride along in a
 * `legal` block, they come from the caller (i.e. from GET /v1/legal/documents),
 * and the block is OMITTED when consent wasn't collected so the backend can
 * answer LEGAL_ACCEPTANCE_REQUIRED.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';

vi.mock('@/config/api', () => ({
  getApiBaseUrl: () => 'https://api.test',
  getAuthToken: async () => null,
  shouldUseHttpTransport: () => true,
}));

const get = vi.fn();
const post = vi.fn();
// Declared inside the factory: `vi.mock` is hoisted above module-scope
// declarations, so a class defined out here isn't initialized yet.
vi.mock('@/services/api-client', () => {
  class ApiError extends Error {
    constructor(
      public status: number,
      public code: string,
      message: string,
    ) {
      super(message);
    }
  }
  return {
    apiClient: {
      get: (...a: unknown[]) => get(...a),
      post: (...a: unknown[]) => post(...a),
    },
    ApiError,
  };
});

import { authTransport } from './auth-api';
import { ApiError } from '@/services/api-client';

/** The mocked ApiError constructor, typed for construction in tests. */
const FakeApiError = ApiError as unknown as new (
  status: number,
  code: string,
  message: string,
) => Error;

const verifyResponse = {
  user: { id: 'u1', phone_e164: '+998901234567', created_at: '2024-01-01T00:00:00Z' },
  tokens: { access_token: 'a', refresh_token: 'r' },
};

/** verify-otp needs the phone captured by a preceding request-otp. */
async function seedRequest(): Promise<string> {
  post.mockResolvedValueOnce({ request_id: 'req_1', phone_e164: '+998901234567' });
  const { otpToken } = await authTransport.requestOtp({
    channel: 'phone',
    identifier: '+998901234567',
    purpose: 'sign-in',
    lang: 'en',
  });
  post.mockReset();
  return otpToken;
}

beforeEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('verifyOtp — legal block', () => {
  test('sends the backend-provided versions nested under `legal`', async () => {
    const otpToken = await seedRequest();
    post.mockResolvedValueOnce(verifyResponse);

    await authTransport.verifyOtp({
      otpToken,
      code: '123456',
      legal: {
        terms_version: 3,
        privacy_version: 7,
        personal_data_consent_version: 2,
      },
    });

    const body = post.mock.calls[0]![1] as Record<string, unknown>;
    expect(post.mock.calls[0]![0]).toBe('/v1/auth/phone/verify-otp');
    expect(body).toMatchObject({
      request_id: 'req_1',
      phone_e164: '+998901234567',
      otp_code: '123456',
    });
    // Exactly the versions handed in — not defaults, not incremented.
    expect(body.legal).toEqual({
      terms_version: 3,
      privacy_version: 7,
      personal_data_consent_version: 2,
    });
  });

  test('ALWAYS includes `legal` — no existing-user branch strips it', async () => {
    const otpToken = await seedRequest();
    post.mockResolvedValueOnce(verifyResponse);

    // Same call an EXISTING user's sign-in makes: the versions are still sent.
    // The backend ignores them for a sign-in and requires them for a signup, so
    // the client must never decide to withhold the block.
    await authTransport.verifyOtp({
      otpToken,
      code: '123456',
      legal: {
        terms_version: 1,
        privacy_version: 1,
        personal_data_consent_version: 1,
      },
    });

    const body = post.mock.calls[0]![1] as Record<string, unknown>;
    expect(body.legal).toEqual({
      terms_version: 1,
      privacy_version: 1,
      personal_data_consent_version: 1,
    });
  });

  test('the transport has no is_existing_user branch around `legal`', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    // Strip comments: the code DOCUMENTS that it has no such branch, and the
    // guard is about executable code, not prose.
    const source = readFileSync(join(__dirname, 'auth-api.ts'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    // The field may appear in the request-otp RESPONSE type, but must never
    // gate the verify-otp body.
    const verifyBody = source.slice(
      source.indexOf("'/v1/auth/phone/verify-otp'"),
      source.indexOf('this.phoneByRequest.delete'),
    );
    expect(verifyBody).toContain('legal: input.legal');
    expect(verifyBody).not.toContain('is_existing_user');
    expect(verifyBody).not.toMatch(/\.\.\.\(input\.legal\s*\?/);
  });

  test('all three version fields are integers', async () => {
    const otpToken = await seedRequest();
    post.mockResolvedValueOnce(verifyResponse);

    await authTransport.verifyOtp({
      otpToken,
      code: '123456',
      legal: {
        terms_version: 4,
        privacy_version: 9,
        personal_data_consent_version: 2,
      },
    });

    const legal = (post.mock.calls[0]![1] as { legal: Record<string, number> }).legal;
    // Short payload keys, NOT the document enum values — the contract's
    // deliberate asymmetry.
    expect(Object.keys(legal).sort()).toEqual([
      'personal_data_consent_version',
      'privacy_version',
      'terms_version',
    ]);
    for (const v of Object.values(legal)) {
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  test('propagates LEGAL_ACCEPTANCE_REQUIRED as an ApiError with that code', async () => {
    const otpToken = await seedRequest();
    post.mockRejectedValueOnce(
      new FakeApiError(400, 'LEGAL_ACCEPTANCE_REQUIRED', 'Required legal documents must be accepted.'),
    );

    await expect(
      authTransport.verifyOtp({ otpToken, code: '123456' }),
    ).rejects.toMatchObject({ code: 'LEGAL_ACCEPTANCE_REQUIRED', status: 400 });
  });

  test('a genuine OTP failure keeps its own distinct code', async () => {
    const otpToken = await seedRequest();
    post.mockRejectedValueOnce(new FakeApiError(400, 'INVALID_OTP', 'Invalid code.'));

    await expect(
      authTransport.verifyOtp({ otpToken, code: '000000' }),
    ).rejects.toMatchObject({ code: 'INVALID_OTP' });
  });
});
