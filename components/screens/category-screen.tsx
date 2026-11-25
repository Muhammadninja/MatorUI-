import { FlashList, type FlashListRef } from '@shopify/flash-list';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CatalogListFooter from '@/components/screens-components/catalog/catalog-list-footer';
import CatalogAIInlineHint from '@/components/screens-components/catalog/catalog-ai-inline-hint';
import CatalogPhotoAnnouncement from '@/components/screens-components/catalog/catalog-photo-announcement';
import MatorAIDiscoveryCard from '@/components/screens-components/catalog/mator-ai-discovery-card';
import ProductRow, {
  productCellStyle,
  useProductGridColumns,
} from '@/components/screens-components/catalog/product-row';
import ResultsToolbar from '@/components/screens-components/catalog/results-toolbar';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { ListLoadingOverlay } from '@/components/shared/wheel-loader';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { CATALOG_PAGE_SIZE, useCatalogInfiniteList } from '@/hooks/use-catalog-list';
import { useToast } from '@/hooks/use-toast';
import type { CatalogItem } from '@/services/catalog-service';
import type { CatalogSortBy } from '@/types/catalog-nav';
import { triggerHaptic } from '@/utils/haptics';
import { openItemDetail } from '@/utils/nav';

/**
 * Category (`category`) — the result list for a chosen category (or a
 * "Make Model" / dealer from Explore). Backed by the **real catalog**
 * (`useCatalogInfiniteList` → `catalog-service`); no mock fixtures.
 *
 * The list is a FlashList (it was a ScrollView mapping every row, which built
 * the whole page up-front) under a results toolbar carrying the match count,
 * the vehicle the list is scoped to, and a server-side sort row — so a shopper
 * whose first results aren't right has somewhere to go besides Back. It loads
 * a page at a time as the shopper nears the end, until every match is shown.
 */
