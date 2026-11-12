// Test-only implementations. Never imported by application code.
import { apiClient, ApiError } from '@/services/api-client';
import { debugLog } from '@/services/debug-log';
import { allowLocalDevOtp } from '@/config/environment';
import type { AuthSession } from '@/services/auth-storage';
import type { LanguageCode } from '@/services/language-storage';
import type { LegalRegistrationVersions } from '@/types/legal';
import { shouldUseHttpTransport } from '@/config/api';

import type { UserSummary, OtpChannel, OtpPurpose, RequestOtpInput, RequestOtpResult, VerifyOtpInput, AuthResult, AuthTransport } from "@/services/auth-api";

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

export class MockAuthTransport implements AuthTransport {
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
