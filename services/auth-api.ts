/**
 * Auth transport — sign-in / sign-up / refresh / sign-out.
 *
 * Same shape as the other transports: an interface, a Mock impl that
 * fakes the round-trip, an HTTP impl that calls real endpoints through
 * the unified `apiClient`. The auth flow never goes through `apiClient`
 * for sign-in (no token yet) — we use raw fetch with `skipAuth: true`
 * so the endpoints don't 401 the bootstrap call.
 *
 * Backend contract assumed:
 *   POST /v1/auth/sign-in    { email, password }       → AuthResult
 *   POST /v1/auth/sign-up    { email, password, ... }  → AuthResult
 *   POST /v1/auth/refresh    { refreshToken }          → AuthResult
 *   POST /v1/auth/sign-out   { refreshToken }          → 204
 *
 * AuthResult = { accessToken, refreshToken, expiresIn?, user }
 */

import { apiClient } from '@/services/api-client';
import type { AuthSession } from '@/services/auth-storage';

export type UserSummary = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  avatarUrl?: string | null;
  memberSince: string;
};

export type SignInInput = { email: string; password: string };
export type SignUpInput = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
};

export type AuthResult = {
  session: AuthSession;
  user: UserSummary;
};

export interface AuthTransport {
  signIn(input: SignInInput, signal?: AbortSignal): Promise<AuthResult>;
  signUp(input: SignUpInput, signal?: AbortSignal): Promise<AuthResult>;
  /** Exchanges the current refresh token for a fresh access + refresh
   *  pair. Returns `null` when the refresh token is invalid/expired —
   *  callers should sign the user out in that case. */
  refresh(refreshToken: string, signal?: AbortSignal): Promise<AuthResult | null>;
  signOut(refreshToken: string, signal?: AbortSignal): Promise<void>;
}

// ── Mock transport ─────────────────────────────────────────────────────

class MockAuthTransport implements AuthTransport {
  async signIn(input: SignInInput): Promise<AuthResult> {
    await delay(400);
    return buildMockResult(input.email);
  }

  async signUp(input: SignUpInput): Promise<AuthResult> {
    await delay(500);
    return buildMockResult(input.email, {
      firstName: input.firstName,
      lastName: input.lastName,
    });
  }

  async refresh(): Promise<AuthResult | null> {
    await delay(150);
    return buildMockResult('refresh@mock.local');
  }

  async signOut(): Promise<void> {
    await delay(150);
  }
}

function buildMockResult(email: string, profile?: Partial<UserSummary>): AuthResult {
  const id = `usr_${Math.random().toString(36).slice(2, 10)}`;
  const accessToken = `mock_access_${id}`;
  const refreshToken = `mock_refresh_${id}`;
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
      firstName: profile?.firstName ?? 'New',
      lastName: profile?.lastName ?? 'User',
      username: email.split('@')[0] ?? 'user',
      avatarUrl: null,
      memberSince: new Date().toISOString(),
      ...profile,
    },
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── HTTP transport ─────────────────────────────────────────────────────

type RawAuthResponse = {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number; // seconds
  user: UserSummary;
};

class HttpAuthTransport implements AuthTransport {
  async signIn(input: SignInInput, signal?: AbortSignal): Promise<AuthResult> {
    const r = await apiClient.post<RawAuthResponse>('/v1/auth/sign-in', input, {
      signal,
      skipAuth: true,
    });
    return toResult(r);
  }

  async signUp(input: SignUpInput, signal?: AbortSignal): Promise<AuthResult> {
    const r = await apiClient.post<RawAuthResponse>('/v1/auth/sign-up', input, {
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

export const authTransport: AuthTransport = shouldUseHttpTransport()
  ? new HttpAuthTransport()
  : new MockAuthTransport();
