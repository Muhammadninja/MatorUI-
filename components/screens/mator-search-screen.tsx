import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, X } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Keyboard, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchResults from '@/components/screens-components/search/search-results';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { hasActiveFilters, useSearch } from '@/hooks/use-search';

/**
 * Universal search over the REAL search backend (`POST /v1/search` via
 * `useSearch` → `search-service`), with relevance ranking, facet counts,
 * did-you-mean, and cursor pagination. Results render through the
 * purpose-built `SearchResults` surface (`SearchResultRow` cards). Opened
 * from the Explore search entry; an optional `q` param seeds the query
 * (e.g. a "Certified Batteries" placement deep-links here pre-filled).
 *
 * This replaced the old `useCatalogList({ search })` wiring, which only
 * text-filtered `/v1/catalog/parts` and never touched the dedicated search
 * service.
 */
export default function MatorSearchScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { q: initialQuery } = useLocalSearchParams<{ q?: string }>();

  const {
    query,
    setQuery,
    state,
    results,
    total,
    durationMs,
    error,
    filters,
    didYouMean,
    isLoadingMore,
    loadMore,
  } = useSearch();

  // Seed from the optional `q` deep-link param exactly once on mount.
  const seededRef = useRef(false);
  useEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (initialQuery && initialQuery.trim().length > 0) {
      setQuery(initialQuery);
    }
  }, [initialQuery, setQuery]);

  return (
    <AppView flex={1} colorName="card" testID="search-screen" style={{ paddingTop: insets.top + 6 }}>
      {/* Header: back + search field */}
      <AppView row align="center" gap={10} px="lg" style={{ paddingBottom: 12 }}>
        <AppPressableView
          onPress={() => router.back()}
          center
          rounded={12}
          borderWidth={1}
          borderName="border"
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={{ width: 40, height: 40 }}
        >
          <ArrowLeft size={22} strokeWidth={2.2} color={tokens.text} />
        </AppPressableView>

        <AppView
          row
          align="center"
          gap={10}
          flex={1}
          rounded={14}
          px={14}
          colorName="backgroundSecondary"
          borderWidth={1}
          borderName="border"
          style={{ height: 44 }}
        >
          <Search size={20} strokeWidth={2.2} color={tokens.textMuted} />
          <TextInput
            testID="search-input"
            value={query}
            onChangeText={setQuery}
            placeholder="Search parts, brands, OEM #"
            placeholderTextColor={tokens.textMuted}
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            keyboardType="default"
            returnKeyType="search"
            onSubmitEditing={() => Keyboard.dismiss()}
            style={{ flex: 1, fontSize: 15, color: tokens.text, paddingVertical: 0 }}
          />
          {query.length > 0 ? (
            <AppPressableView
              onPress={() => setQuery('')}
              center
              rounded={999}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <X size={18} strokeWidth={2.2} color={tokens.textMuted} />
            </AppPressableView>
          ) : null}
        </AppView>
      </AppView>

      {/* Results — the search hook stays 'idle' until the query is long enough
          (≥2 chars); render the landing hint in that state, delegate every
          other state (loading / success / empty / error) to SearchResults. */}
      {state === 'idle' ? (
        <AppView flex={1} center px="xl" gap={10}>
          <Search size={28} strokeWidth={2} color={tokens.textMuted} />
          <AppText
            family="default"
            style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center' }}
          >
            Search parts, brands, or OEM numbers.
          </AppText>
        </AppView>
      ) : (
        <AppView flex={1}>
          <SearchResults
            state={state}
            results={results}
            total={total}
            durationMs={durationMs}
            query={query}
            error={error}
            didYouMean={didYouMean}
            hasActiveFilters={hasActiveFilters(filters)}
            onUseSuggestion={setQuery}
            onEndReached={loadMore}
            isLoadingMore={isLoadingMore}
          />
        </AppView>
      )}
    </AppView>
  );
}
