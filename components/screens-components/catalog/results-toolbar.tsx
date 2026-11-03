import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import FitmentNote from '@/components/screens-components/catalog/fitment-note';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { CatalogSortBy } from '@/types/catalog-nav';
import { triggerHaptic } from '@/utils/haptics';

/** The sort orders a browse list offers. All three are server-side params on
 *  `GET /v1/catalog/parts`, so the whole catalog re-orders — not just the page
 *  already fetched. */
const SORTS: { key: CatalogSortBy; labelKey: string }[] = [
  { key: 'relevance', labelKey: 'catalog.sortRelevance' },
  { key: 'price_asc', labelKey: 'catalog.priceAsc' },
  { key: 'price_desc', labelKey: 'catalog.priceDesc' },
  { key: 'bestseller', labelKey: 'catalog.bestseller' },
];

export type ResultsToolbarProps = {
  /** Server total for the query. */
  count: number;
  sortBy: CatalogSortBy;
  onSortChange: (next: CatalogSortBy) => void;
};

/**
 * The bar above a result list: how many parts matched, what they're scoped to,
 * and how they're ordered.
 *
 * A browse screen that only prints "8 results" gives the shopper nothing to do
 * when the first eight aren't right. The sort row is the cheapest useful
 * control to add — every option is a real server param, so cheapest-first
 * re-orders the catalog rather than the twenty-four rows already on screen.
 */
export function ResultsToolbar({ count, sortBy, onSortChange }: ResultsToolbarProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView gap={10}>
      {/* Count and vehicle in ONE line — the fitment bar that used to sit above
          this is gone; the car is the tappable span at the end of it. */}
      <FitmentNote lead={t('catalog.partCount', { count })} size={13.5} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8, paddingRight: 8 }}
      >
        {SORTS.map((s) => {
          const active = sortBy === s.key;
          return (
            <AppPressableView
              key={s.key}
              onPress={() => {
                triggerHaptic('selection');
                onSortChange(s.key);
              }}
              androidRipple={false}
              pressedOpacity={0.85}
              rounded={8}
              px={14}
              py={8}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={{
                backgroundColor: active ? tokens.brand : tokens.surface,
                borderWidth: 1,
                borderColor: active ? tokens.brand : tokens.border,
              }}
            >
              <AppText
                family="accent"
                weight="bold"
                style={{ fontSize: 12.5, color: active ? tokens.onBrand : tokens.text }}
              >
                {t(s.labelKey)}
              </AppText>
            </AppPressableView>
          );
        })}
      </ScrollView>
    </AppView>
  );
}

export default ResultsToolbar;
