/**
 * Auth transport — passwordless phone OTP.
 *
 * Same shape as the other transports: an interface, a Mock impl that fakes the
 * round-trip, an HTTP impl that calls the real endpoints through the unified
 * `apiClient`. The auth flow never goes through `apiClient` for request/verify
 * (no token yet) — we use `skipAuth: true` so the endpoints don't 401.
 *
 * The HTTP impl mirrors the backend contract in `text/backend.json`
 * (§AuthPhoneEntryScreen / AuthOtpVerifyScreen). It maps between the app's
 * channel-agnostic internal types and the backend's phone-native wire shape:
 *
 *   POST /v1/auth/phone/request-otp  { phone_e164, country_iso2, channel:'sms', lang }
 *                                      → { request_id, phone_e164, expires_at,
 *                                          resend_after_seconds, otp_length,
 *                                          next_screen }
 *                                        (never whether the number has an
 *                                        account: that is not public)
 *   POST /v1/auth/phone/verify-otp   { request_id, phone_e164, otp_code }
 *                                      → { user, tokens }
 *   POST /v1/auth/token/refresh      { refresh_token } → { user?, tokens }
 *   POST /v1/auth/logout             { refresh_token, install_id } (Bearer)
 *                                      → revokes the session and this install's
 *                                        push registration; best effort
 *
 * `devCode` is a DEV/DEMO convenience: the mock transport (and the offline mock
 * server, via a `dev_otp_code` field) return the just-generated code so demo/E2E
 * builds can auto-fill it. A real backend omits it — the user types the code.
 */

import { apiClient, ApiError } from '@/services/api-client';
import { debugLog } from '@/services/debug-log';
import { getDeviceId } from '@/services/device-id';
import { allowLocalDevOtp } from '@/config/environment';
import type { AuthSession } from '@/services/auth-storage';
import type { LanguageCode } from '@/services/language-storage';
import type { LegalRegistrationVersions } from '@/types/legal';

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
  /**
   * Language of the SMS the code arrives in — the app's chosen interface
   * language. Sent as `lang` on request-otp. That endpoint does NOT read
   * `Accept-Language`, and the backend falls back to `uz` whenever `lang` is
   * omitted, so it is required here: a caller that forgets it would silently
   * text a Russian or English user in Uzbek.
   */
  lang: LanguageCode;
  /** Sign-up only — captured up front so verify can create the profile. */
  firstName?: string;
  lastName?: string;
};

export type RequestOtpResult = {
  /** Opaque handle tying the later verify call back to this request. */
  otpToken: string;
  /** Seconds until the code expires. */
  expiresIn: number;
  /** Digits in the code, when the backend reports it. */
  otpLength?: number;
  /** DEV/DEMO ONLY — the code, so mock builds can auto-fill it. Real backends omit this. */
  devCode?: string;
};

export type VerifyOtpInput = {
  otpToken: string;
  code: string;
  /**
   * Accepted legal versions. Always populated once the documents have loaded
   * and the user has ticked the boxes; versions MUST come from
   * GET /v1/legal/documents, never a literal.
   *
   * Optional only because the documents request can still be in flight or have
   * failed. The transport forwards whatever it is given — it never decides to
   * withhold the block based on whether the user looks like an existing one.
   * The backend requires it for a new account and ignores it otherwise.
   */
  legal?: LegalRegistrationVersions;
};

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
   *  Contract (so callers can react correctly):
   *   - resolves to `AuthResult` on success;
   *   - resolves to `null` ONLY when the refresh token is DEFINITIVELY rejected
   *     (401/403) — it will never succeed again, so the caller must sign out;
   *   - THROWS on a transient failure (offline, timeout, 5xx, rate-limit, or an
   *     unparseable 2xx body) — the token may still be valid, so the caller
   *     should keep the session and retry on the next request. */
  refresh(refreshToken: string, signal?: AbortSignal): Promise<AuthResult | null>;
  /** Ends the session on the server: revokes the refresh token, the access
   *  token that is passed, and this install's push registration. Best effort;
   *  the caller has already cleared the local session. */
  signOut(refreshToken: string, signal?: AbortSignal, accessToken?: string): Promise<void>;
}

// ── HTTP transport (backend.json wire shape) ────────────────────────────

/**
 * Normalize a user-entered Uzbek phone to E.164 (`+998XXXXXXXXX`). The app is
 * UZ-only (request-otp always sends `country_iso2: 'UZ'`), so a bare national
 * number is assumed to be +998. Accepts any of:
 *   "+998 90 123 45 67", "998901234567", "901234567", "0901234567"
 * → all become "+998901234567". Strips formatting, drops a leading 998 country
 * code or a 0 trunk prefix, then re-prefixes +998.
 */
