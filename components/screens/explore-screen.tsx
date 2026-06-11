import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Keyboard } from 'react-native';

import SearchCatalogue from '@/components/screens-components/search/search-catalogue';
import SearchFiltersSheet from '@/components/screens-components/search/search-filters-sheet';
import SearchPromoBanner from '@/components/screens-components/search/search-promo-banner';
import SearchQuickFilters from '@/components/screens-components/search/search-quick-filters';
import SearchResults from '@/components/screens-components/search/search-results';
import SearchSuggestionsPanel from '@/components/screens-components/search/search-suggestions-panel';
import SearchTopFeatured from '@/components/screens-components/search/search-top-featured';
import SmartSearchBar from '@/components/screens-components/search/smart-search-bar';
import AppBlurView, { useBlurHeaderInset } from '@/components/shared/app-blur-view';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppView } from '@/components/shared/app-view';
import { useSearchUIContext } from '@/contexts/search-ui.context';
import useRecentSearches from '@/hooks/use-recent-searches';
import useSearch, { DEFAULT_FILTERS, hasActiveFilters } from '@/hooks/use-search';
import useTypeahead from '@/hooks/use-typeahead';
import type { TypeaheadSuggestion } from '@/types/search';

const SEARCH_BAR_HEIGHT = 52;
const FADE_HEIGHT = 24;

export default function ExploreScreen() {
  const search = useSearch();
  const recents = useRecentSearches();
  const typeahead = useTypeahead(search.query);
  const isSearching = search.state !== 'idle';
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  // Bumped on back-press so the SmartSearchBar's internal form remounts
  // with an empty value (the form is not externally controlled).
  const [formResetKey, setFormResetKey] = useState(0);
  // Currently selected quick-filter brand (null = none). Intentionally
  // decoupled from `useSearch` — tapping a brand chip should add an
  // inline preview section to THIS screen, not swap us out for the full
  // search-results view. The typed search bar still drives useSearch on
  // its own, completely independently.
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const { setSearchActive } = useSearchUIContext();

  // Signal "search is active" to the parent tab layout so the tab bar
  // can hide itself when the user has actually typed something OR
  // results are showing. Focusing the empty bar alone does NOT hide it
  // — that felt jumpy. Cleared on unmount so other tabs always see the
  // tab bar regardless of what state the explore tab was last in.
  const hasTypedQuery = search.query.trim().length > 0;
  useEffect(() => {
    setSearchActive(isSearching || hasTypedQuery);
    return () => setSearchActive(false);
  }, [isSearching, hasTypedQuery, setSearchActive]);
  // peek = -FADE_HEIGHT → content paddingTop = insets.top + headerHeight
  // + fadeHeight, i.e. the first scroll child starts BELOW the entire
  // blur strip so the search bar never sits on top of the quick-filter
  // chips.
  const topOffset = useBlurHeaderInset(SEARCH_BAR_HEIGHT, -FADE_HEIGHT);

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

  // Back-button handler: returns the screen to the idle landing.
  // Clears the search hook's query (which moves state → 'idle'),
  // dismisses keyboard + focus, and bumps the form-reset key so the
  // SmartSearchBar's internal text field also empties.
  const handleBackPress = useCallback(() => {
    search.setQuery('');
    Keyboard.dismiss();
    setIsFocused(false);
    setFormResetKey((k) => k + 1);
  }, [search]);

  const isSearchActive = isSearching || hasTypedQuery;

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
        // breaks recycling). The list itself extends to the top of the screen
        // so rows scroll UNDER the blur header — topInset is applied as
        // contentContainerStyle.paddingTop, not as a wrapping View.
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
          topInset={topOffset}
          onFilterPress={() => setFiltersVisible(true)}
        />
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingTop: topOffset, paddingBottom: 40 }}
          contentInsetAdjustmentBehavior="never"
        >
          <SearchQuickFilters selected={selectedBrand} onChange={setSelectedBrand} />
          {/* Picking a brand collapses the landing into a focused view:
           *  the catalogue and promo banner are hidden so the user's
           *  attention sits on the brand-specific Top Featured grid.
           *  Clearing the chip (X) restores the full layout. */}
          {selectedBrand ? null : <SearchCatalogue />}
          {selectedBrand ? null : (
            // SearchPromoBanner currently returns null while the campaigns
            // backend is being wired (see component for the re-enable
            // contract). Render call left in place so the section drops
            // back into the layout automatically when it starts returning
            // content.
            <SearchPromoBanner />
          )}
          <SearchTopFeatured brand={selectedBrand} />
        </AppScrollView>
      )}

      <AppBlurView contentHeight={SEARCH_BAR_HEIGHT} fadeHeight={FADE_HEIGHT}>
        <SmartSearchBar
          onPress={search.setQuery}
          onNotificationPress={() => router.push('/notifications')}
          isSearching={isSearching}
          onFocusChange={handleFocusChange}
          isSearchActive={isSearchActive}
          onBackPress={handleBackPress}
          formResetKey={formResetKey}
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
      </AppBlurView>

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

