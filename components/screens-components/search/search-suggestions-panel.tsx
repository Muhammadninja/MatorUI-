import { Clock, Search } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppListItem } from '@/components/shared/app-list-item';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { TypeaheadResponse } from '@/types/search';

import { RADIUS_SHEET } from './radii';

type TypeaheadSuggestion = TypeaheadResponse['suggestions'][number];

/**
 * Renders under the focused SmartSearchBar while the user is typing.
 * Two sections, both opt-in based on content:
 *  - Typeahead suggestions from the server (top).
 *  - Recents that prefix-match the current input (bottom), with a
 *    divider between sections and between each row.
 */

export type SearchSuggestionsPanelProps = {
  prefix: string;
  suggestions: TypeaheadSuggestion[];
  isLoadingSuggestions: boolean;
  /** Already filtered to prefix-matches by the parent. */
  recents: string[];
  onSelectSuggestion: (suggestion: TypeaheadSuggestion) => void;
  onSelectRecent: (query: string) => void;
  onRemoveRecent: (query: string) => void;
  onClearRecents: () => void;
};

export default function SearchSuggestionsPanel({
  prefix,
  suggestions,
  isLoadingSuggestions,
  recents,
  onSelectSuggestion,
  onSelectRecent,
  onRemoveRecent,
  onClearRecents,
}: SearchSuggestionsPanelProps) {
  const { tokens } = useThemeContext();

  const showTypeahead = suggestions.length > 0 || isLoadingSuggestions;
  const showRecents = recents.length > 0;
  const trimmedPrefix = prefix.trim();

  return (
    <AppView
      mx="md"
      mt="xs"
      rounded={RADIUS_SHEET}
      colorName="card"
      style={[
        styles.panel,
        { borderColor: tokens.border, shadowColor: tokens.text },
      ]}
    >
      {showTypeahead ? (
        suggestions.length === 0 ? (
          <AppView row align="center" gap={10} px={14} py={10}>
            {isLoadingSuggestions ? (
              <AppButton
                loading
                disabled
                title=""
                variant="ghost"
                kind="text"
                size="xs"
                rounded={999}
                accessibilityLabel="Loading suggestions"
                containerStyle={styles.loadingIndicatorContainer}
                contentStyle={styles.loadingIndicatorContent}
              />
            ) : (
              <Search size={16} strokeWidth={2} color={tokens.gray400} />
            )}
            <AppText textVariant="bodySm" colorName="gray400">
              {isLoadingSuggestions ? 'Searching…' : 'No suggestions'}
            </AppText>
          </AppView>
        ) : (
          <AppView py={6}>
            {suggestions.map((suggestion, index) => (
              <AppView key={`${suggestion.kind}:${suggestion.text}:${index}`}>
                {index > 0 ? (
                  <AppView
                    mx={14}
                    style={{ height: StyleSheet.hairlineWidth }}
                    colorName="border"
                  />
                ) : null}
                <AppListItem
                  size="sm"
                  title={suggestion.text}
                  titleVariant="bodySm"
                  titleStyle={styles.rowText}
                  leading={<Search size={16} strokeWidth={2} color={tokens.gray400} />}
                  rightAccessory={
                    suggestion.kind === 'product' ? (
                      <AppText textVariant="bodyXs" colorName="gray400">
                        Product
                      </AppText>
                    ) : null
                  }
                  divider={false}
                  onPress={() => onSelectSuggestion(suggestion)}
                  accessibilityLabel={`Search for ${suggestion.text}`}
                  contentStyle={styles.listItemContent}
                />
              </AppView>
            ))}
          </AppView>
        )
      ) : null}

      {showTypeahead && showRecents ? <AppView style={{ height: 1 }} colorName="border" /> : null}

      {showRecents ? (
        <AppView py={6}>
          <AppView row align="center" justify="space-between" px={14} py={6}>
            <AppText textVariant="bodyXs" colorName="gray400" weight="semibold">
              Recent · matches “{trimmedPrefix}”
            </AppText>
            <AppButton
              title="Clear all"
              onPress={onClearRecents}
              accessibilityLabel="Clear all recent searches"
              variant="ghost"
              kind="text"
              size="xs"
              hitSlop={8}
            />
          </AppView>
          {recents.map((query, index) => (
            <AppView key={query}>
              {index > 0 ? (
                <AppView
                  mx={14}
                  style={{ height: StyleSheet.hairlineWidth }}
                  colorName="border"
                />
              ) : null}
              <AppView row align="center">
                <AppListItem
                  size="sm"
                  title={query}
                  titleVariant="bodySm"
                  titleStyle={styles.rowText}
                  leading={<Clock size={16} strokeWidth={2} color={tokens.gray400} />}
                  style={styles.recentItem}
                  contentStyle={styles.listItemContent}
                  onPress={() => onSelectRecent(query)}
                  accessibilityLabel={`Search again for ${query}`}
                />
                <AppButton
                  onPress={() => onRemoveRecent(query)}
                  accessibilityLabel={`Remove ${query} from recents`}
                  title=""
                  startIcon={{
                    name: 'xmark.circle.fill',
                    family: 'symbol',
                    size: 14,
                    color: tokens.gray400,
                  }}
                  variant="ghost"
                  kind="text"
                  size="xs"
                  hitSlop={8}
                  containerStyle={styles.removeButtonContainer}
                  contentStyle={styles.removeButtonContent}
                />
              </AppView>
            </AppView>
          ))}
        </AppView>
      ) : null}
    </AppView>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    overflow: 'hidden',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 4,
  },
  rowText: {
    flex: 1,
  },
  listItemContent: {
    flex: 1,
  },
  recentItem: {
    flex: 1,
  },
  removeButtonContainer: {
    marginRight: 6,
  },
  removeButtonContent: {
    minWidth: 36,
    minHeight: 36,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  loadingIndicatorContainer: {
    minWidth: 20,
  },
  loadingIndicatorContent: {
    minWidth: 20,
    minHeight: 20,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
});