function toE164(raw: string): string {
  let digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('998')) digits = digits.slice(3);
  else if (digits.startsWith('0')) digits = digits.replace(/^0+/, '');
  return `+998${digits}`;
}

/** Unix seconds from an ISO timestamp; undefined when absent/invalid. */
function epochFromIso(iso?: string): number | undefined {
  if (!iso) return undefined;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
}

type RawRequestOtpResponse = {
  request_id: string;
  phone_e164?: string;
  expires_at?: string; // ISO
  resend_after_seconds?: number;
  otp_length?: number;
  delivery_channel?: string;
  next_screen?: string;
  /** MOCK/DEV ONLY — the code, so offline/E2E builds can auto-fill it. */
  dev_otp_code?: string;
};

/**
 * The backend's phone-native user object (backend.json §AuthOtpVerifyScreen and
 * GET /v1/me). Tolerant of both the spec's snake_case and the camelCase variant
 * seen in real responses, and of an optional `email` some deployments include.
 * Shared with `user-api.ts` so auth and /me map identically.
 */
export type RawBackendUser = {
  id: string;
  phone_e164?: string | null;
  phoneE164?: string | null;
  email?: string | null;
  display_name?: string | null;
  displayName?: string | null;
  /** Live `/v1/me` returns dedicated first/last name fields (snake) and
   *  `/v1/auth/me` returns the camelCase variant. Prefer these over splitting
   *  `display_name`. */
  first_name?: string | null;
  last_name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  /** MyID verification status on the user record. MyID was dropped from the
   *  onboarding flow (2026-07-17) but this field may still ride on /me — kept
   *  for documentation; nothing in the app reads it. */
  myid_status?: string;
  transaction_limit_uzs?: number | string;
  created_at?: string;
  createdAt?: string;
};

type RawTokens = {
  access_token: string;
  access_token_expires_at?: string; // ISO
  refresh_token: string;
  refresh_token_expires_at?: string;
  token_type?: string;
};

type RawVerifyResponse = {
  user: RawBackendUser;
  tokens: RawTokens;
};

/** Map the backend's phone-native user onto the app's `UserSummary`. Shared by
 *  auth verify/refresh and `user-api`'s GET/PATCH /v1/me so the whole user
 *  surface is consistent. */
export function mapBackendUser(u: RawBackendUser): UserSummary {
  const phone = u.phone_e164 ?? u.phoneE164 ?? null;
  // Prefer dedicated first/last name fields; fall back to splitting the
  // legacy `display_name` when they're absent.
  let firstName = (u.first_name ?? u.firstName ?? '').trim();
  let lastName = (u.last_name ?? u.lastName ?? '').trim();
  if (!firstName && !lastName) {
    const name = (u.display_name ?? u.displayName ?? '').trim();
    const sep = name.indexOf(' ');
    firstName = sep === -1 ? name : name.slice(0, sep);
    lastName = sep === -1 ? '' : name.slice(sep + 1).trim();
  }
  return {
    id: u.id,
    firstName,
    lastName,
    email: u.email ?? '',
    username: phone ?? '',
    phone,
    avatarUrl: u.avatar_url ?? u.avatarUrl ?? null,
    memberSince: u.created_at ?? u.createdAt ?? '',
  };
}

function tokensToSession(t: RawTokens): AuthSession {
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: epochFromIso(t.access_token_expires_at),
  };
}

class HttpAuthTransport implements AuthTransport {
  // verify-otp / resend need the phone_e164 that seeded the request, but the
  // app's VerifyOtpInput only carries the opaque token — remember it per id.
  private phoneByRequest = new Map<string, string>();

  async requestOtp(input: RequestOtpInput, signal?: AbortSignal): Promise<RequestOtpResult> {
    const phone_e164 = toE164(input.identifier);
    const r = await apiClient.post<RawRequestOtpResponse>(
      '/v1/auth/phone/request-otp',
      { phone_e164, country_iso2: 'UZ', channel: 'sms', lang: input.lang },
      { signal, skipAuth: true },
    );
    this.phoneByRequest.set(r.request_id, r.phone_e164 ?? phone_e164);
    const expiresAt = epochFromIso(r.expires_at);
    return {
      otpToken: r.request_id,
      expiresIn: expiresAt
        ? Math.max(0, expiresAt - Math.floor(Date.now() / 1000))
        : (r.resend_after_seconds ?? 300),
      otpLength: r.otp_length,
      devCode: allowLocalDevOtp() ? r.dev_otp_code : undefined,
    };
  }

