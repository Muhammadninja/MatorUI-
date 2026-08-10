import { X } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Dimensions, Modal } from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import {
  DEFAULT_FILTERS,
  hasActiveFilters,
  type PriceBucket,
  type RatingBucket,
  type SearchFilters,
} from '@/hooks/use-search';
import type { SearchResponse } from '@/types/search';
import { triggerHaptic } from '@/utils/haptics';

import FilterChip from './filter-chip';
import FilterSection from './filter-section';

export type SearchFiltersSheetProps = {
  visible: boolean;
  filters: SearchFilters;
  availableCategories: string[];
  /** Per-bucket match counts from the latest search response.
   *  When present, chips render "Label (N)". */
  facetCounts?: SearchResponse['facetCounts'];
  onApply: (filters: SearchFilters) => void;
  onClose: () => void;
};

/** Price band chips. Built from `t` so labels re-resolve on language
 *  change. `key` values are logic enums and stay untranslated. */
function buildPriceBuckets(t: (key: string) => string): { key: PriceBucket; label: string }[] {
  return [
    { key: 'any', label: t('search.priceAny') },
    { key: 'under_1k', label: t('search.priceUnder1k') },
    { key: '1k_to_10k', label: t('search.price1kTo10k') },
    { key: 'over_10k', label: t('search.priceOver10k') },
  ];
}

function buildRatingBuckets(t: (key: string) => string): { key: RatingBucket; label: string }[] {
  return [
    { key: 'any', label: t('search.ratingAny') },
    { key: '3_plus', label: t('search.rating3Plus') },
    { key: '4_plus', label: t('search.rating4Plus') },
  ];
}

/**
 * Basic facet sheet — category, price band, minimum rating. Edits stage
 * to a local draft and only emit on Apply, so canceling reverts cleanly.
 */
export default function SearchFiltersSheet({
  visible,
  filters,
  availableCategories,
  facetCounts,
  onApply,
  onClose,
}: SearchFiltersSheetProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const priceBuckets = useMemo(() => buildPriceBuckets(t), [t]);
  const ratingBuckets = useMemo(() => buildRatingBuckets(t), [t]);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  // Slide the panel up over a static (fading) backdrop so the screen underneath
  // stays put, rather than the whole modal window sliding up like a new screen.
  const translateY = useRef(new Animated.Value(Dimensions.get('window').height)).current;
  useEffect(() => {
    if (visible) {
      translateY.setValue(Dimensions.get('window').height);
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        tension: 90,
        friction: 12,
      }).start();
    }
  }, [visible, translateY]);

  const toggleCategory = (cat: string) => {
    triggerHaptic('selection');
    setDraft((d) => ({
      ...d,
      categories: d.categories.includes(cat)
        ? d.categories.filter((c) => c !== cat)
        : [...d.categories, cat],
    }));
  };

  const setPrice = (price: PriceBucket) => {
    triggerHaptic('selection');
    setDraft((d) => ({ ...d, price }));
  };

  const setRating = (minRating: RatingBucket) => {
    triggerHaptic('selection');
    setDraft((d) => ({ ...d, minRating }));
  };

  const handleApply = () => {
    triggerHaptic('selection');
    onApply(draft);
    onClose();
  };

  const handleReset = () => {
    triggerHaptic('selection');
    setDraft(DEFAULT_FILTERS);
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <AppView flex={1} justify="flex-end" style={{ backgroundColor: tokens.scrim }}>
        <AppPressableView style={{ flex: 1 }} onPress={onClose} accessibilityLabel={t('search.dismiss')} />
        <Animated.View style={{ width: '100%', transform: [{ translateY }] }}>
        <AppView
          roundedTop={28}
          safeArea="bottom"
          style={{
            width: '100%',
            backgroundColor: isDark ? tokens.card : tokens.white,
            borderTopWidth: 1,
            borderTopColor: tokens.border,
          }}
        >
          <AppView center pt={10} pb={6}>
            <AppView
              rounded={36}
              style={{ width: 36, height: 4, backgroundColor: tokens.divider }}
            />
          </AppView>

          <AppView row align="center" justify="space-between" px={20} pb="sm">
            <AppText textVariant="title" family="heading" weight="bold">
              {t('search.filters')}
            </AppText>
            <AppPressableView
              center
              rounded={36}
              onPress={onClose}
              androidRipple
              accessibilityLabel={t('search.closeFilters')}
              hitSlop={{ top: 6, right: 6, bottom: 6, left: 6 }}
              style={{
                width: 32,
                height: 32,
                borderWidth: 1,
                borderColor: tokens.border,
              }}
            >
              <X size={16} strokeWidth={2} color={tokens.text} />
            </AppPressableView>
          </AppView>

          <AppView px={20} pb="lg" gap={20}>
            {availableCategories.length > 0 ? (
              <FilterSection title={t('search.categorySection')}>
                <AppView row gap="sm" style={{ flexWrap: 'wrap' }}>
                  {availableCategories.map((cat) => {
                    const count = facetCounts?.categories?.[cat];
                    return (
                      <FilterChip
                        key={cat}
                        label={withCount(cat, count)}
                        selected={draft.categories.includes(cat)}
                        onPress={() => toggleCategory(cat)}
                      />
                    );
                  })}
                </AppView>
              </FilterSection>
            ) : null}

            <FilterSection title={t('search.priceSection')}>
              <AppView row gap="sm" style={{ flexWrap: 'wrap' }}>
                {priceBuckets.map((b) => {
                  const count = b.key === 'any' ? undefined : facetCounts?.price?.[b.key];
                  return (
                    <FilterChip
                      key={b.key}
                      label={withCount(b.label, count)}
                      selected={draft.price === b.key}
                      onPress={() => setPrice(b.key)}
                    />
                  );
                })}
              </AppView>
            </FilterSection>

            <FilterSection title={t('search.minRatingSection')}>
              <AppView row gap="sm" style={{ flexWrap: 'wrap' }}>
                {ratingBuckets.map((b) => {
                  const count =
                    b.key === 'any' ? undefined : facetCounts?.minRating?.[b.key];
                  return (
                    <FilterChip
                      key={b.key}
                      label={withCount(b.label, count)}
                      selected={draft.minRating === b.key}
                      onPress={() => setRating(b.key)}
                    />
                  );
                })}
              </AppView>
            </FilterSection>
          </AppView>

          <AppView
            row
            align="center"
            gap={10}
            px={20}
            py={14}
            style={{ borderTopWidth: 1, borderTopColor: tokens.divider }}
          >
            <AppButton
              title={t('search.reset')}
              kind="secondary"
              variant="outline"
              size="md"
              disabled={!hasActiveFilters(draft)}
              onPress={handleReset}
              containerStyle={{ flex: 1 }}
            />
            <AppButton
              title={t('search.apply')}
              kind="brand"
              size="md"
              onPress={handleApply}
              containerStyle={{ flex: 1 }}
            />
          </AppView>
        </AppView>
        </Animated.View>
      </AppView>
    </Modal>
  );
}

/** Suffix a chip label with its server-reported match count. Falls back
 *  to the plain label when no count exists (e.g., "Any" rows, or pre-
 *  search facets). Skips the suffix on count: 0 so the chip doesn't read
 *  as "noop available" — selecting it would yield 0 results, but at
 *  least it doesn't claim a falsehood. */
function withCount(label: string, count?: number): string {
  if (typeof count !== 'number') return label;
  if (count <= 0) return label;
  return `${label} · ${count}`;
}
