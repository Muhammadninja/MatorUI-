/**
 * User profile transport — GET /me and PATCH /me.
 *
 * Lives separately from auth-api because the lifecycle is different:
 * auth-api fires on sign-in / refresh, user-api fires whenever the
 * profile screen needs fresh data or the user saves an edit. Both flow
 * through the same `apiClient` so 401 handling is centralized.
 *
 * Backend contract (verified live against api.mator.uz 2026-07-21):
 *   GET   /v1/me  → RawBackendUser  ({ id, phone_e164, display_name, first_name,
 *                                      last_name, avatar_url, created_at, … })
 *   PATCH /v1/me  → RawBackendUser  — STRICT whitelist DTO (`forbidNonWhitelisted`):
 *                   accepts ONLY { first_name?, last_name?, display_name?,
 *                   avatar_url? }. Any other property (phone_e164, email, …) 400s
 *                   the WHOLE request, so those are dropped here. Phone is the
 *                   login identity — changed via the OTP re-verify flow, not /me.
 * The transport maps to/from the app's `UserSummary` via the shared
 * `mapBackendUser` (same mapper auth-api uses on verify/refresh).
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';
import { mapBackendUser, type RawBackendUser, type UserSummary } from '@/services/auth-api';
import type { AuthSession } from '@/services/auth-storage';
import { debugLog } from '@/services/debug-log';

export type UserPatch = Partial<Omit<UserSummary, 'id' | 'memberSince'>>;

/** Result of kicking off a phone change. An OTP was sent to the NEW number and, when
 *  the account has one, another to the CURRENT number. */
export type PhoneChangeRequest = {
  /** Seconds until the code expires. */
  expiresIn: number;
  /** DEV/DEMO only — the code, so dev builds can prefill it. Prod omits it. */
  devCode?: string;
  /** The change also needs the code sent to the number on the account. */
  currentPhoneOtpRequired: boolean;
  /** That number, masked by the backend, for the prompt. */
  currentPhoneMasked?: string;
  /** DEV/DEMO only — the code sent to the current number. */
  devCurrentCode?: string;
};

/** Result of confirming a phone change — the account is rebound to the new
 *  number and the backend issues a fresh session. */
export type PhoneChangeResult = {
  user: UserSummary;
  session: AuthSession;
};

export interface UserTransport {
  getMe(signal?: AbortSignal): Promise<UserSummary>;
  updateMe(patch: UserPatch, signal?: AbortSignal): Promise<UserSummary>;
  /** Send an OTP to `phone` to start changing the login number. */
  requestPhoneChange(phone: string, signal?: AbortSignal): Promise<PhoneChangeRequest>;
  /** Verify the OTPs and rebind the account to `phone`; returns fresh session+user. */
  confirmPhoneChange(
    phone: string,
    otp: string,
    currentPhoneOtp?: string,
    signal?: AbortSignal,
  ): Promise<PhoneChangeResult>;
  /** Permanently delete the signed-in account server-side. The caller clears the
   *  local session afterward; this only asks the backend to erase the account. */
  deleteMe(signal?: AbortSignal): Promise<void>;
}

/** Strip spaces/dashes so "+998 90 123 45 67" → "+998901234567". */
function toE164(raw: string): string {
  return raw.replace(/[^\d+]/g, '');
}

/** ISO → whole epoch seconds, or undefined. */
function epochFromIso(iso?: string): number | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

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

class MockUserTransport implements UserTransport {
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

// ── HTTP transport ─────────────────────────────────────────────────────

class HttpUserTransport implements UserTransport {
  async getMe(signal?: AbortSignal): Promise<UserSummary> {
    const r = await apiClient.get<RawBackendUser>('/v1/me', { signal });
    const me = mapBackendUser(r);
    debugLog('profile', 'getMe ←', me);
    return me;
  }

