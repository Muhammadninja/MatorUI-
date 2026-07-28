/**
 * UserContext — auth + profile data layer.
 *
 * On mount: hydrates any persisted session from SecureStore, populates
 * the in-memory cache that `getAuthToken()` reads, then fetches `/me`
 * if a token is present.
 *
 * Sign in / sign up go through `authTransport`; the resulting access +
 * refresh tokens are stored in SecureStore so subsequent app launches
 * skip the auth screens.
 *
 * 401 hook: any HTTP transport that gets a 401 invokes the registered
 * handler, which attempts a single refresh; on refresh failure the user
 * is signed out and routed to /auth.
 */

import { router } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import { setUnauthorizedHandler, ApiError } from '@/services/api-client';
import {
  authTransport,
  type RequestOtpInput,
  type RequestOtpResult,
  type VerifyOtpInput,
  type UserSummary,
} from '@/services/auth-api';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  setCurrentSession,
  getCurrentSession,
  type AuthSession,
} from '@/services/auth-storage';
import { userTransport } from '@/services/user-api';
import { debugLog, DEBUG_API_ENABLED } from '@/services/debug-log';
import { getDeviceId } from '@/services/device-id';

/**
 * DEV-ONLY: print the full auth credentials (refresh token, account phone/id,
 * device id) so they can be copied — e.g. to seed the admin panel's
 * MATOR_REFRESH_TOKEN without going through the OTP flow. Gated on
 * DEBUG_API_ENABLED (dev / EXPO_PUBLIC_DEBUG_API), never in a silent release.
 * Deliberately NOT redacted (unlike debugLog) — that's the point.
 */
