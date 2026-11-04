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

import { setUnauthorizedHandler, invalidateAuthRequests, ApiError } from '@/services/api-client';
import {
  authTransport,
  type RequestOtpInput,
  type RequestOtpResult,
  type VerifyOtpInput,
  type UserSummary,
} from '@/services/auth-api';
import { clearStoredChat } from '@/services/chat-storage';
import {
  clearAuthSession,
  loadAuthSession,
  saveAuthSession,
  setCurrentSession,
  getCurrentSession,
  type AuthSession,
} from '@/services/auth-storage';
import { userTransport } from '@/services/user-api';
import { debugLog } from '@/services/debug-log';
import { garageService } from '@/services/garage-service';
import { cartTransport } from '@/services/cart-api';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  requestPhoneChange: (
    phone: string,
  ) => Promise<{ expiresIn: number; otpLength?: number; devCode?: string }>;
  /** Verify the OTP; rebinds the account to the new number and swaps the session. */
  confirmPhoneChange: (phone: string, otp: string) => Promise<void>;
  /** Passwordless: send a one-time code to the phone/email. Returns a handle for `verifyOtp`. */
  requestOtp: (input: RequestOtpInput) => Promise<RequestOtpResult>;
  /** Passwordless: verify the code, establish the session, and load the profile. */
  verifyOtp: (input: VerifyOtpInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** Permanently delete the account server-side, then clear the local session.
   *  Rejects (leaving the user signed in) if the backend deletion fails. */
  deleteAccount: () => Promise<void>;
};

// ─── Context ─────────────────────────────────────────────────────────────────

const UserContext = createContext<UserContextValue | undefined>(undefined);

/**
 * Cached profile — persisted to AsyncStorage (reliable across cold boots) so a
 * returning user is shown as logged-in INSTANTLY on launch, before and
 * independent of the `/me` refresh. Keyed separately from the session tokens.
 * This is what makes "remember me" survive a slow/failed `/me` or token refresh:
 * the UI's `isAuthenticated` is driven by the cached profile, not by a
 * network round-trip that can fail on a cold boot.
 */
