import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { ordersTransport } from '@/services/orders-api';
import type { AddressSearchQuery, AddressSuggestion } from '@/services/orders-service';

/** Long enough to skip the keystrokes in between: every search is a paid call upstream. */
const DEBOUNCE_MS = 350;
const MIN_STREET_LENGTH = 3;

export type AddressSuggestionsState = 'idle' | 'loading' | 'results' | 'empty' | 'error';

export type UseAddressSuggestionsValue = {
  state: AddressSuggestionsState;
  items: AddressSuggestion[];
  attribution: string | null;
};

/**
 * Addresses matching what the buyer has typed, from the backend. Pass null when there is
 * nothing to look for, such as once they have picked one.
 */
export function useAddressSuggestions(
  query: AddressSearchQuery | null,
): UseAddressSuggestionsValue {
  const wanted = query && query.street.trim().length >= MIN_STREET_LENGTH ? query : null;
  const wantedKey = wanted ? JSON.stringify(wanted) : null;
  const [searchedKey, setSearchedKey] = useState<string | null>(null);

  // A submitted search goes at once: the buyer has finished typing.
  const submitted = wanted?.mode === 'search';
  useEffect(() => {
    if (!wantedKey) {
      setSearchedKey(null);
      return;
    }
    if (submitted) {
      setSearchedKey(wantedKey);
      return;
    }
    const timer = setTimeout(() => setSearchedKey(wantedKey), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [wantedKey, submitted]);

  const result = useQuery({
    queryKey: ['addresses', 'suggestions', searchedKey],
    queryFn: ({ signal }) =>
      ordersTransport.searchAddresses(JSON.parse(searchedKey as string) as AddressSearchQuery, signal),
    enabled: !!searchedKey,
    // Failing is shown to the buyer, who can go on typing, which searches again.
    retry: false,
    staleTime: 60_000,
  });

  return useMemo<UseAddressSuggestionsValue>(() => {
    if (!wantedKey) return { state: 'idle', items: [], attribution: null };
    // Results for what was typed before are not shown as if they matched what is typed now,
    // whichever order the answers arrive in: each search has its own key, so a late answer
    // lands on its own key and an abandoned one is cancelled.
    if (wantedKey !== searchedKey || result.isFetching) {
      return { state: 'loading', items: [], attribution: null };
    }
    if (result.isError) return { state: 'error', items: [], attribution: null };
    const items = result.data?.items ?? [];
    return {
      state: items.length > 0 ? 'results' : 'empty',
      items,
      attribution: result.data?.attribution ?? null,
    };
  }, [wantedKey, searchedKey, result.isFetching, result.isError, result.data]);
}
