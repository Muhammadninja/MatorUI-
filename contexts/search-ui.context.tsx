import {
  createContext,
  useContext,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

/**
 * Cross-tree signal for "the user is currently interacting with search."
 *
 * Lives at the app root so the tab bar (in `app/(tabs)/_layout.tsx`) can
 * hide itself when the explore screen reports active search — either the
 * input is focused, or the screen is showing results. Keeps the search
 * surface uncluttered and gives results more vertical room.
 *
 * The explore screen owns the truth; the tab bar is the consumer.
 */
type SearchUIContextValue = {
  isSearchActive: boolean;
  setSearchActive: (active: boolean) => void;
};

const SearchUIContext = createContext<SearchUIContextValue | undefined>(undefined);

export function SearchUIProvider({ children }: PropsWithChildren) {
  const [isSearchActive, setSearchActive] = useState(false);

  const value = useMemo<SearchUIContextValue>(
    () => ({ isSearchActive, setSearchActive }),
    [isSearchActive],
  );

  return <SearchUIContext.Provider value={value}>{children}</SearchUIContext.Provider>;
}

export function useSearchUIContext() {
  const ctx = useContext(SearchUIContext);
  if (!ctx) throw new Error('useSearchUIContext must be used within a SearchUIProvider');
  return ctx;
}
