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

import { setUnauthorizedHandler } from '@/services/api-client';
import {
  authTransport,
  type SignInInput,
  type SignUpInput,
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
  signIn: (input: SignInInput) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
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

  const signIn = useCallback(
    async (input: SignInInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await authTransport.signIn(input);
        await persistSession(result.session);
        setProfile(result.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-in failed.');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [persistSession],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await authTransport.signUp(input);
        await persistSession(result.session);
        setProfile(result.user);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sign-up failed.');
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
      // Optimistic update
      setProfile((prev) => (prev ? { ...prev, ...patch } : prev));
      try {
        const updated = await userTransport.updateMe(patch);
        setProfile(updated);
      } catch (err) {
        setProfile(previous);
        setError(err instanceof Error ? err.message : 'Failed to update profile.');
        throw err;
      }
    },
    [profile],
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
        } catch {
          // If `/me` fails on cold boot (network, expired token), drop
          // the session — the user lands on the guest experience and
          // can sign in again.
          if (!cancelled) {
            await persistSession(null);
          }
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
      signIn,
      signUp,
      signOut,
    }),
    [
      profile,
      isHydrating,
      isLoading,
      error,
      refreshProfile,
      updateProfile,
      signIn,
      signUp,
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
