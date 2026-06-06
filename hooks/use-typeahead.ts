import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { searchTransport } from '@/services/search-service';
import type { TypeaheadSuggestion } from '@/types/search';

/**
 * Live typeahead suggestions. Faster debounce than the main search
 * (120ms vs 300ms) because the surface is just text — no list re-render
 * cost. Each prefix change cancels the in-flight request via
 * AbortController so we never paint stale suggestions.
 *
 * `prefix` is the live input value; the hook fires its own typeahead
 * request and surfaces suggestions in the order the server returns.
 * Call `clear()` when the panel closes (blur) so leftover suggestions
 * don't flash the next time it opens.
 */

const DEBOUNCE_MS = 120;
const MIN_PREFIX_LENGTH = 1;

export type UseTypeaheadValue = {
  suggestions: TypeaheadSuggestion[];
  isLoading: boolean;
  clear: () => void;
};

export function useTypeahead(prefix: string): UseTypeaheadValue {
  const [suggestions, setSuggestions] = useState<TypeaheadSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const livePrefixRef = useRef<string>('');

  const run = useCallback(async (next: string) => {
    const trimmed = next.trim();
    livePrefixRef.current = trimmed;

    if (trimmed.length < MIN_PREFIX_LENGTH) {
      abortRef.current?.abort();
      abortRef.current = null;
      setSuggestions([]);
      setIsLoading(false);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    try {
      const response = await searchTransport.typeahead({
        prefix: trimmed,
        signal: controller.signal,
      });
      if (livePrefixRef.current !== trimmed) return;
      setSuggestions(response.suggestions);
    } catch (err) {
      const isAbort =
        (typeof DOMException !== 'undefined' && err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');
      if (isAbort) return;
      if (livePrefixRef.current !== trimmed) return;
      // Soft-fail — typeahead is purely additive UX; drop suggestions
      // silently rather than surface an error chrome.
      setSuggestions([]);
    } finally {
      if (livePrefixRef.current === trimmed) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void run(prefix);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [prefix, run]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    livePrefixRef.current = '';
    setSuggestions([]);
    setIsLoading(false);
  }, []);

  return useMemo(
    () => ({ suggestions, isLoading, clear }),
    [suggestions, isLoading, clear],
  );
}

export default useTypeahead;
