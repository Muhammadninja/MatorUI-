import { useState } from 'react';
import { ScrollView } from 'react-native';

import { AppChip } from '@/components/shared/app-chip/app-chip';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const QUICK_FILTERS = [
  'Trending now',
  'Electric cars',
  'Under $20k',
  'SUV deals',
  'Nearby garages',
  'AI picks',
] as const;

export function SearchQuickFilters() {
  const [activeFilter, setActiveFilter] = useState<(typeof QUICK_FILTERS)[number] | null>(
    'Trending now',
  );
  const { scheme, tokens } = useThemeContext();

  return (
      <AppView gap={12} px={8}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 20 }}
      >
        <AppView row gap={10}>
          {QUICK_FILTERS.map((filter) => {
            const isActive = activeFilter === filter;

            return (
              <AppChip
                key={filter}
                label={filter}
                size="md"
                kind={isActive ? 'secondary' : 'neutral'}
                variant="solid"
                selected={isActive}
                backgroundColorName={isActive ? 'secondary' : 'card'}
                labelColorName={isActive ? 'onSecondary' : undefined}
                onRemove={isActive ? () => setActiveFilter(null) : undefined}
                removeIcon={{ name: 'xmark.circle.fill', colorName: 'white' }}
                style={
                  isActive
                    ? {
                        borderWidth: 1,
                        borderColor: scheme === 'dark' ? tokens.onSecondary : tokens.secondary,
                      }
                    : { borderWidth: 1, borderColor: tokens.border }
                }
                contentStyle={isActive ? { opacity: 0.98 } : undefined}
                onPress={() => setActiveFilter(filter)}
              />
            );
          })}
        </AppView>
      </ScrollView>
    </AppView>
  );
}

export default SearchQuickFilters;
