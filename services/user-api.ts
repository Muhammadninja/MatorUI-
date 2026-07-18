/**
 * User profile transport — GET /me and PATCH /me.
 *
 * Lives separately from auth-api because the lifecycle is different:
 * auth-api fires on sign-in / refresh, user-api fires whenever the
 * profile screen needs fresh data or the user saves an edit. Both flow
 * through the same `apiClient` so 401 handling is centralized.
 *
 * Backend contract (backend.json — phone-native user shape):
 *   GET   /v1/me  → RawBackendUser  ({ id, phone_e164, display_name, avatar_url,
 *                                      myid_status, transaction_limit_uzs, created_at })
 *   PATCH /v1/me  → RawBackendUser  (accepts { display_name?, avatar_url? })
 * The transport maps to/from the app's `UserSummary` via the shared
 * `mapBackendUser` (same mapper auth-api uses on verify/refresh). Email and phone
 * are NOT editable here — the backend has no email field and phone changes go
 * through the verified OTP flow — so those patch fields are dropped.
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';
import { mapBackendUser, type RawBackendUser, type UserSummary } from '@/services/auth-api';

export type UserPatch = Partial<Omit<UserSummary, 'id' | 'memberSince'>>;

export interface UserTransport {
  getMe(signal?: AbortSignal): Promise<UserSummary>;
  updateMe(patch: UserPatch, signal?: AbortSignal): Promise<UserSummary>;
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
    return { ...this.state };
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── HTTP transport ─────────────────────────────────────────────────────

class HttpUserTransport implements UserTransport {
  async getMe(signal?: AbortSignal): Promise<UserSummary> {
    const r = await apiClient.get<RawBackendUser>('/v1/me', { signal });
    return mapBackendUser(r);
  }

  async updateMe(patch: UserPatch, signal?: AbortSignal): Promise<UserSummary> {
    // UpdateMeDto accepts first_name/last_name/display_name/avatar_url. Send the
    // dedicated name fields (and a combined display_name for compatibility).
    // Email/phone aren't editable here.
    const body: Record<string, unknown> = {};
    if (patch.firstName !== undefined) body.first_name = patch.firstName;
    if (patch.lastName !== undefined) body.last_name = patch.lastName;
    if (patch.firstName !== undefined || patch.lastName !== undefined) {
      body.display_name = `${patch.firstName ?? ''} ${patch.lastName ?? ''}`.trim();
    }
    if (patch.avatarUrl !== undefined) body.avatar_url = patch.avatarUrl;
    const r = await apiClient.patch<RawBackendUser>('/v1/me', body, { signal });
    return mapBackendUser(r);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

export const userTransport: UserTransport = shouldUseHttpTransport('user')
  ? new HttpUserTransport()
  : new MockUserTransport();