  async verifyOtp(input: VerifyOtpInput, signal?: AbortSignal): Promise<AuthResult> {
    const phone_e164 = this.phoneByRequest.get(input.otpToken);
    const r = await apiClient.post<RawVerifyResponse>(
      '/v1/auth/phone/verify-otp',
      {
        request_id: input.otpToken,
        phone_e164,
        otp_code: input.code,
        // ALWAYS sent when the caller has the versions — the backend requires
        // it for a new account and ignores it for an existing one, so the
        // client must never decide to withhold it. There is deliberately no
        // `is_existing_user` branch here: guessing wrong would strip a
        // legitimate registration's consent.
        legal: input.legal,
      },
      { signal, skipAuth: true },
    );
    this.phoneByRequest.delete(input.otpToken);
    // MyID verification was removed from the onboarding flow (backend
    // 2026-07-17): verify-otp always lands the user on the garage, so there's
    // no post-OTP consent branch to surface here.
    return { session: tokensToSession(r.tokens), user: mapBackendUser(r.user) };
  }

  async refresh(refreshToken: string, signal?: AbortSignal): Promise<AuthResult | null> {
    let r: Record<string, unknown>;
    try {
      r = await apiClient.post<Record<string, unknown>>(
        '/v1/auth/token/refresh',
        { refresh_token: refreshToken },
        { signal, skipAuth: true, maxRetries: 0 },
      );
    } catch (err) {
      // Distinguish a DEFINITIVE rejection of the refresh token (401/403 → it
      // will never work again, sign out) from a TRANSIENT failure (offline,
      // timeout, 5xx, rate-limit → the token may still be valid, keep session).
      // Collapsing both to `null` is what could strand a user on a dead session;
      // collapsing both to a throw is what logged users out on every flaky
      // launch. So return null ONLY for 401/403, and rethrow everything else.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        debugLog('auth', 'refresh rejected — refresh token invalid/expired', {
          status: err.status,
          code: err.code,
        });
        return null;
      }
      debugLog('auth', 'refresh transient failure — keeping session, will retry', {
        message: (err as Error)?.message,
      });
      throw err;
    }

    // Tolerate every plausible shape the backend might return, so a mismatch
    // never silently fails the refresh (which used to log the user out):
    //   { tokens: { access_token, refresh_token } }  (nested, snake)
    //   { access_token, refresh_token }               (flat, snake)
    //   { accessToken, refreshToken }                 (flat, camel)
    const nested = r && typeof (r as { tokens?: unknown }).tokens === 'object'
      ? ((r as { tokens: Record<string, unknown> }).tokens)
      : (r as Record<string, unknown>);
    const t = (nested ?? {}) as Record<string, unknown>;
    const accessToken = (t.access_token ?? t.accessToken) as string | undefined;
    // Backends that don't rotate the refresh token return only a new access
    // token — keep the current refresh token in that case.
    const newRefresh = (t.refresh_token ?? t.refreshToken ?? refreshToken) as string;
    if (!accessToken) {
      // A 2xx with an unparseable body is a backend bug, NOT a dead token — treat
      // it as transient (throw → caller keeps the session) rather than signing
      // the user out, which returning null here would trigger.
      debugLog('auth', 'refresh: no access token in 2xx response — treating as transient', {
        responseKeys: Object.keys((r ?? {}) as object),
        tokenKeys: Object.keys(t),
      });
      throw new Error('refresh: unparseable token response');
    }
    const expiresAt = epochFromIso(
      (t.access_token_expires_at ?? t.accessTokenExpiresAt) as string | undefined,
    );
    const rawUser = ((r as { user?: RawBackendUser }).user ??
      (t.user as RawBackendUser | undefined));
    return {
      session: { accessToken, refreshToken: newRefresh, expiresAt },
      user: rawUser
        ? mapBackendUser(rawUser)
        : { id: '', firstName: '', lastName: '', email: '', username: '', avatarUrl: null, memberSince: '' },
    };
  }

  async signOut(refreshToken: string, signal?: AbortSignal, accessToken?: string): Promise<void> {
    // Without the access token the endpoint cannot authenticate the call; the
    // local session is already gone, so there is nothing more to do.
    if (!accessToken) return;
    // The local session was cleared before this runs, so the token is passed
    // explicitly (`skipAuth` stops the client injecting a now-absent one).
    // `install_id` lets the backend stop push notifications to this install.
    await apiClient.post(
      '/v1/auth/logout',
      { refresh_token: refreshToken, install_id: await getDeviceId() },
      {
        signal,
        skipAuth: true,
        maxRetries: 0,
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  }
}

// ── Singleton ──────────────────────────────────────────────────────────


// A shipped bundle always uses server authentication. A missing transport gate
// must never turn a release into an offline/demo sign-in implementation.
export const authTransport: AuthTransport = new HttpAuthTransport();
