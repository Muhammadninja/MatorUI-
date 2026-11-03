import { SlidersHorizontal } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type ResultsHeaderProps = {
  query: string;
  total: number;
  durationMs: number | null;
  /** Opens the filter sheet. When omitted, the filter button is hidden. */
  onFilterPress?: () => void;
  /** Shows a small dot on the filter button when any filter is set. */
  hasActiveFilters?: boolean;
};

/** List header: result count for the query, dev-only timing, and the
 *  filter affordance. Filters live here (not in the search bar) so the
 *  search field has room to breathe on small screens. */
export default function ResultsHeader({
  query,
  total,
  durationMs,
  onFilterPress,
  hasActiveFilters,
}: ResultsHeaderProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  return (
    <AppView row align="center" justify="space-between" px="lg" gap="md">
      <AppText textVariant="bodyXs" colorName="textMuted" numberOfLines={2} style={{ flex: 1 }}>
        {t('search.resultCount', { count: total, query: query.trim() })}
      </AppText>
      <AppView row align="center" gap={10}>
        {__DEV__ && durationMs != null ? (
          <AppText textVariant="bodyXs" colorName="textMuted">
            {durationMs} ms
          </AppText>
        ) : null}
        {onFilterPress ? (
          <AppPressableView
            center
            rounded={36}
            onPress={onFilterPress}
            androidRipple
            accessibilityLabel={t('search.filters')}
            accessibilityRole="button"
            style={{ width: 48, height: 48 }}
          >
            <SlidersHorizontal size={20} strokeWidth={2} color={tokens.brand} />
            {hasActiveFilters ? (
              <AppView
                rounded={36}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  width: 6,
                  height: 6,
                  backgroundColor: tokens.brand,
                }}
              />
            ) : null}
          </AppPressableView>
        ) : null}
      </AppView>
    </AppView>
  );
}
