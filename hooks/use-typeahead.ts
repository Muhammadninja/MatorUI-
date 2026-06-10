import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';

import { searchTransport } from '@/services/search-service';
import type { TypeaheadSuggestion } from '@/types/search';

/**
 * Live typeahead suggestions, debounced + cached.
 *
 * Pattern is: debounce the live prefix into a `query` state, drive a
 * React Query off that. RQ handles cancellation, caching, and dedupe
 * across re-mounts; the debounce keeps us from firing a request per
 * keystroke. Soft-fail — typeahead is purely additive UX, so we never
 * surface error chrome for it.
 */

const DEBOUNCE_MS = 120;
const MIN_PREFIX_LENGTH = 1;

export type UseTypeaheadValue = {
  suggestions: TypeaheadSuggestion[];
  isLoading: boolean;
  clear: () => void;
};

export function useTypeahead(prefix: string): UseTypeaheadValue {
  const [debouncedPrefix, setDebouncedPrefix] = useState('');

  useEffect(() => {
    const trimmed = prefix.trim();
    if (trimmed.length < MIN_PREFIX_LENGTH) {
      setDebouncedPrefix('');
      return;
    }
    const t = setTimeout(() => setDebouncedPrefix(trimmed), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [prefix]);

  const query = useQuery({
    queryKey: ['typeahead', debouncedPrefix] as const,
    queryFn: ({ signal }) =>
      searchTransport.typeahead({ prefix: debouncedPrefix, signal }),
    enabled: debouncedPrefix.length >= MIN_PREFIX_LENGTH,
    // Typeahead is additive UX — even a soft-fail just returns no
    // suggestions; never block the user with error chrome.
    retry: false,
    // Suggestions are highly time-sensitive; keep them fresh for only a
    // short window so re-typing the same prefix doesn't show stale data.
    staleTime: 30_000,
  });

  const clear = useCallback(() => setDebouncedPrefix(''), []);

  return useMemo<UseTypeaheadValue>(
    () => ({
      suggestions: query.data?.suggestions ?? [],
      isLoading: query.isFetching && debouncedPrefix.length >= MIN_PREFIX_LENGTH,
      clear,
    }),
    [query.data, query.isFetching, debouncedPrefix, clear],
  );
}

export default useTypeahead;
