import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ItemGallery from '@/components/screens-components/item-detail/item-gallery';
import ItemAssuranceCard from '@/components/screens-components/item-detail/item-assurance-card';
import ItemBuyBar from '@/components/screens-components/item-detail/item-buy-bar';
import {
  ItemFitBadge,
  ItemUniversalFitBadge,
  ItemVehicleCta,
} from '@/components/screens-components/item-detail/item-fit-badge';
import {
  ItemDetailHeader,
  ItemIdentity,
  ItemPriceRow,
} from '@/components/screens-components/item-detail/item-header';
import {
  ItemFeatureList,
  ItemFitList,
  ItemRatingRow,
  ItemRule,
  ItemSectionTitle,
  ItemSpecTable,
  ItemTrustRow,
} from '@/components/screens-components/item-detail/item-info';
import ItemSimilarRail from '@/components/screens-components/item-detail/item-similar-rail';
import { AppButton } from '@/components/shared/app-button';
import AppImageViewer from '@/components/shared/app-image-viewer/app-image-viewer';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useCartContext } from '@/contexts/cart.context';
import { useLikesContext } from '@/contexts/likes.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useCatalogDetail } from '@/hooks/use-catalog-detail';
import { useCompatibility } from '@/hooks/use-compatibility';
import { useActiveSales } from '@/hooks/use-sales';
import { useToast } from '@/hooks/use-toast';
import { parsePrice } from '@/services/cart-math';
import type { CatalogItem, CatalogItemSpec } from '@/services/catalog-service';
import { resolveItemPricing } from '@/services/sales-service';
import { formatSomAmount } from '@/utils/format-price';
import { triggerHaptic } from '@/utils/haptics';
import { shareItem } from '@/utils/share';

/**
 * Item Detail — backed by the REAL catalog (`useCatalogDetail`).
 *
 * A storefront product page: a static header carries the title (plus back /
 * share / favourite) from the first frame, the swipeable gallery sits a
 * breathing gap below it rather than running under the status bar, a rounded
 * content sheet rides over the gallery's bottom edge, and a sticky buy bar
 * closes the page out. Everything it shows is a real backend field — the
 * resolved sale (struck "was" + percent), seller trust flags, delivery ETA,
 * stock, spec table, feature bullets, and listed fitments — so the richer page
 * is richer data, not decoration. Fields the catalog doesn't carry (rating,
 * reviews, related parts) stay omitted rather than faked.
 *
 * The buy path is unchanged: real `CatalogItem.id` → cart → order, guests are
 * gated to Sign In, and a wrong-fit part still goes through the safety-gate
 * confirm.
 */
