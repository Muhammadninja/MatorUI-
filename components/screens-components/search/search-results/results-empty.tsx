import { Filter, SearchX, Sparkles } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

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
}: ResultsEmptyProps) {
  const { tokens } = useThemeContext();

  // 1) Server returned a spelling correction — surface it as a tappable suggestion.
  if (didYouMean) {
    return (
      <AppView gap={14} px={16} pt={40} align="center">
        <Sparkles size={40} strokeWidth={1.6} color={tokens.text} />
        <AppView gap={6} align="center">
          <AppText textVariant="bodySemibold">No matches for “{query.trim()}”</AppText>
          <AppText textVariant="bodySm" colorName="gray400" style={{ textAlign: 'center' }}>
            Did you mean…
          </AppText>
          <AppPressableView
            onPress={() => onUseSuggestion?.(didYouMean)}
            accessibilityLabel={`Use suggestion ${didYouMean}`}
            androidRipple={false}
            style={{
              marginTop: 6,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 36,
              borderWidth: 1,
              borderColor: tokens.text,
            }}
          >
            <AppText weight="semibold" style={{ color: tokens.text }}>
              {didYouMean}
            </AppText>
          </AppPressableView>
        </AppView>
      </AppView>
    );
  }

  // 2) Filters are excluding everything — distinguish from query-empty.
  if (hasActiveFilters) {
    return (
      <AppView gap={14} px={16} pt={40} align="center">
        <Filter size={40} strokeWidth={1.6} color={tokens.gray400} />
        <AppView gap={4} align="center">
          <AppText textVariant="bodySemibold">No results match your filters</AppText>
          <AppText
            textVariant="bodySm"
            colorName="gray400"
            style={{ textAlign: 'center', maxWidth: 280 }}
          >
            Try removing one to widen the search.
          </AppText>
        </AppView>
        {onClearFilters ? (
          <AppPressableView
            onPress={onClearFilters}
            accessibilityLabel="Clear all filters"
            androidRipple={false}
            style={{
              marginTop: 4,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 36,
              backgroundColor: tokens.text,
            }}
          >
            <AppText weight="semibold" style={{ color: tokens.background }}>
              Clear filters
            </AppText>
          </AppPressableView>
        ) : null}
      </AppView>
    );
  }

  // 3) Plain "no match" — try a different word.
  return (
    <AppView gap={14} px={16} pt={40} align="center">
      <SearchX size={48} strokeWidth={1.6} color={tokens.gray400} />
      <AppView gap={4} align="center">
        <AppText textVariant="bodySemibold">No matches</AppText>
        <AppText textVariant="bodySm" colorName="gray400" style={{ textAlign: 'center' }}>
          Nothing found for “{query.trim()}”. Try a different word or check the spelling.
        </AppText>
      </AppView>
    </AppView>
  );
}