const PROFILE_CACHE_KEY = 'auth:v2:profile';
async function saveProfileCache(p: UserProfile | null): Promise<void> {
  try {
    if (p) await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p));
    else await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
    debugLog('auth', p ? 'saveProfileCache OK' : 'saveProfileCache cleared');
  } catch (err) {
    debugLog('auth', 'saveProfileCache FAILED', { message: (err as Error)?.message });
  }
}
async function loadProfileCache(): Promise<UserProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    debugLog('auth', raw ? 'loadProfileCache → restored' : 'loadProfileCache → none');
    return raw ? (JSON.parse(raw) as UserProfile) : null;
  } catch (err) {
    debugLog('auth', 'loadProfileCache FAILED', { message: (err as Error)?.message });
    return null;
  }
}

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
  // True only during the initial cold-boot hydration. While true, a failed
  // token refresh must NOT sign the user out — the restored session + cached
  // profile keep them logged in; the token retries on the next request.
  const bootingRef = useRef(true);
  const lifecycleRef = useRef(0);
  const persistenceRef = useRef<Promise<void>>(Promise.resolve());
  const profilePersistenceRef = useRef<Promise<void>>(Promise.resolve());
  const refreshInFlightRef = useRef<Promise<boolean> | null>(null);

  // Set the profile in memory AND persist it, so the next cold boot can render
  // the user as logged-in immediately, without waiting on `/me`.
  const applyProfile = useCallback((p: UserProfile | null) => {
    const generation = lifecycleRef.current;
    garageService.setSession(p?.id ?? null);
    cartTransport.setSession?.(p?.id ?? null);
    setProfile(p);
    profilePersistenceRef.current = profilePersistenceRef.current.then(() => {
      if (generation === lifecycleRef.current) return saveProfileCache(p);
    });
  }, []);

  // Atomically swap the persisted session: SecureStore + in-memory cache.
  const persistSession = useCallback(async (session: AuthSession | null, generation = lifecycleRef.current) => {
    if (generation !== lifecycleRef.current) return false;
    setCurrentSession(session);
    const work = persistenceRef.current.then(async () => {
      if (generation !== lifecycleRef.current) return;
      if (session) await saveAuthSession(session);
      else await clearAuthSession();
    });
    persistenceRef.current = work.catch(() => undefined);
    await work;
    return generation === lifecycleRef.current;
  }, []);

  const signOut = useCallback(async () => {
    const existing = getCurrentSession();
    lifecycleRef.current += 1;
    invalidateAuthRequests();
    refreshInFlightRef.current = null;
    bootingRef.current = false;
    setIsHydrating(false);
    setIsLoading(false);
    setError(null);
    applyProfile(null);
    await persistSession(null);
    // Best-effort revocation — don't block the sign-out UX on it.
    if (existing) {
      authTransport.signOut(existing.refreshToken).catch(() => undefined);
    }
  }, [persistSession]);

  const accountId = profile?.id ?? null;
  const deleteAccount = useCallback(async () => {
    // Erase server-side FIRST; only clear the local session if the backend
    // confirms. On failure we rethrow so the caller can surface an error and
    // the user stays signed in (never a fake "deleted").
    const generation = lifecycleRef.current;
    await userTransport.deleteMe();
    // The account is gone, so its saved chat has no one to come back to.
    if (accountId) await clearStoredChat(accountId);
    if (generation === lifecycleRef.current) await signOut();
  }, [accountId, signOut]);

  const requestOtp = useCallback(async (input: RequestOtpInput) => {
    const generation = lifecycleRef.current;
    setIsLoading(true);
    setError(null);
    try {
      return await authTransport.requestOtp(input);
    } catch (err) {
      if (generation === lifecycleRef.current) setError(err instanceof Error ? err.message : 'Could not send the code.');
      throw err;
    } finally {
      if (generation === lifecycleRef.current) setIsLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(
    async (input: VerifyOtpInput) => {
      const generation = ++lifecycleRef.current;
      invalidateAuthRequests();
      refreshInFlightRef.current = null;
      bootingRef.current = false;
      setIsHydrating(false);
      setIsLoading(true);
      setError(null);
      try {
        const result = await authTransport.verifyOtp(input);
        if (!(await persistSession(result.session, generation))) {
          throw new DOMException('Sign-in superseded', 'AbortError');
        }
        applyProfile(result.user);
        debugLog('auth', 'verifyOtp OK — session established', result.user);
      } catch (err) {
        debugLog('auth', 'verifyOtp FAILED', { message: (err as Error)?.message });
        if (generation === lifecycleRef.current) setError(err instanceof Error ? err.message : 'Verification failed.');
        throw err;
      } finally {
        if (generation === lifecycleRef.current) setIsLoading(false);
      }
    },
    [persistSession],
  );

  const refreshProfile = useCallback(async () => {
    if (!getCurrentSession()) return;
    const generation = lifecycleRef.current;
    setIsLoading(true);
    setError(null);
    try {
      const me = await userTransport.getMe();
      // Persist to the profile cache (not just memory) so the freshly-fetched
      // avatar/name survive the next cold boot. Using bare setProfile here left
      // the cache holding a pre-avatar profile → the avatar vanished on relaunch.
      if (generation === lifecycleRef.current) applyProfile(me);
    } catch (err) {
      if (generation === lifecycleRef.current) setError(err instanceof Error ? err.message : 'Failed to load profile.');
    } finally {
      if (generation === lifecycleRef.current) setIsLoading(false);
    }
  }, [applyProfile]);

  const updateProfile = useCallback(
    async (patch: Partial<Omit<UserProfile, 'id' | 'memberSince'>>) => {
      if (!profile) return;
      const generation = lifecycleRef.current;
      const previous = profile;
      debugLog('profile', 'updateProfile → patch', patch);
      // Optimistic update
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      try {
        const updated = await userTransport.updateMe(patch);
        if (generation !== lifecycleRef.current) return;
        applyProfile(updated);
        debugLog('profile', 'updateProfile OK — saved profile', updated);
      } catch (err) {
        if (generation !== lifecycleRef.current) return;
        applyProfile(previous);
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
      const generation = lifecycleRef.current;
      const { user, session } = await userTransport.confirmPhoneChange(phone, otp);
      if (!(await persistSession(session, generation))) return;
      applyProfile(user);
      debugLog('profile', 'phone changed — session swapped', { phone: user.phone });
    },
    [persistSession],
  );

  // ── Hydration on mount ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const generation = lifecycleRef.current;
    (async () => {
      const [session, cachedProfile] = await Promise.all([loadAuthSession(), loadProfileCache()]);
      if (cancelled || generation !== lifecycleRef.current) return;
      setCurrentSession(session);
      if (session) {
        // Render the returning user as logged-in IMMEDIATELY from the cached
        // profile. The `/me` refresh below is best-effort — it must never be
        // able to log them out.
        if (cachedProfile) applyProfile(cachedProfile);
        try {
          const me = await userTransport.getMe();
          if (!cancelled && generation === lifecycleRef.current) applyProfile(me);
        } catch (err) {
          // NEVER wipe the session on cold boot. A failed `/me` — expired
          // access token whose refresh was rejected, offline, timeout, 5xx —
          // keeps the restored session AND the cached profile, so the user
          // stays signed in and the token refreshes on the next successful
          // request. Only an explicit signOut (or a dead refresh on a real
          // in-app action, once booting is done) clears the session. Wiping on
          // boot is exactly what made users re-authenticate every launch.
          debugLog('auth', 'hydrate getMe FAILED — keeping session + cached profile', {
            status: err instanceof ApiError ? err.status : undefined,
            hadCachedProfile: !!cachedProfile,
            message: (err as Error)?.message,
          });
        }
      }
      if (!cancelled && generation === lifecycleRef.current) {
        debugLog('auth', `BOOT DONE — restoredSession=${!!session} restoredProfile=${!!cachedProfile}`);
        bootingRef.current = false;
        setIsHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyProfile]);

  // ── 401 handler wired into apiClient ─────────────────────────────────
  //
  // Attempts ONE refresh against the current refresh token. On failure
  // signs the user out and routes to /sign-in. Concurrent 401s during
  // the refresh are coalesced via the `refreshInFlight` ref.
  useEffect(() => {
    const handler = async () => {
      if (refreshInFlightRef.current) {
        await refreshInFlightRef.current;
        return;
      }
      const session = getCurrentSession();
      if (!session) return;
      const generation = lifecycleRef.current;
      const work = (async () => {
        // The transport now distinguishes the two failure modes (see its doc):
        //   THROW  → transient (offline / timeout / 5xx / bad body): the token may
        //            still be valid, so KEEP the session and retry next request.
        //            This is what stops a flaky network from logging users out.
        //   null   → DEFINITIVE rejection (401/403): the refresh token is dead and
        //            will never work again, so sign out rather than loop 401s on a
        //            broken session forever.
        let result: Awaited<ReturnType<typeof authTransport.refresh>>;
        try {
          result = await authTransport.refresh(session.refreshToken);
        } catch {
          debugLog('auth', 'refresh transient — keeping session + cached profile');
          return false;
        }
        if (generation !== lifecycleRef.current) return false;
        if (!result) {
          if (bootingRef.current) {
            // Never wipe the session mid-cold-boot — a definitive 401 during
            // hydration still keeps the cached profile; the next in-app 401 after
            // boot will sign out cleanly. (Matches the hydration contract above.)
            debugLog('auth', 'refresh rejected during boot — deferring sign-out');
            return false;
          }
          debugLog('auth', 'refresh rejected — signing out and routing to /sign-in');
          const logout = signOut();
          const signedOutGeneration = lifecycleRef.current;
          await logout;
          if (signedOutGeneration === lifecycleRef.current) router.replace('/sign-in');
          return false;
        }
        if (!(await persistSession(result.session, generation))) return false;
        // Refresh may omit the user object; only overwrite the profile when it
        // actually carries one (else keep the cached / current profile).
        if (result.user?.id) applyProfile(result.user);
        return true;
      })();
      refreshInFlightRef.current = work;
      try {
        await work;
      } finally {
        if (refreshInFlightRef.current === work) refreshInFlightRef.current = null;
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
      deleteAccount,
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
      deleteAccount,
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
