import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';

import SearchResultRow from '@/components/screens-components/search/search-result-row';
import AppList from '@/components/shared/app-list';
import { AppView } from '@/components/shared/app-view';
import type { SearchResult, SearchState } from '@/types/search';

import FooterSpinner from './footer-spinner';
import { findCheapestId } from './helpers';
import ResultsEmpty from './results-empty';
import ResultsError from './results-error';
import ResultsHeader from './results-header';
import ResultsLoading from './results-loading';

export type SearchResultsProps = {
  state: SearchState;
  results: SearchResult[];
  total: number;
  durationMs: number | null;
  query: string;
  error: string | null;
  /** Server-suggested correction ("urbon" → "urban"). Tap to replace query. */
  didYouMean?: string | null;
  /** True when any filter chip is active. Drives empty-state copy. */
  hasActiveFilters?: boolean;
  /** Called when the user taps "Clear filters" from the empty state. */
  onClearFilters?: () => void;
  /** Called when the user taps the did-you-mean suggestion. */
  onUseSuggestion?: (suggestion: string) => void;
  /** Triggered when the list nears its end (pagination). */
  onEndReached?: () => void;
  /** Footer spinner while loading the next page. */
  isLoadingMore?: boolean;
};

/**
 * Search results surface. Owns only state routing + the success list;
 * every state (loading / empty / error) and list piece (header, footer)
 * lives in its own file under `./`.
 */
export default function SearchResults({
  state,
  results,
  total,
  durationMs,
  query,
  error,
  didYouMean,
  hasActiveFilters,
  onClearFilters,
  onUseSuggestion,
  onEndReached,
  isLoadingMore,
}: SearchResultsProps) {
  const cheapestId = useMemo(() => findCheapestId(results), [results]);

  const handleOpen = useCallback((result: SearchResult) => {
    router.push({
      pathname: '/item-detail/[id]',
      params: { id: result.id },
    });
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: SearchResult }) => (
      <AppView style={{ marginBottom: 16 }}>
        <SearchResultRow
          result={item}
          query={query}
          isCheapest={item.id === cheapestId}
          onPress={handleOpen}
        />
      </AppView>
    ),
    [query, cheapestId, handleOpen],
  );

  const keyExtractor = useCallback((item: SearchResult) => item.id, []);

  if (state === 'loading') {
    return <ResultsLoading query={query} />;
  }

  if (state === 'empty') {
    return (
      <ResultsEmpty
        query={query}
        didYouMean={didYouMean}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={onClearFilters}
        onUseSuggestion={onUseSuggestion}
      />
    );
  }

  if (state === 'error') {
    return <ResultsError error={error} />;
  }

  if (state === 'success') {
    return (
      <AppList<SearchResult>
        data={results}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        contentContainerStyle={{ paddingHorizontal: 12 }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <ResultsHeader query={query} total={total} durationMs={durationMs} />
        }
        ListFooterComponent={isLoadingMore ? <FooterSpinner /> : null}
      />
    );
  }

  // 'idle' — caller renders its own landing content.
  return null;
}
