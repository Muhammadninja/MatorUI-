import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, ArrowLeft, PackageOpen, Search, X } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CatalogListFooter from '@/components/screens-components/catalog/catalog-list-footer';
import ProductRow, {
  productCellStyle,
  useProductGridColumns,
} from '@/components/screens-components/catalog/product-row';
import FitmentNote from '@/components/screens-components/catalog/fitment-note';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { CATALOG_PAGE_SIZE, useCatalogInfiniteList } from '@/hooks/use-catalog-list';
import { useToast } from '@/hooks/use-toast';
import type { CatalogItem } from '@/services/catalog-service';
import type { CatalogSortBy, FilterState } from '@/types/catalog-nav';
import { triggerHaptic } from '@/utils/haptics';
import { openItemDetail } from '@/utils/nav';

const DEFAULT_FILTER: FilterState = {
  brands: [],
  regions: [],
  oemOnly: false,
  gmOnly: false,
  sortBy: 'relevance',
};

/** A part brand as its chip knows it. */
type BrandChoice = FilterState['brands'][number];

/**
 * Catalog parts (Stage 3) — the parts list for a chosen system + vehicle.
 * Fixed header (back + search) over a single horizontally-scrolling row of
 * QUICK FILTERS — sort, GM/OEM flags, region, and brand chips that each apply
 * on tap. There is no filter bottom sheet: every refinement is a one-tap chip.
 * Every chip goes to the backend, so it filters the whole catalogue and the
 * list starts again from page 1. The list loads a page at a time as the
 * shopper nears its end.
 */