export default function CategoryScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  // Two different filters. `cat` is a category id: a system root
  // ("brake-system" — what the home grid sends) lists every part filed anywhere
  // beneath it, a bucket slug ("brakes") rolls up by each part's
  // `main_category`, and a subcategory id matches just that node (a certified
  // placement may send either of the last two). `vehicleCat` is a
  // vehicle-system bucket (`BRAKE_SYSTEM`, filtered through `vehicle_category`)
  // — no screen sends it today.
  const params = useLocalSearchParams<{ cat?: string; vehicleCat?: string; label?: string }>();
  const cat = params.cat ?? 'All';
  const vehicleCat = params.vehicleCat;
  const label = params.label ?? vehicleCat ?? cat;

  const [sortBy, setSortBy] = useState<CatalogSortBy>('relevance');
  const [dismissedPhotoCategories, setDismissedPhotoCategories] = useState<Set<string>>(
    () => new Set(),
  );

  const {
    state,
    items,
    total,
    isRefreshing,
    refresh,
    isLoadingMore,
    loadMoreError,
    loadMore,
    retryLoadMore,
  } = useCatalogInfiniteList({
    pageSize: CATALOG_PAGE_SIZE,
    category: cat && cat !== 'All' ? cat : undefined,
    vehicleCategory: vehicleCat,
    sortBy,
  });

  // Any load failure (offline, timeout, or a server error) degrades to the
  // empty state — a browse screen should never show a scary error card. Retry
  // keeps it from being a dead end when the network returns.
  const showEmpty = state === 'empty' || state === 'error';

  const listRef = useRef<FlashListRef<CatalogItem | { id: string; kind: 'ai_hint' }>>(null);

  // A new ordering is a new list: holding the old scroll offset would drop the
  // shopper into the middle of rows they never scrolled past.
  const changeSort = useCallback((next: CatalogSortBy) => {
    setSortBy(next);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  // The sort row stays mounted in every state that has it. A sort that comes
  // back empty must not take away the control you'd use to sort back. Memoized
  // because a fresh element on every render makes the list header remount, and
  // a header that remeasures is a header that shifts the rows under it.
  const toolbar = useMemo(
    () => (
      // The list runs edge to edge, so the toolbar carries its own inset.
      <AppView px={16} style={{ paddingBottom: 14 }}>
        <ResultsToolbar count={total || items.length} sortBy={sortBy} onSortChange={changeSort} />
      </AppView>
    ),
    [total, items.length, sortBy, changeSort],
  );

  const showPhotoAnnouncement =
    items.some((item) => item.photoPlanned === true) && !dismissedPhotoCategories.has(cat);
  const dismissPhotoAnnouncement = useCallback(() => {
    setDismissedPhotoCategories((current) => new Set(current).add(cat));
  }, [cat]);
  const listHeader = useMemo(
    () => (
      <AppView>
        {toolbar}
        {showPhotoAnnouncement ? (
          <AppView px={16} pb={12}>
            <CatalogPhotoAnnouncement
              categoryId={cat}
              categoryLabel={label}
              onDismiss={dismissPhotoAnnouncement}
            />
          </AppView>
        ) : null}
      </AppView>
    ),
    [toolbar, showPhotoAnnouncement, cat, label, dismissPhotoAnnouncement],
  );

  const footer = useMemo(
    () => (
      <CatalogListFooter loading={isLoadingMore} failed={loadMoreError} onRetry={retryLoadMore} />
    ),
    [isLoadingMore, loadMoreError, retryLoadMore],
  );

  const { addItem } = useCartContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  const columns = useProductGridColumns();
  // An eight-product boundary is a complete row in the two-column grid. The
  // full-span hint is only added to long lists, well before the end card.
  const showInlineHint = total > 16 && items.length >= 8;
  const listItems = useMemo<(CatalogItem | { id: string; kind: 'ai_hint' })[]>(() => {
    if (!showInlineHint) return items;
    return [
      ...items.slice(0, 8),
      { id: 'catalog-ai-inline-hint', kind: 'ai_hint' },
      ...items.slice(8),
    ];
  }, [items, showInlineHint]);
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
    ({ item, index }: { item: CatalogItem | { id: string; kind: 'ai_hint' }; index: number }) => {
      if ('kind' in item && item.kind === 'ai_hint') {
        return (
          <AppView style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <CatalogAIInlineHint categoryId={cat} categoryLabel={label} />
          </AppView>
        );
      }
      const productIndex = index - (showInlineHint && index > 8 ? 1 : 0);
      return (
        <AppView style={productCellStyle(productIndex, columns)}>
          <ProductRow item={item} onOpen={openItem} onAdd={addToCart} />
        </AppView>
      );
    },
    [openItem, addToCart, columns, showInlineHint, cat, label],
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title={label} fallbackHref="/explore" />

      {showEmpty ? (
        <AppView flex={1}>
          {sortBy !== 'relevance' ? <AppView style={{ paddingTop: 4 }}>{toolbar}</AppView> : null}
          {/* Centered empty state, offset by the tab bar so it reads as centered
              in the space ABOVE the bar rather than pushed low behind it. */}
          <AppView
            flex={1}
            px={24}
            justify="center"
            align="center"
            gap={10}
            style={{ paddingBottom: insets.bottom + 72 }}
          >
            {state === 'empty' ? (
              <MatorAIDiscoveryCard
                source="category_empty"
                categoryId={cat}
                categoryLabel={label}
              />
            ) : (
              <>
                <AppText
                  family="heading"
                  weight="bold"
                  style={{ fontSize: 18, color: tokens.text }}
                >
                  {t('catalog.loadPartsError')}
                </AppText>
                <AppButton
                  title={t('common.retry')}
                  kind="secondary"
                  size="sm"
                  onPress={refresh}
                  style={{ marginTop: 4 }}
                />
              </>
            )}
          </AppView>
        </AppView>
      ) : (
        // Dimmed, not emptied, while a re-sort is in flight: the rows stay put
        // and the tapped chip is already active, so the swap reads as one move.
        <AppView flex={1} style={{ opacity: isRefreshing ? 0.5 : 1 }}>
          <FlashList
            ref={listRef}
            data={listItems}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            numColumns={columns}
            overrideItemLayout={(layout, _item, index) => {
              if (showInlineHint && index === 8) layout.span = columns;
            }}
            ListHeaderComponent={state === 'loading' ? null : listHeader}
            ListFooterComponent={
              <AppView gap={12} px={16}>
                {footer}
                {!isLoadingMore &&
                !loadMoreError &&
                !isRefreshing &&
                total > 0 &&
                items.length >= total ? (
                  <MatorAIDiscoveryCard
                    source="category_end"
                    categoryId={cat}
                    categoryLabel={label}
                  />
                ) : null}
              </AppView>
            }
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            // FlashList v2 keeps the visible content anchored BY DEFAULT: when
            // the rows swap under a new sort it re-pins the scroll to whatever
            // row you were looking at, which reads as the page lurching down.
            // A browse list is top-anchored — the new #1 result is the point.
            maintainVisibleContentPosition={{ disabled: true }}
            contentContainerStyle={{
              paddingTop: 4,
              paddingBottom: Math.max(insets.bottom + 24, 40),
            }}
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="on-drag"
          />
        </AppView>
      )}

      {/* First load only — a re-sort keeps the list on screen rather than
          blanking it behind the blur. */}
      <ListLoadingOverlay visible={state === 'loading'} label={t('catalog.findingParts')} />
    </AppView>
  );
}
