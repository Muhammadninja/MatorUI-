import { Filter, SearchX, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import MatorAIDiscoveryCard from '@/components/screens-components/catalog/mator-ai-discovery-card';

export type ResultsEmptyProps = {
  query: string;
  /** Server-suggested correction ("urbon" → "urban"). Tap to replace query. */
  didYouMean?: string | null;
  /** True when any filter chip is active. Drives empty-state copy. */
  hasActiveFilters?: boolean;
  /** Called when the user taps "Clear filters" from the empty state. */
  onClearFilters?: () => void;
  /** Called when the user taps the did-you-mean suggestion. */
  onUseSuggestion?: (suggestion: string) => void;
  filters?: Record<string, unknown>;
};

/**
 * Empty state with three flavours, in priority order:
 *  1) Server returned a spelling correction → tappable suggestion.
 *  2) Active filters are excluding everything → offer to clear.
 *  3) Plain "no match" → try a different word.
 */
export default function ResultsEmpty({
  query,
  didYouMean,
  hasActiveFilters,
  onClearFilters,
  onUseSuggestion,
  filters,
}: ResultsEmptyProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  // 1) Server returned a spelling correction — surface it as a tappable suggestion.
  if (didYouMean) {
    return (
      <AppView gap={14} px={16} pt={40} align="center">
        <Sparkles size={40} strokeWidth={2} color={tokens.brand} />
        <AppView gap={6} align="center">
          <AppText textVariant="bodySemibold" weight="semibold" align="center">
            {t('search.noMatchesFor', { query: query.trim() })}
          </AppText>
          <AppText textVariant="bodySm" colorName="textMuted" style={{ textAlign: 'center' }}>
            {t('search.didYouMean')}
          </AppText>
          <AppPressableView
            onPress={() => onUseSuggestion?.(didYouMean)}
            accessibilityLabel={t('search.useSuggestionA11y', { query: didYouMean })}
            androidRipple={false}
            style={{
              marginTop: 6,
              minHeight: 48,
              justifyContent: 'center',
              paddingHorizontal: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: tokens.controlBorder,
            }}
          >
            <AppText weight="semibold" style={{ color: tokens.text }}>
              {didYouMean}
            </AppText>
          </AppPressableView>
        </AppView>
        <AppView style={{ width: '100%' }}>
          <MatorAIDiscoveryCard
            source="search_zero_results"
            query={query}
            filters={filters}
            compact
          />
        </AppView>
      </AppView>
    );
  }

  // 2) Filters are excluding everything — distinguish from query-empty.
  if (hasActiveFilters) {
    return (
      <AppView gap={14} px={16} pt={40} align="center">
        <Filter size={40} strokeWidth={2} color={tokens.textMuted} />
        <AppView gap={4} align="center">
          <AppText textVariant="bodySemibold" weight="semibold" align="center">
            {t('search.noFilterMatchTitle')}
          </AppText>
          <AppText
            textVariant="bodySm"
            colorName="textMuted"
            style={{ textAlign: 'center', maxWidth: 280 }}
          >
            {t('search.noFilterMatchSubtitle')}
          </AppText>
        </AppView>
        {onClearFilters ? (
          <AppPressableView
            onPress={onClearFilters}
            accessibilityLabel={t('search.clearAllFilters')}
            androidRipple={false}
            style={{
              marginTop: 4,
              minHeight: 48,
              justifyContent: 'center',
              paddingHorizontal: 16,
              borderRadius: 12,
              backgroundColor: tokens.brand,
            }}
          >
            <AppText weight="semibold" style={{ color: tokens.onBrand }}>
              {t('search.clearFilters')}
            </AppText>
          </AppPressableView>
        ) : null}
        <AppView style={{ width: '100%' }}>
          <MatorAIDiscoveryCard
            source="filter_zero_results"
            query={query}
            filters={filters}
            compact
          />
        </AppView>
      </AppView>
    );
  }

  // 3) Plain "no match" — try a different word.
  return (
    <AppView gap={14} px={16} pt={40} align="center">
      <SearchX size={48} strokeWidth={2} color={tokens.textMuted} />
      <AppView gap={4} align="center">
        <AppText textVariant="bodySemibold" weight="semibold" align="center">
          {t('search.noMatchesTitle')}
        </AppText>
        <AppText textVariant="bodySm" colorName="textMuted" style={{ textAlign: 'center' }}>
          {t('search.noMatchesBody', { query: query.trim() })}
        </AppText>
      </AppView>
      <AppView style={{ width: '100%' }}>
        <MatorAIDiscoveryCard
          source="search_zero_results"
          query={query}
          filters={filters}
          compact
        />
      </AppView>
    </AppView>
  );
}
