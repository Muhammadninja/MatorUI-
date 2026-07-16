/**
 * Auth transport — passwordless OTP: request-code / verify-code / refresh / sign-out.
 *
 * Same shape as the other transports: an interface, a Mock impl that fakes the
 * round-trip, an HTTP impl that calls real endpoints through the unified
 * `apiClient`. The auth flow never goes through `apiClient` for request/verify
 * (no token yet) — we use `skipAuth: true` so the endpoints don't 401 the
 * bootstrap call.
 *
 * Backend contract assumed:
 *   POST /v1/auth/otp/request  { channel, identifier, purpose, firstName?, lastName? }
 *                                → { otpToken, expiresIn, devCode? }
 *   POST /v1/auth/otp/verify   { otpToken, code }   → AuthResult
 *   POST /v1/auth/refresh      { refreshToken }     → AuthResult
 *   POST /v1/auth/sign-out     { refreshToken }     → 204
 *
 * AuthResult = { accessToken, refreshToken, expiresIn?, user }
 *
 * `devCode` is a DEV/DEMO convenience: the mock transport (and the offline mock
 * server) return the just-generated code so demo/E2E builds can auto-fill it.
 * A real backend must NOT return it — the screen falls back to manual entry.
 */

import { apiClient } from '@/services/api-client';
import type { AuthSession } from '@/services/auth-storage';

export type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  phone?: string | null;
  avatarUrl?: string | null;
  memberSince: string;
};

/** Which identifier the one-time code is sent to. Phone is the default. */
export type OtpChannel = 'phone' | 'email';
export type OtpPurpose = 'sign-in' | 'sign-up';

export type RequestOtpInput = {
  channel: OtpChannel;
  /** E.164 phone (e.g. +998901234567) or an email address. */
  identifier: string;
  purpose: OtpPurpose;
  /** Sign-up only — captured up front so verify can create the profile. */
  firstName?: string;
  lastName?: string;
};

export type RequestOtpResult = {
  /** Opaque handle tying the later verify call back to this request. */
  otpToken: string;
  /** Seconds until the code expires. */
  expiresIn: number;
  /** DEV/DEMO ONLY — the code, so mock builds can auto-fill it. Real backends omit this. */
  devCode?: string;
};

export type VerifyOtpInput = { otpToken: string; code: string };

export type AuthResult = {
  session: AuthSession;
  user: UserSummary;
};

export interface AuthTransport {
  /** Sends a one-time code to the phone/email and returns a handle for verify. */
  requestOtp(input: RequestOtpInput, signal?: AbortSignal): Promise<RequestOtpResult>;
  /** Exchanges a valid code for a session + user. Throws on an invalid/expired code. */
  verifyOtp(input: VerifyOtpInput, signal?: AbortSignal): Promise<AuthResult>;
  /** Exchanges the current refresh token for a fresh access + refresh pair.
   *  Returns `null` when the refresh token is invalid/expired — callers should
   *  sign the user out in that case. */
  refresh(refreshToken: string, signal?: AbortSignal): Promise<AuthResult | null>;
  signOut(refreshToken: string, signal?: AbortSignal): Promise<void>;
}

// ── Mock transport ─────────────────────────────────────────────────────

/** DEV/DEMO fixed code — accepted by the mock verify and auto-filled by screens. */
const MOCK_DEV_CODE = '123456';

/**
 * DEV/DEMO test account — the identity a mock/offline login resolves to, so the
 * app opens on a coherent, named profile (matches `user-api`'s seed). Remove once
 * the real backend + auth are wired. Log in with the pre-filled phone below
 * (any 6-digit code works).
 */
export const TEST_USER = {
  id: 'usr_test_001',
  firstName: 'Sardor',
  lastName: 'Karimov',
  username: 'sardor',
  email: 'test@mator.uz',
  phone: '+998 90 123 45 67',
  avatarUrl: null,
  memberSince: '2024-03-15T00:00:00Z',
} as const;

type PendingOtp = RequestOtpInput & { code: string };

class MockAuthTransport implements AuthTransport {
  /** In-memory pending requests, keyed by the token handed back to the caller. */
  private pending = new Map<string, PendingOtp>();