export default function ItemDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { addItem, formatCurrency } = useCartContext();
  const { isLiked, toggleLike } = useLikesContext();
  const { currentActiveVehicle } = useActiveVehicle();
  const { isAuthenticated } = useUserContext();
  const { width } = useWindowDimensions();
  const [qty, setQty] = useState(1);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [measuredHeaderHeight, setMeasuredHeaderHeight] = useState<number | null>(null);

  const { state, detail, error, refresh } = useCatalogDetail(id ?? null);
  const item = detail?.item ?? null;
  const activeVehicle = currentActiveVehicle?.vehicle ?? null;
  const sales = useActiveSales();

  // Real fit check against the backend for the active garage vehicle. Called
  // unconditionally (before the early returns) to satisfy the rules of hooks;
  // it no-ops when there's no part id or no active vehicle. `compat` stays null
  // until an answer arrives — we NEVER render a fit badge without one.
  const { result: compat, loading: compatLoading } = useCompatibility(
    id ?? null,
    currentActiveVehicle?.vehicleId,
    currentActiveVehicle?.vehicle?.vin,
  );

  // Hero is sized off the window so it scales from an SE to a tablet.
  // Near-square: catalog photos are shot on white in every aspect ratio, and
  // `contain` letterboxes them — the taller the tile, the more of the part is
  // actually visible before you open the full-screen viewer.
  const heroHeight = Math.round(Math.min(Math.max(width * 0.95, 300), 430));
  // The header is a static overlay now (visible from the first frame, not
  // faded in on scroll) — its height is measured off the real render. Before
  // that first measurement lands, fall back to a one-line estimate so the
  // gallery never flashes under the header.
  const headerHeight = measuredHeaderHeight ?? insets.top + 56;
  const galleryTopGap = 16;

  // Brand/category/origin/OEM/GM already read from the pill + title, so the
  // spec table is now ONLY the oil/antifreeze attributes that show nowhere
  // else on the page (memoised: `specs` is a fresh array).
  const specs = useMemo<CatalogItemSpec[]>(() => buildSpecs(item, t), [item, t]);

  if (state === 'loading' || state === 'idle') {
    return (
      <AppView flex={1} colorName="background" center>
        <WheelLoader size={30} color={tokens.text} />
      </AppView>
    );
  }

  if (state === 'error' || state === 'not_found' || !item) {
    return (
      <AppView
        flex={1}
        colorName="background"
        center
        px="xl"
        gap={12}
        style={{ paddingTop: insets.top }}
      >
        <AppText family="heading" weight="bold" style={{ fontSize: 18, color: tokens.text }}>
          {state === 'not_found' ? t('itemDetail.notFoundTitle') : t('itemDetail.loadErrorTitle')}
        </AppText>
        <AppText
          family="default"
          style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
        >
          {error ?? t('itemDetail.unavailableBody')}
        </AppText>
        <AppView row gap={10}>
          <AppButton
            title={t('itemDetail.goBack')}
            kind="secondary"
            size="sm"
            onPress={() => router.back()}
          />
          {state === 'error' ? (
            <AppButton title={t('common.retry')} kind="brand" size="sm" onPress={refresh} />
          ) : null}
        </AppView>
      </AppView>
    );
  }

  const image = item.images?.[0];
  const isFavorite = isLiked(item.id);
  const { savePct, wasUzs } = resolveItemPricing(item, sales);
  const unitPrice = parsePrice(item.price);
  const outOfStock = /out of stock/i.test(item.status ?? '');
  // Per-unit saving, straight off the resolved sale — "you save X" converts
  // better than a bare percent, and it's the same number the pill encodes.
  const unitPriceUzs = item.priceUzs ?? unitPrice;
  const savingsLabel =
    wasUzs > unitPriceUzs
      ? `${formatSomAmount(wasUzs - unitPriceUzs)} ${t('common.currency')}`
      : null;
  const vehicleLabel = activeVehicle
    ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model ?? ''}`.trim()
    : null;
  // Keep an explicit unknown state when a selected vehicle has no verdict.
  const fits = item.fits ?? [];
  const makeFits = item.makeFits ?? [];
  const features = item.features ?? [];

  const toggleFavorite = () => {
    const nowFav = toggleLike(item.id);
    toast.success(nowFav ? t('itemDetail.savedToFavorites') : t('itemDetail.removedFromFavorites'));
  };

  const shareCurrentItem = async () => {
    triggerHaptic('selection');
    const result = await shareItem({
      id: item.id,
      title: item.title,
      price: item.price,
      imageUrl: image,
    });
    if (result === 'unavailable') toast.info(t('itemDetail.shareUnavailable'));
    else if (result === 'error') toast.danger(t('itemDetail.shareFailed'));
  };

  // Actually add the real catalog item `qty` times (one unit per `addItem`)
  // and land on Cart. REPLACES onto the Cart tab — the item page is done.
  const commitAddToCart = () => {
    triggerHaptic('success');
    const cartItem = {
      id: item.id,
      title: item.title,
      description: item.description,
      price: item.price,
      imageUrl: image,
    };
    for (let i = 0; i < qty; i += 1) addItem(cartItem);
    setQty(1);
    router.replace('/cart');
  };

  // Guest-first purchase gate: guests go to Sign In. Signed-in users add
  // straight away — UNLESS the fit check says the part doesn't fit the active
  // vehicle, in which case a Safety Gate confirms intent first (cuts returns /
  // wrong-fit deliveries).
  const addToCart = () => {
    if (!isAuthenticated) {
      triggerHaptic('selection');
      router.push('/sign-in?gate=1');
      return;
    }
    if (compat?.status === 'NOT_COMPATIBLE') {
      triggerHaptic('warning');
      const name = activeVehicle
        ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`.trim()
        : t('itemDetail.selectedVehicleFallback');
      Alert.alert(t('itemDetail.notCompatibleTitle'), t('itemDetail.notCompatibleBody', { name }), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('itemDetail.addAnyway'),
          style: 'destructive',
          onPress: commitAddToCart,
        },
      ]);
      return;
    }
    commitAddToCart();
  };

  return (
    <AppView flex={1} colorName="background" testID="item-detail-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: headerHeight + galleryTopGap, paddingBottom: 28 }}
      >
        {/* Full-bleed gallery — starts clear of the static header above it. */}
        <ItemGallery
          images={item.images ?? []}
          title={item.title}
          height={heroHeight}
          savePct={savePct}
          index={imageIndex}
          onIndexChange={setImageIndex}
          onPressImage={(i) => {
            setImageIndex(i);
            setViewerOpen(true);
          }}
        />

        {/* Content sheet — rides over the bottom of the gallery.
         *
         *  Laid out as four ZONES, each answering one question, separated by a
         *  hairline: what is it and what does it cost → will it fit my car →
         *  when does it arrive → what are the details. It used to be eleven
         *  blocks in a flat 18px stack, four of them rounded cards in three
         *  different tints, so nothing on the page outranked anything else.
         *  Tight gaps now mean "same thought", a rule means "new thought". */}
        <AppView
          colorName="background"
          px="lg"
          gap={20}
          style={{
            marginTop: -24,
            paddingTop: 20,
            borderTopLeftRadius: 26,
            borderTopRightRadius: 26,
          }}
        >
          {/* ZONE 1 — what it is, what it costs. No containers: the type
              hierarchy alone carries it. */}
          <AppView gap={12}>
            <ItemIdentity title={item.title} oem={item.oem} gm={item.gm} />

            {/* Real review aggregate, or nothing at all. */}
            <ItemRatingRow rating={item.rating} reviewCount={item.reviewCount} />

            <ItemPriceRow
              price={item.price}
              wasUzs={wasUzs}
              wasLabel={item.originalPriceLabel}
              savePct={savePct}
              saleTitle={item.saleTitle}
              savingsLabel={savingsLabel}
            />

            {/* Seller trust flags + an out-of-stock warning when it applies */}
            <ItemTrustRow item={item} />
          </AppView>

          {/* ZONE 2 — the decision: will it fit? This is the one block that
              keeps a coloured card, because it is the question that stalls the
              purchase. Universal listings (oils under "Другое") fit every car —
              a static plaque and NO compatibility badge (answering "maybe" for a
              part that fits everything is misleading). Vehicle-specific parts
              keep the real backend check. Missing answers remain explicitly
              unknown; with no garage vehicle the CTA offers selection, and
              mid-check it says the check is running. */}
          <ItemRule />
          {item.isUniversal ? (
            <ItemUniversalFitBadge />
          ) : (
            <AppView gap={12}>
              {compat ? (
                <ItemFitBadge
                  result={compat}
                  subtitle={
                    activeVehicle
                      ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model} ${activeVehicle.trim ?? ''}`.trim()
                      : null
                  }
                  onShowAlternatives={() => router.push('/search')}
                />
              ) : null}
              {!compat ? (
                <ItemVehicleCta
                  checking={compatLoading && !compat}
                  vehicleLabel={vehicleLabel}
                  onPress={() => router.navigate('/garage')}
                />
              ) : null}
            </AppView>
          )}

          {/* ZONE 3 — when it lands and how you pay. Plain sentences, no box. */}
          <ItemRule />
          <ItemAssuranceCard item={item} formatCurrency={formatCurrency} />

          {/* ZONE 4 — the details, for the shopper who wants them. One rule
              above the group, headed sections inside it. */}
          {specs.length > 0 || features.length > 0 || fits.length > 0 || makeFits.length > 0 ? (
            <ItemRule />
          ) : null}

          {specs.length > 0 ? (
            <AppView gap={11}>
              <ItemSectionTitle title={t('itemDetail.specsTitle')} />
              <ItemSpecTable specs={specs} />
            </AppView>
          ) : null}

          {features.length > 0 ? (
            <AppView gap={11}>
              <ItemSectionTitle title={t('itemDetail.featuresTitle')} />
              <ItemFeatureList features={features} />
            </AppView>
          ) : null}

          {fits.length > 0 || makeFits.length > 0 ? (
            <AppView gap={11}>
              <ItemSectionTitle
                title={t('itemDetail.fitsTitle')}
                count={fits.length + makeFits.length}
              />
              <ItemFitList fits={fits} makeFits={makeFits} />
            </AppView>
          ) : null}

          {/* Somewhere to go if this part isn't the one — and the fallback
              when it's out of stock. Only mounted when there's a scope to
              query (the hook fires on mount). */}
          {item.categoryId || activeVehicle ? (
            <>
              <ItemRule />
              <ItemSimilarRail
                currentId={item.id}
                categoryId={item.categoryId}
                make={activeVehicle?.make}
                model={activeVehicle?.model ?? undefined}
              />
            </>
          ) : null}
        </AppView>
      </ScrollView>

      <ItemDetailHeader
        topInset={insets.top}
        onBack={() => router.back()}
        onLayout={(e) => setMeasuredHeaderHeight(e.nativeEvent.layout.height)}
      />

      <ItemBuyBar
        total={formatCurrency(unitPrice * qty)}
        savingsLabel={savingsLabel}
        qty={qty}
        onQtyChange={setQty}
        outOfStock={outOfStock}
        onAddToCart={addToCart}
        isFavorite={isFavorite}
        onToggleFavorite={toggleFavorite}
        onShare={shareCurrentItem}
        insetBottom={insets.bottom}
      />

      {/* Full-screen viewer — opens on the photo you tapped. */}
      <AppImageViewer
        visible={viewerOpen}
        images={item.images.map((uri) => ({ uri }))}
        initialIndex={imageIndex}
        onClose={() => setViewerOpen(false)}
        renderCaption={(i) =>
          item.images.length > 1
            ? t('itemDetail.imageCounter', { current: i + 1, total: item.images.length })
            : null
        }
      />
    </AppView>
  );
}

/**
 * Spec rows for the table: ONLY the KIND-specific attributes the backend
 * keeps outside the generic fields — a motor oil's viscosity/type/volume, an
 * antifreeze's net weight. The catalog's generic `specs` (brand, category,
 * origin, OEM/GM number) are deliberately left out: brand/OEM/GM already show
 * in the OEM pill and the part's fit/model already shows in the title, so
 * repeating them here was redundant.
 */
function buildSpecs(
  item: CatalogItem | null,
  t: (key: string, options?: Record<string, unknown>) => string,
): CatalogItemSpec[] {
  if (!item) return [];
  const kindRows: CatalogItemSpec[] = [];

  const oil = item.kind === 'MOTOR_OIL' ? item.motorOil : null;
  if (oil?.viscosity) kindRows.push({ label: t('itemDetail.oilViscosity'), value: oil.viscosity });
  if (oil?.oilTypeLabel) kindRows.push({ label: t('itemDetail.oilType'), value: oil.oilTypeLabel });
  if (oil?.volumeLabel) kindRows.push({ label: t('itemDetail.oilVolume'), value: oil.volumeLabel });

  // Antifreeze: the backend stores GRAMS and ships the human label beside it
  // ("2.5 кг"). Render the label; fall back to the raw grams only if it's absent.
  const coolant = item.kind === 'ANTIFREEZE' ? item.antifreeze : null;
  const weight =
    coolant?.weightLabel ??
    (coolant?.weightG != null ? t('itemDetail.weightGrams', { grams: coolant.weightG }) : null);
  if (weight) kindRows.push({ label: t('itemDetail.antifreezeWeight'), value: weight });

  return kindRows;
}