async function logAuthCreds(
  label: string,
  session: AuthSession | null,
  user: { id?: string; phone?: string | null } | null,
): Promise<void> {
  if (!DEBUG_API_ENABLED || !session) return;
  const deviceId = await getDeviceId().catch(() => 'unknown');
  console.log(`[mator:creds] ${label}`, {
    phone: user?.phone ?? null,
    account_id: user?.id ?? null,
    device_id: deviceId,
    refresh_token: session.refreshToken,
    access_token: session.accessToken,
  });
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserProfile = UserSummary;

type UserContextValue = {
  profile: UserProfile | null;
  isAuthenticated: boolean;
  /** Stable opaque ID assigned to unauthenticated sessions for support / analytics. */
  guestId: string;
  /** True during the initial cold-boot hydrate from SecureStore + /me fetch. */
  isHydrating: boolean;
  /** True during a sign-in / sign-up / refresh-profile in-flight call. */
  isLoading: boolean;
  error: string | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (patch: Partial<Omit<UserProfile, 'id' | 'memberSince'>>) => Promise<void>;
  /** Change the login phone: send an OTP to the new number. Returns a dev code on
   *  dev builds so the verify step can prefill it. */
  requestPhoneChange: (phone: string) => Promise<{ expiresIn: number; devCode?: string }>;
  /** Verify the OTP; rebinds the account to the new number and swaps the session. */
  confirmPhoneChange: (phone: string, otp: string) => Promise<void>;
  /** Passwordless: send a one-time code to the phone/email. Returns a handle for `verifyOtp`. */
  requestOtp: (input: RequestOtpInput) => Promise<RequestOtpResult>;
  /** Passwordless: verify the code, establish the session, and load the profile. */
  verifyOtp: (input: VerifyOtpInput) => Promise<void>;
  signOut: () => Promise<void>;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const UserContext = createContext<UserContextValue | undefined>(undefined);

/** Short opaque ID like "A8F2K3" — readable, unambiguous, no real PII. */
function makeGuestId(): string {
  const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function UserProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isHydrating, setIsHydrating] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const guestIdRef = useRef<string>(makeGuestId());

  // Atomically swap the persisted session: SecureStore + in-memory cache.
  const persistSession = useCallback(async (session: AuthSession | null) => {
    setCurrentSession(session);
    if (session) await saveAuthSession(session);
    else await clearAuthSession();
  }, []);

  const signOut = useCallback(async () => {
    const existing = getCurrentSession();
    setProfile(null);
    await persistSession(null);
    // Best-effort revocation — don't block the sign-out UX on it.
    if (existing) {
      authTransport.signOut(existing.refreshToken).catch(() => undefined);
    }
  }, [persistSession]);

  const requestOtp = useCallback(async (input: RequestOtpInput) => {
    setIsLoading(true);
    setError(null);
    try {
      return await authTransport.requestOtp(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the code.');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(
    async (input: VerifyOtpInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await authTransport.verifyOtp(input);
        await persistSession(result.session);
        setProfile(result.user);
        debugLog('auth', 'verifyOtp OK — session established', result.user);
        void logAuthCreds('verifyOtp', result.session, result.user);
      } catch (err) {
        debugLog('auth', 'verifyOtp FAILED', { message: (err as Error)?.message });
        setError(err instanceof Error ? err.message : 'Verification failed.');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [persistSession],
  );

  const refreshProfile = useCallback(async () => {
    if (!getCurrentSession()) return;
    setIsLoading(true);
    setError(null);
    try {
      const me = await userTransport.getMe();
      setProfile(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Omit<UserProfile, 'id' | 'memberSince'>>) => {
      if (!profile) return;
      const previous = profile;
      debugLog('profile', 'updateProfile → patch', patch);
      // Optimistic update
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      try {
        const updated = await userTransport.updateMe(patch);
        setProfile(updated);
        debugLog('profile', 'updateProfile OK — saved profile', updated);
      } catch (err) {
        setProfile(previous);
        setError(err instanceof Error ? err.message : 'Failed to update profile.');
        debugLog('profile', 'updateProfile FAILED — rolled back', { message: (err as Error)?.message });
        throw err;
      }
    },
    [profile],
  );

  const requestPhoneChange = useCallback(
    (phone: string) => userTransport.requestPhoneChange(phone),
    [],
  );

  const confirmPhoneChange = useCallback(
    async (phone: string, otp: string) => {
      // Confirming rebinds the account to the new number and issues a NEW session
      // (the login identity changed) — persist it and swap the profile.
      const { user, session } = await userTransport.confirmPhoneChange(phone, otp);
      await persistSession(session);
      setProfile(user);
      debugLog('profile', 'phone changed — session swapped', { phone: user.phone });
    },
    [persistSession],
  );

  // ── Hydration on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await loadAuthSession();
      if (cancelled) return;
      setCurrentSession(session);
      if (session) {
        try {
          const me = await userTransport.getMe();
          if (!cancelled) setProfile(me);
          void logAuthCreds('hydrate (restored session)', session, me);
        } catch (err) {
          // Only DISCARD the persisted session on a definitive auth failure —
          // i.e. a 401 that survived the refresh-and-retry in api-client (the
          // refresh token is dead). A transient cold-boot failure (network not
          // ready yet, timeout, 5xx) must NOT log the user out: keep the
          // session on disk so the next launch — or an in-app retry — restores
          // them. Wiping on any error is what made users re-authenticate every
          // time they opened the app on a flaky connection.
          const isAuthFailure = err instanceof ApiError && err.status === 401;
          debugLog('auth', 'hydrate getMe FAILED', {
            status: err instanceof ApiError ? err.status : undefined,
            discardingSession: isAuthFailure,
            message: (err as Error)?.message,
          });
          if (!cancelled && isAuthFailure) {
            await persistSession(null);
          }
          // On a transient error we keep `session` in the in-memory cache (set
          // above) so authed requests can still be attempted this run.
        }
      }
      if (!cancelled) setIsHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [persistSession]);

  // ── 401 handler wired into apiClient ─────────────────────────────────
  //
  // Attempts ONE refresh against the current refresh token. On failure
  // signs the user out and routes to /sign-in. Concurrent 401s during
  // the refresh are coalesced via the `refreshInFlight` ref.
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);
  useEffect(() => {
    const handler = async () => {
      if (refreshInFlightRef.current) {
        await refreshInFlightRef.current;
        return;
      }
      const session = getCurrentSession();
      if (!session) return;
      const work = (async () => {
        const result = await authTransport.refresh(session.refreshToken).catch(() => null);
        if (!result) {
          await signOut();
          router.replace('/sign-in');
          return false;
        }
        await persistSession(result.session);
        setProfile(result.user);
        void logAuthCreds('token refreshed', result.session, result.user);
        return true;
      })();
      refreshInFlightRef.current = work;
      try {
        await work;
      } finally {
        refreshInFlightRef.current = null;
      }
    };
    setUnauthorizedHandler(handler);
    return () => setUnauthorizedHandler(null);
  }, [persistSession, signOut]);

  const value = useMemo<UserContextValue>(
    () => ({
      profile,
      isAuthenticated: profile !== null,
      guestId: guestIdRef.current,
      isHydrating,
      isLoading,
      error,
      refreshProfile,
      updateProfile,
      requestPhoneChange,
      confirmPhoneChange,
      requestOtp,
      verifyOtp,
      signOut,
    }),
    [
      profile,
      isHydrating,
      isLoading,
      error,
      refreshProfile,
      updateProfile,
      requestPhoneChange,
      confirmPhoneChange,
      requestOtp,
      verifyOtp,
      signOut,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used within a UserProvider');
  }
  return context;
}
