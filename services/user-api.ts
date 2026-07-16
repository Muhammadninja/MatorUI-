/**
 * User profile transport — GET /me and PATCH /me.
 *
 * Lives separately from auth-api because the lifecycle is different:
 * auth-api fires on sign-in / refresh, user-api fires whenever the
 * profile screen needs fresh data or the user saves an edit. Both flow
 * through the same `apiClient` so 401 handling is centralized.
 *
 * Backend contract:
 *   GET   /v1/me  → UserSummary
 *   PATCH /v1/me  → UserSummary  (partial body merged server-side)
 */

import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';
import { TEST_USER, type UserSummary } from '@/services/auth-api';

export type UserPatch = Partial<Omit<UserSummary, 'id' | 'memberSince'>>;

export interface UserTransport {
  getMe(signal?: AbortSignal): Promise<UserSummary>;
  updateMe(patch: UserPatch, signal?: AbortSignal): Promise<UserSummary>;
}

// ── Mock transport ─────────────────────────────────────────────────────
//
// Stores a single in-memory profile that survives across the
// `userTransport` singleton's lifetime. Sign-in via auth-api seeds the
// initial state by calling `MockUserTransport.seed()`.

const SEED_PROFILE: UserSummary = { ...TEST_USER };

class MockUserTransport implements UserTransport {
  private state: UserSummary = { ...SEED_PROFILE };

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
  getMe(signal?: AbortSignal): Promise<UserSummary> {
    return apiClient.get<UserSummary>('/v1/me', { signal });
  }

  updateMe(patch: UserPatch, signal?: AbortSignal): Promise<UserSummary> {
    return apiClient.patch<UserSummary>('/v1/me', patch, { signal });
  }
}

// ── Singleton ──────────────────────────────────────────────────────────

export const userTransport: UserTransport = shouldUseHttpTransport('user')
  ? new HttpUserTransport()
  : new MockUserTransport();
