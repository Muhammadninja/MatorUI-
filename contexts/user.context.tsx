/**
 * UserContext — profile data layer.
 *
 * Replace the `MOCK_PROFILE` constant and the stub implementations of
 * `refreshProfile` / `updateProfile` with real API calls once the backend
 * endpoints are available. All consumers already handle `isLoading` and
 * `error` states so the UI will respond automatically.
 *
 * Expected API contract (see search-api-spec.txt for search endpoints):
 *   GET  /api/v1/me               → UserProfile
 *   PATCH /api/v1/me              → UserProfile  (partial update)
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

// ─── Types ───────────────────────────────────────────────────────────────────

export type UserProfile = {
  /** UUID from the backend */
  id: string;
  firstName: string;
  lastName: string;
  /** @example "m.abdullaev" */
  username: string;
  email: string;
  /** Optional short bio shown on profile */
  bio?: string;
  /** Fully-qualified URL to the avatar image, or null if none */
  avatarUrl?: string | null;
  isPremium: boolean;
  /** ISO 8601 date string */
  memberSince: string;
};

type UserContextValue = {
  profile: UserProfile | null;
  isLoading: boolean;
  error: string | null;
  /** Re-fetch the profile from the API */
  refreshProfile: () => Promise<void>;
  /**
   * Apply a partial update to the profile.
   * Optimistically updates local state; rolls back on failure.
   */
  updateProfile: (patch: Partial<Omit<UserProfile, 'id' | 'memberSince'>>) => Promise<void>;
};

// ─── Mock data (remove when real API is wired) ───────────────────────────────

const MOCK_PROFILE: UserProfile = {
  id: 'usr_mock_001',
  firstName: 'Muhammad',
  lastName: 'Abdullaev',
  username: 'm.abdullaev',
  email: 'muhammad@example.com',
  bio: 'Car enthusiast and performance parts collector.',
  avatarUrl: null,
  isPremium: true,
  memberSince: '2024-03-15T00:00:00Z',
};

// ─── Context ─────────────────────────────────────────────────────────────────

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: PropsWithChildren) {
  const [profile, setProfile] = useState<UserProfile | null>(MOCK_PROFILE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // TODO: replace with real API call
      // const data = await apiClient.get<UserProfile>('/api/v1/me');
      // setProfile(data);
      await Promise.resolve(); // no-op until API is ready
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load profile');
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
        // TODO: replace with real API call
        // await apiClient.patch('/api/v1/me', patch);
        await Promise.resolve(); // no-op until API is ready
      } catch (err) {
        // Roll back on failure
        setProfile(previous);
        setError(err instanceof Error ? err.message : 'Failed to update profile');
      }
    },
    [profile],
  );

  const value = useMemo<UserContextValue>(
    () => ({ profile, isLoading, error, refreshProfile, updateProfile }),
    [profile, isLoading, error, refreshProfile, updateProfile],
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
