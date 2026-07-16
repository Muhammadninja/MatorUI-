import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, ArrowLeft, PackageOpen, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { Keyboard, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CatalogFilterSheet from '@/components/screens-components/catalog/catalog-filter-sheet';
import ProductRow from '@/components/screens-components/catalog/product-row';
import VehicleContextBar from '@/components/screens-components/catalog/vehicle-context-bar';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { catalogSystemById } from '@/constants/catalog-systems';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useCatalogList } from '@/hooks/use-catalog-list';
import { useToast } from '@/hooks/use-toast';
import { parsePrice } from '@/services/cart-math';
import type { CatalogItem } from '@/services/catalog-service';
import type { FilterState } from '@/types/catalog-nav';
import { triggerHaptic } from '@/utils/haptics';

const DEFAULT_FILTER: FilterState = {
  brands: [],
  regions: [],
  inStockOnly: false,
  oemOnly: false,
  gmOnly: false,
  sortBy: 'relevance',
};

/** Brand shown on a part = the first segment of its "brand · category" description. */
function brandOf(item: CatalogItem): string {
  return item.description?.split('·')[0]?.trim() ?? '';
}

/**
 * Catalog parts (Stage 3) — the parts list for a chosen system + vehicle.
 * Fixed header (back + search + quick-filter pills) over a FlashList of
 * `ProductRow`s from the real catalog, plus a sticky "Filter & Sort" bar that
 * opens a bottom sheet. Filters/sort are applied client-side over the fetched
 * page (server filter params are wired once the backend exposes them).
 */
export default function CatalogPartsScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { systemId, make, model } = useLocalSearchParams<{
    systemId?: string;
    make?: string;
    model?: string;
  }>();
  const system = catalogSystemById(systemId);
  const vehicleLabel = [make, model].filter(Boolean).join(' ');

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Flow context + the coarse catalog facets (region, GM) go to the backend so
  // the transport does that filtering; the fine refinements (brand, sort, stock,
  // OEM) + free-text search stay client-side over the fetched page.
  const { state, items, refresh } = useCatalogList({
    page: 1,
    pageSize: 50,
    category: system?.categoryKey,
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
      if (filter.inStockOnly && it.status === 'Out of stock') return false;
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
    (filter.inStockOnly ? 1 : 0) +
    (filter.oemOnly ? 1 : 0) +
    (filter.gmOnly ? 1 : 0);

  const openItem = useCallback((it: CatalogItem) => {
    router.push({ pathname: '/item-detail/[id]', params: { id: it.id } });
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
      toast.success('Added to cart');
    },
    [addItem, isAuthenticated, toast],
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
            accessibilityLabel="Back"
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
              placeholder={system ? `Search ${system.label}` : 'Search parts'}
              placeholderTextColor={tokens.textMuted}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={{ flex: 1, fontSize: 15, color: tokens.text, paddingVertical: 0 }}
            />
            {search.length > 0 ? (
              <AppPressableView onPress={() => setSearch('')} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={18} strokeWidth={2.2} color={tokens.textMuted} />
              </AppPressableView>
            ) : null}
          </AppView>
        </AppView>

        {/* Quick filter pills */}
        <FlashList
          data={QUICK_FILTERS}
          horizontal
          keyExtractor={(f) => f.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingVertical: 12 }}
          renderItem={({ item: f }) => {
            const active =
              (f.key === 'inStock' && filter.inStockOnly) ||
              (f.key === 'oem' && filter.oemOnly) ||
              (f.key === 'gm' && filter.gmOnly) ||
              (f.key === 'brand' && filter.brands.length > 0) ||
              (f.key === 'region' && filter.regions.length > 0);
            return (
              <QuickPill
                label={f.label}
                active={active}
                onPress={() => {
                  triggerHaptic('selection');
                  if (f.key === 'inStock') setFilter((s) => ({ ...s, inStockOnly: !s.inStockOnly }));
                  else if (f.key === 'oem') setFilter((s) => ({ ...s, oemOnly: !s.oemOnly }));
                  else if (f.key === 'gm') setFilter((s) => ({ ...s, gmOnly: !s.gmOnly }));
                  else setSheetOpen(true); // brand / region open the sheet
                }}
              />
            );
          }}
          ItemSeparatorComponent={() => <AppView style={{ width: 8 }} />}
        />
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
            Couldn&apos;t load parts.
          </AppText>
          <AppPressableView onPress={refresh} rounded={999} px={16} py={9} colorName="backgroundSecondary" borderWidth={1} borderName="border" accessibilityRole="button">
            <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.text }}>Retry</AppText>
          </AppPressableView>
        </AppView>
      ) : results.length === 0 ? (
        <AppView flex={1} center px="xl" gap={10}>
          <PackageOpen size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
            No parts found
          </AppText>
          <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}>
            Try clearing filters or a different search.
          </AppText>
        </AppView>
      ) : (
        <FlashList
          data={results}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <AppView gap={12} style={{ paddingBottom: 4 }}>
              <VehicleContextBar />
              <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
                {system ? `${system.label} · ` : ''}
                {vehicleLabel ? `${vehicleLabel} · ` : ''}
                {results.length} part{results.length === 1 ? '' : 's'}
              </AppText>
            </AppView>
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 96 }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        />
      )}

      {/* Sticky Filter & Sort bar */}
      <AppView center style={{ position: 'absolute', left: 0, right: 0, bottom: Math.max(insets.bottom, 16) }} pointerEvents="box-none">
        <AppPressableView
          testID="floating-filter-btn"
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Filter and sort"
          pressedOpacity={0.85}
          row
          align="center"
          gap={8}
          rounded={999}
          px={20}
          py={13}
          style={{ backgroundColor: tokens.brandBg, shadowColor: tokens.black, shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 }}
        >
          <SlidersHorizontal size={17} strokeWidth={2.4} color={tokens.onBrand} />
          <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.onBrand }}>
            Filter & Sort{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
          </AppText>
        </AppPressableView>
      </AppView>

      <CatalogFilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={filter}
        brands={brands}
        onApply={setFilter}
      />
    </AppView>
  );
}

const QUICK_FILTERS: { key: string; label: string }[] = [
  { key: 'gm', label: 'GM' },
  { key: 'brand', label: 'Brand' },
  { key: 'region', label: 'Region' },
  { key: 'inStock', label: 'In Stock' },
  { key: 'oem', label: 'OEM Quality' },
];

function QuickPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
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
