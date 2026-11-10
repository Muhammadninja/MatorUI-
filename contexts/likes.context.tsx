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
import { useUserContext } from '@/contexts/user.context';
import { createFavoritesTransport } from '@/services/favorites-api';
import { FavoritesSync, type FavoritesView } from '@/services/favorites-sync';
import { favoritesStorage } from '@/services/likes-storage';
import { getAuthRequestEpoch } from '@/services/api-client';
import { useE2EStartupMount } from '@/hooks/use-e2e-startup-trace';

type LikesContextValue = {
  likedIds: Set<string>;
  isLiked: (id: string) => boolean;
  toggleLike: (id: string) => boolean;
  shouldSuggestList: boolean;
  acknowledgeListSuggestion: () => void;
  isHydrated: boolean;
  isSyncing: boolean;
  pendingIds: Set<string>;
  syncError: string | null;
  retrySync: () => Promise<void>;
};

const LikesContext = createContext<LikesContextValue | undefined>(undefined);

export function LikesProvider({ children }: PropsWithChildren) {
  const { profile, isHydrating, isAuthenticated } = useUserContext();
  const ownerId = isAuthenticated ? profile?.id ?? null : null;
  const epoch = getAuthRequestEpoch();
  return (
    <LikesSessionProvider
      key={`${isHydrating ? 'auth-pending' : ownerId === null ? 'guest' : `user:${ownerId}`}:${epoch}`}
      ownerId={ownerId}
      authHydrating={!!isHydrating}
      epoch={epoch}
    >
      {children}
    </LikesSessionProvider>
  );
}

function LikesSessionProvider({
  children,
  ownerId,
  authHydrating,
  epoch,
}: PropsWithChildren<{ ownerId: string | null; authHydrating: boolean; epoch: number }>) {
  useE2EStartupMount('likes-controller');
  const engine = useRef<FavoritesSync | null>(null);
  const [view, setView] = useState<FavoritesView>(() => ({
    likedIds: new Set(),
    hasEverLiked: false,
    isHydrated: false,
    isSyncing: false,
    pendingIds: new Set(),
    error: null,
  }));

  useEffect(() => {
    if (authHydrating) return;
    const session = new FavoritesSync(
      ownerId,
      favoritesStorage,
      ownerId === null ? undefined : createFavoritesTransport(),
      undefined,
      undefined,
      () => epoch === getAuthRequestEpoch(),
    );
    engine.current = session;
    const unsubscribe = session.subscribe(setView);
    void session.start();
    return () => {
      unsubscribe();
      session.stop();
      if (engine.current === session) engine.current = null;
    };
  }, [ownerId, authHydrating, epoch]);

  const isLiked = useCallback((id: string) => view.likedIds.has(id), [view.likedIds]);
  const toggleLike = useCallback((id: string) => engine.current?.toggle(id) ?? false, []);
  const acknowledgeListSuggestion = useCallback(() => undefined, []);
  const retrySync = useCallback(() => engine.current?.retry() ?? Promise.resolve(), []);
  const value = useMemo<LikesContextValue>(
    () => ({
      likedIds: view.likedIds,
      isLiked,
      toggleLike,
      shouldSuggestList: false,
      acknowledgeListSuggestion,
      isHydrated: !authHydrating && view.isHydrated,
      isSyncing: view.isSyncing,
      pendingIds: view.pendingIds,
      syncError: view.error,
      retrySync,
    }),
    [view, authHydrating, isLiked, toggleLike, acknowledgeListSuggestion, retrySync],
  );
  return <LikesContext.Provider value={value}>{children}</LikesContext.Provider>;
}

export function useLikesContext() {
  const ctx = useContext(LikesContext);
  if (!ctx) throw new Error('useLikesContext must be used within a LikesProvider');
  return ctx;
}
