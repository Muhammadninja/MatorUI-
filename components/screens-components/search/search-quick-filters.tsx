import { useMemo } from 'react';
import { ScrollView } from 'react-native';

import { AppChip } from '@/components/shared/app-chip/app-chip';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import useQuickFilters from '@/hooks/use-quick-filters';
import { triggerHaptic } from '@/utils/haptics';

export type SearchQuickFiltersProps = {
  /**
   * The currently selected brand label (null = no chip active). This
   * component is fully controlled — the parent owns the selection state
   * so it can render an inline brand-parts section beside the row.
   */
  selected?: string | null;
  /**
   * Fires when a chip is tapped (label) or the active chip's clear-X is
   * pressed (null). The parent renders an inline brand-parts section
   * based on this value; the chip row stays purely presentational and
   * never reaches into search/state on its own.
   */
  onChange?: (filter: string | null) => void;
};

export function SearchQuickFilters({ selected, onChange }: SearchQuickFiltersProps) {
  const { scheme, tokens } = useThemeContext();
  // Backed by `useQuickFilters` so the chip row reflects whatever the
  // backend says is "popular this week". The hook guarantees a
  // non-empty `items` array (falls back to the bundled seed when the
  // API is loading / erroring / empty) so the row never blanks out.
  const { items } = useQuickFilters();

  const activeLabel = useMemo<string | null>(() => {
    if (!selected) return null;
    const s = selected.toLowerCase();
    return items.find((f) => f.label.toLowerCase() === s)?.label ?? null;
  }, [selected, items]);

  return (
    <AppView gap={12} px={8}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
      >
        <AppView row gap={10}>
          {items.map((filter) => {
            const isActive = activeLabel === filter.label;

            return (
              <AppChip
                key={filter.id}
                label={filter.label}
                size="md"
                kind={isActive ? 'secondary' : 'neutral'}
                variant="solid"
                selected={isActive}
                backgroundColorName={isActive ? 'secondary' : 'card'}
                labelColorName={isActive ? 'onSecondary' : undefined}
                onRemove={
                  isActive
                    ? () => {
                        triggerHaptic('selection');
                        onChange?.(null);
                      }
                    : undefined
                }
                removeIcon={{ name: 'xmark.circle.fill', colorName: 'onSecondary' }}
                style={
                  isActive
                    ? {
                        borderWidth: 1,
                        borderColor: scheme === 'dark' ? tokens.onSecondary : tokens.secondary,
                      }
                    : { borderWidth: 1, borderColor: tokens.border }
                }
                contentStyle={isActive ? { opacity: 0.98 } : undefined}
                onPress={() => {
                  if (isActive) return;
                  triggerHaptic('selection');
                  onChange?.(filter.label);
                }}
              />
            );
          })}
        </AppView>
      </ScrollView>
    </AppView>
  );
}

export default SearchQuickFilters;
