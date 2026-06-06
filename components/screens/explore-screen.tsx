import MaskedView from '@react-native-masked-view/masked-view';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard, Platform, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchCatalogue from '@/components/screens-components/search/search-catalogue';
import SearchFiltersSheet from '@/components/screens-components/search/search-filters-sheet';
import SearchPromoBanner from '@/components/screens-components/search/search-promo-banner';
import SearchQuickFilters from '@/components/screens-components/search/search-quick-filters';
import SearchResults from '@/components/screens-components/search/search-results';
import SearchSuggestionsPanel from '@/components/screens-components/search/search-suggestions-panel';
import SearchTopFeatured from '@/components/screens-components/search/search-top-featured';
import SmartSearchBar from '@/components/screens-components/search/smart-search-bar';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import useRecentSearches from '@/hooks/use-recent-searches';
import useSearch, { DEFAULT_FILTERS, hasActiveFilters } from '@/hooks/use-search';
import useTypeahead from '@/hooks/use-typeahead';
import type { TypeaheadSuggestion } from '@/types/search';

const SEARCH_BAR_HEIGHT = 52;
const FADE_HEIGHT = 24;
const FADE_STEPS = [0.9, 0.75, 0.6, 0.45, 0.3, 0.18, 0.08, 0.02];

export default function ExploreScreen() {
  const insets = useSafeAreaInsets();
  const { scheme, tokens } = useThemeContext();
  const search = useSearch();
  const recents = useRecentSearches();
  const typeahead = useTypeahead(search.query);
  const isSearching = search.state !== 'idle';
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // Push content below the entire blur strip (safe area + bar + fade) so the
  // quick-filter chips at the top of the scroll aren't obscured by the search.
  const topOffset = insets.top + SEARCH_BAR_HEIGHT + FADE_HEIGHT;
  // expo-blur on Android renders a translucent gray fallback (no real backdrop
  // blur), which shows as an ugly gray shadow around the search bar. Fall back
  // to a solid theme-bg fill on Android — the bottom fade gradient still works
  // because the MaskedView mask is independent of the fill content.
  const isAndroid = Platform.OS === 'android';

  const filtersActive = hasActiveFilters(search.filters);
  const clearFilters = useCallback(() => {
    search.setFilters(DEFAULT_FILTERS);
  }, [search]);

  // Persist any committed query (one that produced results OR a real
  // "no matches" answer from the server) into recents. Loading/idle/error
  // are explicitly excluded — we don't want to remember a typo the user
  // never finished typing or a network blip.
  //
  // CRITICAL: depend on `recents.add` (a stable useCallback) — NOT on
  // `recents` itself. The hook returns a fresh object every render, so
  // depending on `recents` would re-fire the effect every render, which
  // would call add() again, which would push state again, which would
  // re-render — a tight infinite loop that surfaces inside FlashList as
  // "Maximum update depth exceeded".
  const addRecent = recents.add;
  useEffect(() => {
    if (search.state === 'success' || search.state === 'empty') {
      if (search.query.trim().length >= 2) {
        addRecent(search.query);
      }
    }
  }, [search.state, search.query, addRecent]);

  const handleSelectSuggestion = useCallback(
    (suggestion: TypeaheadSuggestion) => {
      search.setQuery(suggestion.text);
      search.flush();
      Keyboard.dismiss();
      setIsFocused(false);
    },
    [search],
  );

  const handleSelectRecent = useCallback(
    (query: string) => {
      search.setQuery(query);
      search.flush();
      Keyboard.dismiss();
      setIsFocused(false);
    },
    [search],
  );

  const handleFocusChange = useCallback(
    (focused: boolean) => {
      setIsFocused(focused);
      if (!focused) typeahead.clear();
    },
    [typeahead],
  );

  // Show the suggestions panel only when the user is actively typing.
  // Empty input + focused → no panel at all (avoids the "second search
  // bar" feel of a card sitting under the bar with no content).
  // Recents are filtered to prefix-matches against the live input so the
  // list stays relevant to what the user is in the middle of typing.
  const trimmedPrefix = search.query.trim();
  const matchingRecents = useMemo(() => {
    if (trimmedPrefix.length === 0) return [];
    const key = trimmedPrefix.toLowerCase();
    return recents.queries.filter((q) => q.toLowerCase().includes(key));
  }, [recents.queries, trimmedPrefix]);

  const hasTypeaheadContent = typeahead.suggestions.length > 0 || typeahead.isLoading;
  const hasRecentsContent = matchingRecents.length > 0;
  const showSuggestions =
    isFocused &&
    !isSearching &&
    trimmedPrefix.length > 0 &&
    (hasTypeaheadContent || hasRecentsContent);

  return (
    <AppView flex={1} colorName="background">
      {isSearching ? (
        // SearchResults renders a virtualized list when state === 'success'.
        // It MUST live outside AppScrollView (virtualized-list-in-ScrollView
        // breaks recycling). Empty/loading/error branches render plain views,
        // so we wrap them with a top inset using a wrapping View.
        <View style={{ flex: 1, paddingTop: topOffset }}>
          <SearchResults
            state={search.state}
            results={search.results}
            total={search.total}
            durationMs={search.durationMs}
            query={search.query}
            error={search.error}
            didYouMean={search.didYouMean}
            hasActiveFilters={filtersActive}
            onClearFilters={clearFilters}
            onUseSuggestion={search.setQuery}
            onEndReached={search.loadMore}
            isLoadingMore={search.isLoadingMore}
          />
        </View>
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: topOffset, paddingBottom: 40 }}
          contentInsetAdjustmentBehavior="never"
        >
          <SearchQuickFilters />
          <SearchCatalogue />
          <SearchPromoBanner />
          <SearchTopFeatured />
        </AppScrollView>
      )}

      <MaskedView
        style={[styles.blurContainer, { height: insets.top + SEARCH_BAR_HEIGHT + FADE_HEIGHT }]}
        maskElement={
          <View style={styles.maskWrapper}>
            <View style={styles.maskSolid} />
            <View style={styles.maskFade}>
              {FADE_STEPS.map((opacity, i) => (
                <View key={i} style={[styles.fadeBand, { opacity }]} />
              ))}
            </View>
          </View>
        }
      >
        {isAndroid ? (
          <View style={[styles.blurFill, { backgroundColor: tokens.background }]} />
        ) : (
          <BlurView
            tint={scheme === 'dark' ? 'dark' : 'light'}
            intensity={80}
            style={styles.blurFill}
          />
        )}
      </MaskedView>

      <View
        pointerEvents="box-none"
        style={[styles.searchBarOverlay, { paddingTop: insets.top }]}
      >
        <SmartSearchBar
          onPress={search.setQuery}
          onNotificationPress={() => router.push('/notifications')}
          isSearching={isSearching}
          onFilterPress={() => setFiltersVisible(true)}
          hasActiveFilters={filtersActive}
          onFocusChange={handleFocusChange}
        />
        {showSuggestions ? (
          <SearchSuggestionsPanel
            prefix={search.query}
            suggestions={typeahead.suggestions}
            isLoadingSuggestions={typeahead.isLoading}
            recents={matchingRecents}
            onSelectSuggestion={handleSelectSuggestion}
            onSelectRecent={handleSelectRecent}
            onRemoveRecent={recents.remove}
            onClearRecents={recents.clear}
          />
        ) : null}
      </View>

      <SearchFiltersSheet
        visible={filtersVisible}
        filters={search.filters}
        availableCategories={search.availableCategories}
        facetCounts={search.facetCounts}
        onApply={search.setFilters}
        onClose={() => setFiltersVisible(false)}
      />
    </AppView>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  blurFill: {
    flex: 1,
  },
  searchBarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  maskWrapper: {
    flex: 1,
  },
  maskSolid: {
    flex: 1,
    backgroundColor: 'black',
  },
  maskFade: {
    height: FADE_HEIGHT,
    flexDirection: 'column',
  },
  fadeBand: {
    flex: 1,
    backgroundColor: 'black',
  },
});
