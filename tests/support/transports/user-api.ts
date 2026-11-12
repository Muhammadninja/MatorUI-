// Test-only user transport; never imported by application code.
import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';
import { mapBackendUser, type RawBackendUser, type UserSummary } from '@/services/auth-api';
import type { AuthSession } from '@/services/auth-storage';
import { debugLog } from '@/services/debug-log';

import type { UserTransport, UserPatch, PhoneChangeRequest, PhoneChangeResult } from "@/services/user-api";
// ── Mock transport ─────────────────────────────────────────────────────
//
// Starts EMPTY — never fabricates a fake identity. Real profile data comes
// from the auth session (verify/refresh) or the live `/v1/me` (HTTP transport).
// So on mock the screen shows the honest empty state, never a placeholder user.

const EMPTY_PROFILE: UserSummary = {
  id: '',
  firstName: '',
  lastName: '',
  email: '',
  username: '',
  phone: null,
  avatarUrl: null,
  memberSince: '',
};

export class MockUserTransport implements UserTransport {
  private state: UserSummary = { ...EMPTY_PROFILE };

  async getMe(): Promise<UserSummary> {
    await delay(200);
    return { ...this.state };
  }

  async updateMe(patch: UserPatch): Promise<UserSummary> {
    await delay(250);
    this.state = { ...this.state, ...patch };
    // NOTE: mock state is in-memory only — it resets on every reload/restart.
    // If your name edits "don't stick" locally, this is why: the `user` domain
    // is on the mock transport. Add `user` to EXPO_PUBLIC_HTTP_DOMAINS to persist
    // against the real backend.
    debugLog('profile', 'updateMe (MOCK — in-memory, resets on reload)', this.state);
    return { ...this.state };
  }

  async requestPhoneChange(): Promise<PhoneChangeRequest> {
    await delay(300);
    // Mock accepts any 6-digit code; prefill "123456" like the auth mock.
    return {
      expiresIn: 300,
      devCode: '123456',
      currentPhoneOtpRequired: !!this.state.phone,
      currentPhoneMasked: this.state.phone ?? undefined,
      devCurrentCode: '654321',
    };
  }

  async confirmPhoneChange(phone: string, otp: string): Promise<PhoneChangeResult> {
    await delay(300);
    if (!/^\d{6}$/.test(otp)) throw new Error('Enter the 6-digit code we sent you.');
    const normalized = phone.replace(/[^\d+]/g, '');
    this.state = { ...this.state, phone: normalized, username: normalized };
    return {
      user: { ...this.state },
      session: { accessToken: 'mock_access', refreshToken: 'mock_refresh' },
    };
  }

  async deleteMe(): Promise<void> {
    await delay(250);
    this.state = { ...EMPTY_PROFILE };
    debugLog('profile', 'deleteMe (MOCK — in-memory reset)');
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
