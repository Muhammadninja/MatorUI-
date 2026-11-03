import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SearchFiltersSheet from '@/components/screens-components/search/search-filters-sheet';
import SearchResults from '@/components/screens-components/search/search-results';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { DEFAULT_FILTERS, hasActiveFilters, useSearch } from '@/hooks/use-search';
import { APP_FONTS } from '@/themes';

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
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
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
    setFilters,
    availableCategories,
    facetCounts,
    didYouMean,
    isLoadingMore,
    loadMore,
  } = useSearch();

  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  const openFilters = useCallback(() => setIsFilterSheetOpen(true), []);
  const closeFilters = useCallback(() => setIsFilterSheetOpen(false), []);

  const clearFilters = useCallback(() => setFilters(DEFAULT_FILTERS), [setFilters]);

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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <AppView
        flex={1}
        colorName="background"
        testID="search-screen"
        style={{ paddingTop: insets.top + 6 }}
      >
        {/* Header: back + search field */}
        <AppView row align="center" gap={10} px="lg" style={{ paddingBottom: 12 }}>
          <AppPressableView
            onPress={() => router.back()}
            center
            rounded={12}
            borderWidth={1}
            borderName="border"
            accessibilityRole="button"
            accessibilityLabel={t('search.back')}
            style={{ width: 48, height: 48 }}
          >
            <ArrowLeft size={22} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>

          <AppView
            row
            align="center"
            gap={10}
            flex={1}
            rounded={12}
            px="lg"
            colorName={scheme === 'dark' ? 'backgroundSecondary' : 'surface'}
            borderWidth={1}
            borderName="controlBorder"
            style={{ minHeight: 48 }}
          >
            <Search size={20} strokeWidth={2.2} color={tokens.textMuted} />
            <TextInput
              testID="search-input"
              value={query}
              onChangeText={setQuery}
              placeholder={t('search.inputPlaceholder')}
              placeholderTextColor={tokens.textMuted}
              accessibilityLabel={t('search.inputPlaceholder')}
              autoFocus
              autoCorrect={false}
              autoCapitalize="none"
              keyboardType="default"
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={{
                flex: 1,
                minWidth: 0,
                fontFamily: APP_FONTS.default,
                fontSize: 15,
                color: tokens.text,
                paddingVertical: 0,
              }}
            />
            {query.length > 0 ? (
              <AppPressableView
                onPress={() => setQuery('')}
                center
                rounded={999}
                accessibilityRole="button"
                accessibilityLabel={t('search.clearSearch')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ width: 28, height: 28 }}
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
          <AppView flex={1} center px="xl" gap={10} style={{ paddingBottom: insets.bottom }}>
            <Search size={28} strokeWidth={2} color={tokens.textMuted} />
            <AppText
              family="default"
              style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center' }}
            >
              {t('search.idleHint')}
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
              onFilterPress={openFilters}
              onClearFilters={clearFilters}
            />
          </AppView>
        )}

        {/* Facet sheet. Chips render the localized `categories[].name` but stage
          `categories[].id` into the draft, so a selection survives a language
          switch and round-trips back into `filters.categories`. `setFilters`
          re-runs the current query as soon as the draft is applied. */}
        <SearchFiltersSheet
          visible={isFilterSheetOpen}
          filters={filters}
          availableCategories={availableCategories}
          facetCounts={facetCounts}
          onApply={setFilters}
          onClose={closeFilters}
        />
      </AppView>
    </KeyboardAvoidingView>
  );
}
