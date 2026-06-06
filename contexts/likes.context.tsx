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

import { loadLikes, saveLikes } from '@/services/likes-storage';

/**
 * Likes / saved-items state.
 *
 *  - In-memory `Set<string>` of liked product ids.
 *  - Persisted to AsyncStorage so likes survive an app restart.
 *  - Tracks whether the user has *ever* liked something before so the
 *    Lists tab can offer first-like onboarding ("Save this to a list!")
 *    only once per device.
 */

type LikesContextValue = {
  likedIds: Set<string>;
  isLiked: (id: string) => boolean;
  /** Toggle the like state. Returns the NEW state (true = now liked). */
  toggleLike: (id: string) => boolean;
  /** True only for the moment between the first-ever like and when the
   *  user acknowledges the list-creation prompt. */
  shouldSuggestList: boolean;
  /** Mark the list-creation prompt as seen so it doesn't reappear. */
  acknowledgeListSuggestion: () => void;
  isHydrated: boolean;
};

const LikesContext = createContext<LikesContextValue | undefined>(undefined);

export function LikesProvider({ children }: PropsWithChildren) {
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set());
  const [hasEverLiked, setHasEverLiked] = useState(false);
  const [shouldSuggestList, setShouldSuggestList] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from disk once.
  useEffect(() => {
    let cancelled = false;
    loadLikes().then((stored) => {
      if (cancelled) return;
      if (stored) {
        setLikedIds(new Set(stored.ids));
        setHasEverLiked(stored.hasEverLiked);
      }
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Debounced write.
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isHydrated) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      void saveLikes({ ids: Array.from(likedIds), hasEverLiked });
    }, 250);
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [likedIds, hasEverLiked, isHydrated]);

  const isLiked = useCallback(
    (id: string) => likedIds.has(id),
    [likedIds],
  );

  const toggleLike = useCallback(
    (id: string): boolean => {
      let nextLiked = false;
      setLikedIds((current) => {
        const next = new Set(current);
        if (next.has(id)) {
          next.delete(id);
          nextLiked = false;
        } else {
          next.add(id);
          nextLiked = true;
        }
        return next;
      });
      // First-ever like triggers the list-creation suggestion.
      if (nextLiked && !hasEverLiked) {
        setHasEverLiked(true);
        setShouldSuggestList(true);
      }
      return nextLiked;
    },
    [hasEverLiked],
  );

  const acknowledgeListSuggestion = useCallback(() => {
    setShouldSuggestList(false);
  }, []);

  const value = useMemo<LikesContextValue>(
    () => ({
      likedIds,
      isLiked,
      toggleLike,
      shouldSuggestList,
      acknowledgeListSuggestion,
      isHydrated,
    }),
    [likedIds, isLiked, toggleLike, shouldSuggestList, acknowledgeListSuggestion, isHydrated],
  );

  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}

export function useLikesContext() {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error('useLikesContext must be used within a LikesProvider');
  return ctx;
}