export default function CatalogPartsScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  // `categoryId` is the real backend category id (e.g. "cat_engine_belts")
  // handed down from the unified /v1/categories systems screen; `categoryLabel`
  // is its display name. These flow straight into the catalog filter so the
  // seller-selected system maps 1:1 to the listing.
  const { categoryId, categoryLabel, make, model, certified, q } = useLocalSearchParams<{
    categoryId?: string;
    categoryLabel?: string;
    make?: string;
    model?: string;
    /** Premium "MATOR Certified" preset — filters by part quality across ALL
     *  systems (not a car-system category): 'oem' → all OEM parts, 'gm' → all GM. */
    certified?: 'oem' | 'gm';
    /** Optional initial search term (e.g. a certified "Batteries" collection). */
    q?: string;
  }>();
  const vehicleLabel = [make, model].filter(Boolean).join(' ');

  const [search, setSearch] = useState(q ?? '');
  // Debounced copy of the search text. Free-text search now goes to the backend
  // (so it filters the WHOLE catalog, not just the fetched page); debounce keeps
  // us from firing a request on every keystroke.
  const [debouncedSearch, setDebouncedSearch] = useState(q ?? '');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(id);
  }, [search]);
  // Seed the filter from a certified preset so the premium catalogue opens
  // already scoped to all-OEM or all-GM parts.
  const [filter, setFilter] = useState<FilterState>(() => ({
    ...DEFAULT_FILTER,
    oemOnly: certified === 'oem',
    gmOnly: certified === 'gm',
  }));

  // Quick-filter mutators — every chip applies immediately (no draft, no Apply).
  const toggleSort = (s: CatalogSortBy) =>
    setFilter((f) => ({ ...f, sortBy: f.sortBy === s ? 'relevance' : s }));
  const toggleBrand = (b: BrandChoice) =>
    setFilter((f) => ({
      ...f,
      brands: f.brands.some((x) => x.id === b.id)
        ? f.brands.filter((x) => x.id !== b.id)
        : [...f.brands, b],
    }));

  // All catalog filtering/sorting/search happen SERVER-SIDE so they act on the
  // whole catalog (not just the fetched pages) and the count is accurate:
  // category, vehicle fit, brand, region, GM, OEM, sort, and free-text search
  // all go to the backend, and changing any of them starts the list again from
  // page 1.
  const {
    state,
    items,
    total,
    brandFacets,
    isRefreshing,
    refresh,
    isLoadingMore,
    loadMoreError,
    loadMore,
    retryLoadMore,
  } = useCatalogInfiniteList({
    pageSize: CATALOG_PAGE_SIZE,
    category: categoryId || undefined,
    make: make || undefined,
    model: model || undefined,
    search: debouncedSearch || undefined,
    sortBy: filter.sortBy,
    // In one order whichever order they were tapped in: a set of brands is
    // one list, one cache entry.
    brands: filter.brands.length ? filter.brands.map((b) => b.id).sort() : undefined,
    regions: filter.regions.length ? filter.regions : undefined,
    gmOnly: filter.gmOnly || undefined,
    oemOnly: filter.oemOnly || undefined,
  });

  const listRef = useRef<FlashListRef<CatalogItem>>(null);

  // Every chip re-queries the catalog, so the rows underneath are a different
  // list. Holding the old scroll offset would land the shopper somewhere in the
  // middle of results they never scrolled past — the page appearing to lurch.
  const resetScroll = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  const { addItem } = useCartContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  // The brand chips: every brand the server counts across the whole result —
  // not the brands of the rows loaded so far — plus any picked brand the other
  // filters now leave with no parts, so a pick can always be seen and undone.
  const brands = useMemo<BrandChoice[]>(() => {
    const byId = new Map(brandFacets.map((b) => [b.id, b.name]));
    for (const b of filter.brands) if (!byId.has(b.id)) byId.set(b.id, b.name);
    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [brandFacets, filter.brands]);

  const activeFilterCount =
    filter.brands.length +
    filter.regions.length +
    (filter.oemOnly ? 1 : 0) +
    (filter.gmOnly ? 1 : 0) +
    (filter.sortBy !== 'relevance' ? 1 : 0);

  // The full quick-filter row: sort → flags → regions → brands, each a one-tap
  // chip. Replaces the old bottom sheet entirely.
  const chips = useMemo<QuickChip[]>(() => {
    const list: QuickChip[] = [
      {
        key: 'sort:price_asc',
        label: t('catalog.priceAsc'),
        active: filter.sortBy === 'price_asc',
        onPress: () => toggleSort('price_asc'),
      },
      {
        key: 'sort:price_desc',
        label: t('catalog.priceDesc'),
        active: filter.sortBy === 'price_desc',
        onPress: () => toggleSort('price_desc'),
      },
      {
        key: 'gm',
        label: t('catalog.chipGm'),
        active: filter.gmOnly,
        onPress: () => setFilter((s) => ({ ...s, gmOnly: !s.gmOnly })),
      },
      {
        key: 'oem',
        label: t('catalog.chipOemQuality'),
        active: filter.oemOnly,
        onPress: () => setFilter((s) => ({ ...s, oemOnly: !s.oemOnly })),
      },
    ];
    for (const b of brands) {
      list.push({
        key: `brand:${b.id}`,
        label: b.name,
        active: filter.brands.some((x) => x.id === b.id),
        onPress: () => toggleBrand(b),
        testID: `filter-brand-${b.name}`,
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, brands]);

  const openItem = useCallback((it: CatalogItem) => {
    openItemDetail(it.id);
  }, []);

  const columns = useProductGridColumns();

  const addToCart = useCallback(
    (it: CatalogItem) => {
      if (!isAuthenticated) {
        triggerHaptic('selection');
        router.push('/sign-in?gate=1');
        return;
      }
      triggerHaptic('success');
      addItem({
        id: it.id,
        title: it.title,
        description: it.description,
        price: it.price,
        imageUrl: it.images?.[0],
      });
      toast.success(t('catalog.addedToCart'));
    },
    [addItem, isAuthenticated, toast, t],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: CatalogItem; index: number }) => (
      <AppView style={productCellStyle(index, columns)}>
        <ProductRow item={item} onOpen={openItem} onAdd={addToCart} />
      </AppView>
    ),
    [openItem, addToCart, columns],
  );

  return (
    <AppView testID="parts-directory-screen" flex={1} colorName="background">
      {/* Fixed header: back + search + quick filters */}
      <AppView style={{ paddingTop: insets.top + 6 }} px="lg" colorName="background">
        <AppView row align="center" gap={10}>
          <AppPressableView
            onPress={() => router.back()}
            center
            rounded={12}
            borderWidth={1}
            borderName="border"
            accessibilityRole="button"
            accessibilityLabel={t('catalog.back')}
            style={{ width: 40, height: 40 }}
          >
            <ArrowLeft size={22} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
          <AppView
            row
            align="center"
            gap={10}
            flex={1}
            rounded={14}
            px={14}
            colorName="backgroundSecondary"
            borderWidth={1}
            borderName="border"
            style={{ height: 44 }}
          >
            <Search size={20} strokeWidth={2.2} color={tokens.textMuted} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={
                categoryLabel
                  ? t('catalog.searchIn', { label: categoryLabel })
                  : t('catalog.searchParts')
              }
              placeholderTextColor={tokens.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={{ flex: 1, fontSize: 15, color: tokens.text, paddingVertical: 0 }}
            />
            {search.length > 0 ? (
              <AppPressableView
                onPress={() => setSearch('')}
                accessibilityRole="button"
                accessibilityLabel={t('catalog.clearSearch')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <X size={18} strokeWidth={2.2} color={tokens.textMuted} />
              </AppPressableView>
            ) : null}
          </AppView>
        </AppView>

        {/* Quick filters — a single horizontally-scrolling row of one-tap chips.
            A ScrollView (not FlashList) keeps the small, dynamic chip set simple
            and avoids nested-virtualization warnings under the page list. */}
        <ScrollView
          testID="quick-filters"
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingVertical: 12, gap: 8, alignItems: 'center' }}
        >
          {activeFilterCount > 0 ? (
            <QuickPill
              testID="filter-clear-btn"
              label={t('catalog.clear')}
              active={false}
              onPress={() => {
                triggerHaptic('selection');
                setFilter(DEFAULT_FILTER);
                resetScroll();
              }}
            />
          ) : null}
          {chips.map((c) => (
            <QuickPill
              key={c.key}
              testID={c.testID}
              label={c.label}
              active={c.active}
              onPress={() => {
                triggerHaptic('selection');
                c.onPress();
                resetScroll();
              }}
            />
          ))}
        </ScrollView>
      </AppView>

      {/* Body */}
      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={30} color={tokens.text} />
        </AppView>
      ) : state === 'error' ? (
        <AppView flex={1} center px="xl" gap={12}>
          <AlertCircle size={30} strokeWidth={2} color={tokens.error} />
          <AppText
            family="default"
            style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center' }}
          >
            {t('catalog.loadPartsError')}
          </AppText>
          <AppPressableView
            onPress={refresh}
            rounded={999}
            px={16}
            py={9}
            colorName="backgroundSecondary"
            borderWidth={1}
            borderName="border"
            accessibilityRole="button"
          >
            <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.text }}>
              {t('common.retry')}
            </AppText>
          </AppPressableView>
        </AppView>
      ) : items.length === 0 ? (
        <AppView flex={1} center px="xl" gap={10}>
          <PackageOpen size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
            {t('catalog.noPartsFound')}
          </AppText>
          <AppText
            family="default"
            style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
          >
            {t('catalog.tryClearingFilters')}
          </AppText>
        </AppView>
      ) : (
        // Dimmed, not torn down, while the new query is in flight: the rows
        // stay put and the tapped chip is already lit, so a chip tap reads as
        // one move instead of a spinner wiping the page.
        <AppView flex={1} style={{ opacity: isRefreshing ? 0.5 : 1 }}>
          <FlashList
            ref={listRef}
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => (
              <AppView style={{ height: 1, backgroundColor: tokens.divider }} />
            )}
            ListHeaderComponent={
              <AppView px={16} style={{ paddingBottom: 10 }}>
                {/* The vehicle lives in this line now, not in a bar above it. */}
                <FitmentNote
                  lead={[categoryLabel, t('catalog.partCount', { count: total })]
                    .filter(Boolean)
                    .join(' · ')}
                />
              </AppView>
            }
            ListFooterComponent={
              <CatalogListFooter
                loading={isLoadingMore}
                failed={loadMoreError}
                onRetry={retryLoadMore}
              />
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            // FlashList v2 anchors on the visible row BY DEFAULT; when the rows
            // swap under a new filter it re-pins the scroll to whatever you were
            // looking at, which reads as the page jumping down. A filtered browse
            // list is top-anchored — the new first result is the point.
            maintainVisibleContentPosition={{ disabled: true }}
            contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 96 }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          />
        </AppView>
      )}
    </AppView>
  );
}

/** One quick-filter chip descriptor built in the screen. */
type QuickChip = {
  key: string;
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
};

function QuickPill({
  label,
  active,
  onPress,
  testID,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      testID={testID}
      onPress={onPress}
      androidRipple={false}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      rounded={999}
      px={14}
      py={8}
      borderWidth={1}
      style={{
        borderColor: active ? tokens.brandBg : tokens.border,
        backgroundColor: active ? tokens.brandBg : 'transparent',
      }}
    >
      <AppText
        family="accent"
        weight="semibold"
        style={{ fontSize: 13, color: active ? tokens.onBrand : tokens.text }}
      >
        {label}
      </AppText>
    </AppPressableView>
  );
}
