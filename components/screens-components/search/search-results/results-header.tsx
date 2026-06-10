import { SlidersHorizontal } from 'lucide-react-native';

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
  const { tokens } = useThemeContext();
  return (
    <AppView row align="center" justify="space-between" pb={10}>
      <AppText textVariant="bodyXs" colorName="gray400">
        {total} result{total === 1 ? '' : 's'} for “{query.trim()}”
      </AppText>
      <AppView row align="center" gap={10}>
        {__DEV__ && durationMs != null ? (
          <AppText textVariant="bodyXs" colorName="gray400">
            {durationMs} ms
          </AppText>
        ) : null}
        {onFilterPress ? (
          <AppPressableView
            center
            rounded={36}
            onPress={onFilterPress}
            androidRipple
            accessibilityLabel="Filters"
            style={{ width: 28, height: 28 }}
          >
            <SlidersHorizontal size={16} strokeWidth={2} color={tokens.text} />
            {hasActiveFilters ? (
              <AppView
                rounded={36}
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 2,
                  width: 6,
                  height: 6,
                  backgroundColor: tokens.text,
                }}
              />
            ) : null}
          </AppPressableView>
        ) : null}
      </AppView>
    </AppView>
  );
}