  async updateMe(patch: UserPatch, signal?: AbortSignal): Promise<UserSummary> {
    // UpdateMeDto is a STRICT whitelist (`forbidNonWhitelisted`): it accepts ONLY
    // first_name/last_name/display_name/avatar_url. ANY other property 400s the
    // WHOLE request. Verified live against api.mator.uz 2026-07-21:
    //   PATCH { phone_e164 } → 400 { code: VALIDATION_FAILED,
    //                                message: "property phone_e164 should not exist" }
    // So we must NOT send phone (it's the login identity — no backend change-phone
    // endpoint exists; only the auth OTP flow upserts by phone) and NOT send email
    // (no backend field). Sending either would block the name save too.
    //
    // ⚠️ We also do NOT send `avatar_url` here. The avatar is persisted
    // EXCLUSIVELY by `POST /v1/me/avatar` (`uploadAvatar()`), which stores the
    // image and returns a Cloudinary URL. PATCH /v1/me's `avatar_url` validator
    // rejects that very URL — "avatar_url must be an HTTPS URL on an allowed
    // asset host" (the two endpoints disagree on the allowed host set). Re-sending
    // it here 400s the WHOLE request, so the name save fails with a "Could not
    // save" toast even though the upload already persisted the new photo. The
    // caller passes `avatarUrl` through for the OPTIMISTIC local update only; it
    // must never reach this PATCH body. See [[mator-integration-state]].
    const body: Record<string, unknown> = {};
    if (patch.firstName !== undefined) body.first_name = patch.firstName;
    if (patch.lastName !== undefined) body.last_name = patch.lastName;
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      body.display_name = `${patch.firstName ?? ''} ${patch.lastName ?? ''}`.trim();
    }

    debugLog('profile', 'updateMe → PATCH /v1/me', body);
    const r = await apiClient.patch<RawBackendUser>('/v1/me', body, { signal });
    const updated = mapBackendUser(r);
    debugLog('profile', 'updateMe ←', updated);
    return updated;
  }

  async requestPhoneChange(phone: string, signal?: AbortSignal): Promise<PhoneChangeRequest> {
    // POST /v1/me/phone/request { phone } → sends an OTP to the NEW number and one to
    // the number on the account, and returns { expires_at, resend_after_seconds,
    // current_phone_otp_required, current_phone_masked?, dev_otp_code? }.
    const r = await apiClient.post<{
      expires_at?: string;
      resend_after_seconds?: number;
      dev_otp_code?: string;
      current_phone_otp_required?: boolean;
      current_phone_masked?: string;
      dev_current_phone_otp_code?: string;
    }>('/v1/me/phone/request', { phone: toE164(phone) }, { signal });
    const expiresAt = epochFromIso(r.expires_at);
    const expiresIn = expiresAt
      ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000))
      : (r.resend_after_seconds ?? 300);
    debugLog('profile', 'requestPhoneChange → OTP sent', { expiresIn });
    return {
      expiresIn,
      devCode: r.dev_otp_code,
      currentPhoneOtpRequired: r.current_phone_otp_required ?? false,
      currentPhoneMasked: r.current_phone_masked,
      devCurrentCode: r.dev_current_phone_otp_code,
    };
  }

  async confirmPhoneChange(
    phone: string,
    otp: string,
    currentPhoneOtp?: string,
    signal?: AbortSignal,
  ): Promise<PhoneChangeResult> {
    // POST /v1/me/phone/confirm { phone, otp, current_phone_otp? } → rebinds the account to the new
    // number and returns a fresh { user, tokens } (the login identity changed).
    const r = await apiClient.post<{
      user: RawBackendUser;
      tokens: {
        access_token: string;
        access_token_expires_at?: string;
        refresh_token: string;
      };
    }>(
      '/v1/me/phone/confirm',
      {
        phone: toE164(phone),
        otp,
        // Only when asked for: a backend that does not know the field refuses it.
        ...(currentPhoneOtp ? { current_phone_otp: currentPhoneOtp } : {}),
      },
      { signal },
    );
    const user = mapBackendUser(r.user);
    const session: AuthSession = {
      accessToken: r.tokens.access_token,
      refreshToken: r.tokens.refresh_token,
      expiresAt: epochFromIso(r.tokens.access_token_expires_at),
    };
    debugLog('profile', 'confirmPhoneChange ← rebound + new session', { phone: user.phone });
    return { user, session };
  }

  async deleteMe(signal?: AbortSignal): Promise<void> {
    // Backend contract (PROPOSED — build to honor self-serve deletion, required
    // for App Store / Play Store data-deletion policy): DELETE /v1/me erases the
    // signed-in account and returns 204. Auth'd (bearer). The caller clears the
    // local session on success. If the endpoint 404s, this rejects and the UI
    // keeps the account — we never fake a deletion.
    await apiClient.delete<void>('/v1/me', { signal });
    debugLog('profile', 'deleteMe → account erased server-side');
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

export const userTransport: UserTransport = shouldUseHttpTransport('user')
  ? new HttpUserTransport()
  : new MockUserTransport();
