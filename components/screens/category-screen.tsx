import { FlashList } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ProductRow from '@/components/screens-components/catalog/product-row';
import ResultsToolbar from '@/components/screens-components/catalog/results-toolbar';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { ListLoadingOverlay } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useCatalogList } from '@/hooks/use-catalog-list';
import { useToast } from '@/hooks/use-toast';
import type { CatalogItem } from '@/services/catalog-service';
import type { CatalogSortBy } from '@/types/catalog-nav';
import { triggerHaptic } from '@/utils/haptics';
import { openItemDetail } from '@/utils/nav';

/**
 * Category (`category`) — the result list for a chosen category (or a
 * "Make Model" / dealer from Explore). Backed by the **real catalog**
 * (`useCatalogList` → `catalog-service`); no mock fixtures.
 *
 * The list is a FlashList (it was a ScrollView mapping every row, which built
 * the whole page up-front) under a results toolbar carrying the match count,
 * the vehicle the list is scoped to, and a server-side sort row — so a shopper
 * whose first results aren't right has somewhere to go besides Back.
 */
export default function CategoryScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  // Two different filters. `cat` is a category id: a bucket slug ("brakes" —
  // what the home grid sends) rolls up by each part's `main_category`, while a
  // subcategory id matches just that node (a certified placement may send
  // either). `vehicleCat` is a vehicle-system bucket (`BRAKE_SYSTEM`, filtered
  // through `vehicle_category`) — no screen sends it today.
  const params = useLocalSearchParams<{ cat?: string; vehicleCat?: string; label?: string }>();
  const cat = params.cat ?? 'All';
  const vehicleCat = params.vehicleCat;
  const label = params.label ?? vehicleCat ?? cat;

  const [sortBy, setSortBy] = useState<CatalogSortBy>('relevance');

  const { state, items, total, refresh } = useCatalogList({
    page: 1,
    pageSize: 24,
    category: cat && cat !== 'All' ? cat : undefined,
    vehicleCategory: vehicleCat,
    sortBy,
  });

  // Any load failure (offline, timeout, or a server error) degrades to the
  // empty state — a browse screen should never show a scary error card. Retry
  // keeps it from being a dead end when the network returns.
  const showEmpty = state === 'empty' || state === 'error';

  const { addItem } = useCartContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  const openItem = useCallback((it: CatalogItem) => openItemDetail(it.id), []);

  // Guest-first purchase gate, mirroring Item Detail.
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
    [addItem, isAuthenticated, t, toast],
  );

  const renderItem = useCallback(
    ({ item }: { item: CatalogItem }) => (
      <ProductRow item={item} onOpen={openItem} onAdd={addToCart} />
    ),
    [openItem, addToCart],
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={label} fallbackHref="/explore" />

      {showEmpty ? (
        // Centered empty state, offset by the tab bar so it reads as centered
        // in the space ABOVE the bar rather than pushed low behind it.
        <AppView
          flex={1}
          px={24}
          justify="center"
          align="center"
          gap={10}
          style={{ paddingBottom: insets.bottom + 72 }}
        >
          <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text }}>
            {t('catalog.noPartsFound')}
          </AppText>
          <AppText
            family="default"
            style={{ fontSize: 13, lineHeight: 18, color: tokens.textMuted, textAlign: 'center' }}
          >
            {t('catalog.tryClearingFilters')}
          </AppText>
          <AppButton
            title={t('common.retry')}
            kind="secondary"
            size="sm"
            onPress={refresh}
            style={{ marginTop: 4 }}
          />
        </AppView>
      ) : (
        <FlashList
          data={state === 'success' ? items : []}
          keyExtractor={(it) => it.id}
          renderItem={renderItem}
          ItemSeparatorComponent={() => (
            <AppView style={{ height: 1, backgroundColor: tokens.divider }} />
          )}
          ListHeaderComponent={
            state === 'success' ? (
              // The list runs edge to edge, so the toolbar carries its own inset.
              <AppView px={16} style={{ paddingBottom: 14 }}>
                <ResultsToolbar
                  count={total || items.length}
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                />
              </AppView>
            ) : null
          }
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom + 24, 40),
          }}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        />
      )}

      <ListLoadingOverlay visible={state === 'loading'} label={t('catalog.findingParts')} />
    </AppView>
  );
}
