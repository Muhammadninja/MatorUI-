import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, ArrowLeft, PackageOpen, Search, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, ScrollView, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProductRow from '@/components/screens-components/catalog/product-row';
import VehicleContextBar from '@/components/screens-components/catalog/vehicle-context-bar';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useCatalogList } from '@/hooks/use-catalog-list';
import { useToast } from '@/hooks/use-toast';
import { parsePrice } from '@/services/cart-math';
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

/** Brand shown on a part = the part manufacturer (`CatalogItem.brand`, e.g.
 *  "Gates"), falling back to the first segment of its "brand · category"
 *  description for items mapped before `brand` was populated. */
function brandOf(item: CatalogItem): string {
  return item.brand?.trim() || item.description?.split('·')[0]?.trim() || '';
}

/**
 * Catalog parts (Stage 3) — the parts list for a chosen system + vehicle.
 * Fixed header (back + search) over a single horizontally-scrolling row of
 * QUICK FILTERS — sort, GM/OEM flags, region, and brand chips that each apply
 * on tap. There is no filter bottom sheet: every refinement is a one-tap chip.
 * Region + GM go to the backend; the rest refine the fetched page client-side.
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
  const toggleBrand = (b: string) =>
    setFilter((f) => ({
      ...f,
      brands: f.brands.includes(b) ? f.brands.filter((x) => x !== b) : [...f.brands, b],
    }));

  // Flow context + the coarse catalog facets (region, GM) go to the backend so
  // the transport does that filtering; the fine refinements (brand, sort, stock,
  // OEM) + free-text search stay client-side over the fetched page.
  const { state, items, refresh } = useCatalogList({
    page: 1,
    pageSize: 50,
    category: categoryId || undefined,
    make: make || undefined,
    model: model || undefined,
    regions: filter.regions.length ? filter.regions : undefined,
    gmOnly: filter.gmOnly || undefined,
  });

  const { addItem } = useCartContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  const brands = useMemo(
    () => Array.from(new Set(items.map(brandOf).filter(Boolean))).sort(),
    [items],
  );

  // Region + GM are filtered server-side (sent in the request above), so the
  // fetched `items` are already scoped; here we only apply the client-side
  // refinements over that page.
  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = items.filter((it) => {
      if (q && !(it.title.toLowerCase().includes(q) || it.oem?.toLowerCase().includes(q))) return false;
      if (filter.oemOnly && !it.oem) return false;
      if (filter.brands.length && !filter.brands.includes(brandOf(it))) return false;
      return true;
    });
    if (filter.sortBy === 'price_asc') list = [...list].sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    else if (filter.sortBy === 'price_desc') list = [...list].sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    return list;
  }, [items, search, filter]);

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
      { key: 'sort:price_asc', label: t('catalog.priceAsc'), active: filter.sortBy === 'price_asc', onPress: () => toggleSort('price_asc') },
      { key: 'sort:price_desc', label: t('catalog.priceDesc'), active: filter.sortBy === 'price_desc', onPress: () => toggleSort('price_desc') },
      { key: 'gm', label: t('catalog.chipGm'), active: filter.gmOnly, onPress: () => setFilter((s) => ({ ...s, gmOnly: !s.gmOnly })) },
      { key: 'oem', label: t('catalog.chipOemQuality'), active: filter.oemOnly, onPress: () => setFilter((s) => ({ ...s, oemOnly: !s.oemOnly })) },
    ];
    for (const b of brands) {
      list.push({ key: `brand:${b}`, label: b, active: filter.brands.includes(b), onPress: () => toggleBrand(b), testID: `filter-brand-${b}` });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, brands]);

  const openItem = useCallback((it: CatalogItem) => {
    openItemDetail(it.id);
  }, []);

  const addToCart = useCallback(
    (it: CatalogItem) => {
      if (!isAuthenticated) {
        triggerHaptic('selection');
        router.push('/sign-in?gate=1');
        return;
      }
      triggerHaptic('success');
      addItem({ id: it.id, title: it.title, description: it.description, price: it.price, imageUrl: it.images?.[0] });
      toast.success(t('catalog.addedToCart'));
    },
    [addItem, isAuthenticated, toast, t],
  );

  const renderItem = useCallback(
    ({ item }: { item: CatalogItem }) => <ProductRow item={item} onOpen={openItem} onAdd={addToCart} />,
    [openItem, addToCart],
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
              placeholder={categoryLabel ? t('catalog.searchIn', { label: categoryLabel }) : t('catalog.searchParts')}
              placeholderTextColor={tokens.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={{ flex: 1, fontSize: 15, color: tokens.text, paddingVertical: 0 }}
            />
            {search.length > 0 ? (
              <AppPressableView onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel={t('catalog.clearSearch')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
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
          <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center' }}>
            {t('catalog.loadPartsError')}
          </AppText>
          <AppPressableView onPress={refresh} rounded={999} px={16} py={9} colorName="backgroundSecondary" borderWidth={1} borderName="border" accessibilityRole="button">
            <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.text }}>{t('common.retry')}</AppText>
          </AppPressableView>
        </AppView>
      ) : results.length === 0 ? (
        <AppView flex={1} center px="xl" gap={10}>
          <PackageOpen size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
            {t('catalog.noPartsFound')}
          </AppText>
          <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}>
            {t('catalog.tryClearingFilters')}
          </AppText>
        </AppView>
      ) : (
        <FlashList
          data={results}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <AppView style={{ height: 14 }} />}
          ListHeaderComponent={
            <AppView gap={12} style={{ paddingBottom: 4 }}>
              <VehicleContextBar />
              <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
                {categoryLabel ? `${categoryLabel} · ` : ''}
                {vehicleLabel ? `${vehicleLabel} · ` : ''}
                {t('catalog.partCount', { count: results.length })}
              </AppText>
            </AppView>
          }
          contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 96, paddingHorizontal: 16 }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        />
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

function QuickPill({ label, active, onPress, testID }: { label: string; active: boolean; onPress: () => void; testID?: string }) {
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
      <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: active ? tokens.onBrand : tokens.text }}>
        {label}
      </AppText>
    </AppPressableView>
  );
}
