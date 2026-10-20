import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Animated, useWindowDimensions } from 'react-native';
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
  ItemFloatingControls,
  ItemIdentity,
  ItemPriceRow,
  ItemTitleBar,
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
import { noBreakDigits } from '@/utils/format-price';
import { triggerHaptic } from '@/utils/haptics';
import { shareItem } from '@/utils/share';

/**
 * Item Detail — backed by the REAL catalog (`useCatalogDetail`).
 *
 * The 2026 pass turns the old stacked page into a storefront product page: a
 * full-bleed swipeable gallery under the status bar, a rounded content sheet
 * that rides over it, a title bar that fades in as you scroll past the photos,
 * and a sticky buy bar. Everything it shows is a real backend field — the
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
  const { addItem, formatCurrency, totals, freeShippingThreshold } = useCartContext();
  const { isLiked, toggleLike } = useLikesContext();
  const { currentActiveVehicle } = useActiveVehicle();
  const { isAuthenticated } = useUserContext();
  const { width } = useWindowDimensions();
  const [qty, setQty] = useState(1);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;

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

  // Hero is sized off the window so it scales from an SE to a tablet, and the
  // fade-in point of the title bar follows it. Near-square: catalog photos are
  // shot on white in every aspect ratio, and `contain` letterboxes them — the
  // taller the tile, the more of the part is actually visible before you open
  // the full-screen viewer.
  const heroHeight = Math.round(Math.min(Math.max(width * 0.95, 300), 430));
  const barHeight = insets.top + 54;
  const barOpacity = scrollY.interpolate({
    inputRange: [heroHeight - barHeight - 40, heroHeight - barHeight],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  // Oils carry their attributes outside `specs`; fold them in so the spec table
  // is the single place a shopper looks (memoised: `specs` is a fresh array).
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
      ? `${noBreakDigits((wasUzs - unitPriceUzs).toLocaleString('ru-RU'))} ${t('common.currency')}`
      : null;
  const vehicleLabel = activeVehicle
    ? `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model ?? ''}`.trim()
    : null;
  // `description` is the backend's "Brand · Category" meta line — richer than
  // the bare brand, so prefer it and fall back when the part carries neither.
  const eyebrow = (item.description || item.brand || '').trim();
  // The fit zone's hairline must not strand itself. `ItemVehicleCta` renders
  // nothing once a vehicle is known and the check is done, so a part whose
  // check returned no verdict for a known car leaves the whole zone empty.
  const showFitZone =
    item.isUniversal || !!compat || !vehicleLabel || (compatLoading && !!vehicleLabel);
  const fits = item.fits ?? [];
  const makeFits = item.makeFits ?? [];
  const features = item.features ?? [];

  const toggleFavorite = () => {
    const nowFav = toggleLike(item.id);
    toast.info(nowFav ? t('itemDetail.savedToFavorites') : t('itemDetail.removedFromFavorites'));
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
  // and land on Cart.
  const commitAddToCart = (destination: '/cart' | '/checkout' = '/cart') => {
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
    // Add-to-cart REPLACES onto the Cart tab (the item page is done). Buy now
    // PUSHES checkout, so backing out of checkout returns to the part rather
    // than dumping the shopper on a tab they didn't choose.
    if (destination === '/checkout') router.push(destination);
    else router.replace(destination);
  };

  // Guest-first purchase gate: guests go to Sign In. Signed-in users add
  // straight away — UNLESS the fit check says the part doesn't fit the active
  // vehicle, in which case a Safety Gate confirms intent first (cuts returns /
  // wrong-fit deliveries).
  const addToCart = (destination: '/cart' | '/checkout' = '/cart') => {
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
          onPress: () => commitAddToCart(destination),
        },
      ]);
      return;
    }
    commitAddToCart(destination);
  };

  return (
    <AppView flex={1} colorName="background" testID="item-detail-screen">
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
          useNativeDriver: true,
        })}
      >
        {/* Full-bleed gallery, running under the status bar. */}
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
            <ItemIdentity
              eyebrow={eyebrow}
              badge={item.badge}
              title={item.title}
              titleDetail={item.titleDetail}
              oem={item.oem}
              gm={item.gm}
            />

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
              keep the real backend check, which renders nothing until an answer
              arrives; with no garage vehicle the CTA is the one-tap way to get
              one, and mid-check it says the check is running. */}
          {showFitZone ? <ItemRule /> : null}
          {!showFitZone ? null : item.isUniversal ? (
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
              <ItemVehicleCta
                checking={compatLoading && !compat}
                vehicleLabel={vehicleLabel}
                onPress={() => router.navigate('/garage')}
              />
            </AppView>
          )}

          {/* ZONE 3 — when it lands and how you pay. Plain sentences, no box. */}
          <ItemRule />
          <ItemAssuranceCard
            item={item}
            projectedSubtotal={totals.subtotal + unitPrice * qty}
            freeShippingThreshold={freeShippingThreshold}
            formatCurrency={formatCurrency}
          />

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
      </Animated.ScrollView>

      <ItemTitleBar title={item.title} height={barHeight} opacity={barOpacity} />

      <ItemFloatingControls
        top={insets.top + 6}
        isFavorite={isFavorite}
        onBack={() => router.back()}
        onShare={shareCurrentItem}
        onToggleFavorite={toggleFavorite}
      />

      <ItemBuyBar
        total={formatCurrency(unitPrice * qty)}
        savingsLabel={savingsLabel}
        qty={qty}
        onQtyChange={setQty}
        outOfStock={outOfStock}
        onAddToCart={() => addToCart('/cart')}
        onBuyNow={() => addToCart('/checkout')}
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
 * Spec rows for the table: the catalog's own `specs`, prefixed with the
 * KIND-specific attributes the backend keeps outside `specs` — a motor oil's
 * viscosity/type/volume, an antifreeze's net weight. Without this they'd never
 * reach the shopper, since `specs` is only ever the shared fields.
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

  return [...kindRows, ...(item.specs ?? [])];
}