  async requestOtp(input: RequestOtpInput): Promise<RequestOtpResult> {
    await delay(400);
    const otpToken = `otp_${Math.random().toString(36).slice(2, 12)}`;
    this.pending.set(otpToken, { ...input, code: MOCK_DEV_CODE });
    return { otpToken, expiresIn: 300, devCode: MOCK_DEV_CODE };
  }

  async verifyOtp(input: VerifyOtpInput): Promise<AuthResult> {
    await delay(400);
    const req = this.pending.get(input.otpToken);
    if (!isValidCode(input.code)) {
      throw new Error('Enter the 6-digit code we sent you.');
    }
    this.pending.delete(input.otpToken);
    return buildMockResult(req);
  }

  async refresh(): Promise<AuthResult | null> {
    await delay(150);
    return buildMockResult(undefined);
  }

  async signOut(): Promise<void> {
    await delay(150);
  }
}

/** Accepts any 6-digit numeric code in mock/demo builds. */
function isValidCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}

function buildMockResult(req?: PendingOtp): AuthResult {
  const id = `usr_${Math.random().toString(36).slice(2, 10)}`;
  const accessToken = `mock_access_${id}`;
  const refreshToken = `mock_refresh_${id}`;
  const isEmail = req?.channel === 'email';
  const identifier = req?.identifier ?? '';
  // Derive contact fields from what the user actually entered (so tests/flows
  // that assert on the identifier still hold), but fall back to the named
  // TEST_USER so a bare sign-in opens on a coherent profile instead of "New User".
  const email = isEmail ? identifier : TEST_USER.email;
  const phone = req?.channel === 'phone' ? identifier : TEST_USER.phone;
  const username = (isEmail ? identifier.split('@')[0] : TEST_USER.username) || TEST_USER.username;
  return {
    session: {
      accessToken,
      refreshToken,
      // 1h from now — mock token lifetime.
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    },
    user: {
      id,
      email,
      phone,
      firstName: req?.firstName || TEST_USER.firstName,
      lastName: req?.lastName || TEST_USER.lastName,
      username,
      avatarUrl: null,
      memberSince: TEST_USER.memberSince,
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── HTTP transport ─────────────────────────────────────────────────────

type RawRequestOtpResponse = {
  otpToken: string;
  expiresIn: number;
  devCode?: string;
};

type RawAuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number; // seconds
  user: UserSummary;
};

class HttpAuthTransport implements AuthTransport {
  async requestOtp(input: RequestOtpInput, signal?: AbortSignal): Promise<RequestOtpResult> {
    return apiClient.post<RawRequestOtpResponse>('/v1/auth/otp/request', input, {
      signal,
      skipAuth: true,
    });
  }

  async verifyOtp(input: VerifyOtpInput, signal?: AbortSignal): Promise<AuthResult> {
    const r = await apiClient.post<RawAuthResponse>('/v1/auth/otp/verify', input, {
      signal,
      skipAuth: true,
    });
    return toResult(r);
  }

  async refresh(refreshToken: string, signal?: AbortSignal): Promise<AuthResult | null> {
    try {
      const r = await apiClient.post<RawAuthResponse>(
        '/v1/auth/refresh',
        { refreshToken },
        { signal, skipAuth: true, maxRetries: 0 },
      );
      return toResult(r);
    } catch {
      // A 401/400 on refresh means the refresh token itself is no longer
      // valid. Return null so the auth context signs the user out.
      return null;
    }
  }

  async signOut(refreshToken: string, signal?: AbortSignal): Promise<void> {
    await apiClient.post('/v1/auth/sign-out', { refreshToken }, { signal });
  }
}

function toResult(r: RawAuthResponse): AuthResult {
  return {
    session: {
      accessToken: r.accessToken,
      refreshToken: r.refreshToken,
      expiresAt:
        r.expiresIn !== undefined
          ? Math.floor(Date.now() / 1000) + r.expiresIn
          : undefined,
    },
    user: r.user,
  };
}

// ── Singleton ──────────────────────────────────────────────────────────

import { shouldUseHttpTransport } from '@/config/api';

export const authTransport: AuthTransport = shouldUseHttpTransport('auth')
  ? new HttpAuthTransport()
  : new MockAuthTransport();
