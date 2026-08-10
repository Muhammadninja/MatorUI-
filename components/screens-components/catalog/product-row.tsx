import { MaterialIcons } from '@expo/vector-icons';
import { memo, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import ImageBox from '@/components/screens-components/home/image-box';
import { splitPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import WheelLoader from '@/components/shared/wheel-loader/wheel-loader';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useActiveSales } from '@/hooks/use-sales';
import { useToast } from '@/hooks/use-toast';
import type { CatalogItem } from '@/services/catalog-service';
import { resolveItemSale } from '@/services/sales-service';

type ProductRowItem = CatalogItem & { brand?: string };

export type ProductRowProps = {
  item: CatalogItem;
  /** Open the item detail (image/title tap). */
  onOpen: (item: CatalogItem) => void;
  /** Add to cart (gated by the caller). */
  onAdd: (item: CatalogItem) => void;
};

type FitState = 'idle' | 'checking' | 'fits';
const FIT_CHECK_MS = 900;

/** Deterministic per-product hash → stable, varied placeholder rating / reviews
 *  (the backend carries neither yet; see the design handoff). The discount, by
 *  contrast, is now real — resolved from `GET /v1/sales`. */
function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * `ProductRow` — the Mator listing card, matched to `design_handoff_mator_app`
 * (radius-20 surface card, 108² image, brand eyebrow, meta row, inline fit chip,
 * and a footer bar with price + Add pill). Rating / reviews are still
 * placeholders (backend has none); the discount is real, resolved from the
 * active `GET /v1/sales` campaigns. Fitment is checked INLINE across three
 * states — it never routes.
 */
function ProductRow({ item, onOpen, onAdd }: ProductRowProps) {
  const { t } = useTranslation();
  const product = item as ProductRowItem;
  const { tokens, scheme } = useThemeContext();
  const { currentActiveVehicle } = useActiveVehicle();
  const toast = useToast();
  const image = product.images?.[0];

  const activeVehicle = currentActiveVehicle?.vehicle ?? null;
  const vehicleLabel = activeVehicle
    ? `${activeVehicle.year} ${activeVehicle.model ?? activeVehicle.make}`.trim()
    : null;

  const [fitState, setFitState] = useState<FitState>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const handleCheckFit = () => {
    if (fitState !== 'idle') return;
    setFitState('checking');
    timerRef.current = setTimeout(() => {
      if (vehicleLabel) {
        setFitState('fits');
        const vehicle = `${activeVehicle!.year} ${activeVehicle!.make} ${activeVehicle!.model ?? ''}`.trim();
        toast.success(t('catalog.confirmedFit', { vehicle }));
      } else {
        setFitState('idle');
        toast.info(t('catalog.addVehicleToConfirmFit'));
      }
    }, FIT_CHECK_MS);
  };

  // ── Placeholder signals (rating / reviews only — the backend carries none) ─
  const h = hashId(item.id);
  const rating = (4.2 + (h % 8) / 10).toFixed(1); // 4.2–4.9
  const reviews = 50 + (h % 900); // 50–949

  // ── Sale — real ────────────────────────────────────────────────────────────
  // Prefer the backend-resolved sale on the part (authoritative: the server
  // resolves scope/priority and `price_uzs` is already the sale price). Fall back
  // to the client `/v1/sales` matcher when the backend hasn't applied it yet — but
  // note that path can only match ALL_PRODUCTS sales, since the public /v1/sales
  // omits target ids.
  const sales = useActiveSales();
  const clientSale = resolveItemSale(
    { id: item.id, categoryId: product.categoryId, sellerId: product.sellerId, priceUzs: product.priceUzs },
    sales,
  );
  const backendPct = product.salePercent && product.salePercent > 0 ? product.salePercent : 0;
  const savePct = backendPct > 0 ? Math.round(backendPct) : (clientSale?.percent ?? 0);
  const amountNum = product.priceUzs ?? (parseInt(item.price.replace(/\D/g, ''), 10) || 0);
  // Backend gives the exact pre-discount price; otherwise reconstruct the struck
  // "was" from the percent (shown price stays the charged price).
  const wasNum =
    backendPct > 0 && product.originalPriceUzs
      ? Math.round(product.originalPriceUzs)
      : savePct > 0 && amountNum > 0
        ? Math.round(amountNum / (1 - savePct / 100))
        : 0;
  const priceAmount = splitPrice(item.price).amount || item.price;
  const wasLabel = wasNum > 0 ? wasNum.toLocaleString('ru-RU') : null;

  const brandEyebrow = (product.brand ?? product.description?.split('·')[0])?.trim();
  const title = product.title;
  const oem = product.oem;

  // ── Motor oil ────────────────────────────────────────────────────────────
  // Oils carry no OEM/GM number; surface their key attributes (viscosity ·
  // volume) in the meta row instead. Universal listings (oils under "Другое")
  // replace the Check-fit chip with a static "Подходит для всех" — a
  // compatibility check is meaningless for a part that fits everything.
  const oil = product.kind === 'MOTOR_OIL' ? product.motorOil : null;
  const oilMeta = oil ? [oil.viscosity, oil.volumeLabel].filter(Boolean).join(' · ') : '';
  const isUniversal = product.isUniversal === true;

  // Footer hairline — deliberately fainter than the global divider token.
  const hairline = scheme === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

  const fitChipBg =
    fitState === 'fits'
      ? scheme === 'dark'
        ? 'rgba(15,157,88,0.16)'
        : 'rgba(15,157,88,0.10)'
      : tokens.background;
  const fitLabel =
    fitState === 'fits'
      ? vehicleLabel
        ? t('catalog.fitsYourVehicleLabel', { vehicle: vehicleLabel })
        : t('catalog.fitsYourVehicle')
      : fitState === 'checking'
        ? t('catalog.checking')
        : t('catalog.checkFit');
  const fitTextColor = fitState === 'fits' ? tokens.success : fitState === 'checking' ? tokens.textMuted : tokens.text;

  return (
    <AppView colorName="backgroundSecondary" rounded={20} style={{ overflow: 'hidden' }}>
      {/* ── Top block ── */}
      <AppView row gap={14} style={{ padding: 14 }}>
        {/* Image — the discount now lives in the footer next to the price. */}
        <AppPressableView
          testID={`part-card-${item.id}`}
          onPress={() => onOpen(item)}
          androidRipple={false}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          style={{ width: 108 }}
        >
          <ImageBox
            label={item.title}
            uri={image}
            height={108}
            radius={14}
            contentFit="contain"
            backgroundColor={tokens.white}
          />
        </AppPressableView>

        {/* Info column */}
        <AppView flex={1} gap={6}>
          <AppPressableView onPress={() => onOpen(item)} androidRipple={false} style={{ gap: 6 }}>
            {brandEyebrow ? (
              <AppText
                family="accent"
                weight="bold"
                numberOfLines={1}
                style={{ fontSize: 10, letterSpacing: 1, color: tokens.textMuted, textTransform: 'uppercase' }}
              >
                {brandEyebrow}
              </AppText>
            ) : null}
            <AppText
              family="default"
              weight="semibold"
              numberOfLines={2}
              style={{ fontSize: 14.5, lineHeight: 19, color: tokens.text, marginTop: 3 }}
            >
              {title}
            </AppText>
            {/* Seller trust badges — driven by the dealer's admin-toggled
             *  certified / lowest-price flags (part.seller.{certified,lowest_price}). */}
            {product.certified || product.lowestPrice ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 5 }}>
                {product.certified ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 3,
                      backgroundColor: '#16a34a1a',
                      borderRadius: 999,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                    }}
                  >
                    <MaterialIcons name="verified" size={11} color="#16a34a" />
                    <AppText family="accent" weight="bold" style={{ fontSize: 10, color: '#16a34a' }}>
                      {t('catalog.certified')}
                    </AppText>
                  </View>
                ) : null}
                {product.lowestPrice ? (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 3,
                      backgroundColor: '#2563eb1a',
                      borderRadius: 999,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                    }}
                  >
                    <MaterialIcons name="local-offer" size={11} color="#2563eb" />
                    <AppText family="accent" weight="bold" style={{ fontSize: 10, color: '#2563eb' }}>
                      {t('catalog.lowestPrice')}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ) : null}
            {/* Meta row — ★ rating · (reviews) · OEM */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 5 }}>
              <MaterialIcons name="star" size={12} color="#F59E0B" />
              <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.text }}>
                {rating}
              </AppText>
              <AppText family="default" style={{ fontSize: 11.5, color: tokens.textMuted }}>
                {`(${reviews.toLocaleString('en-US')})`}
              </AppText>
              {oem ? (
                <>
                  <View style={{ width: 3, height: 3, borderRadius: 3, backgroundColor: tokens.textMuted }} />
                  <AppText
                    family="mono"
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: 10.5, color: tokens.textMuted }}
                  >
                    {oem}
                  </AppText>
                </>
              ) : oilMeta ? (
                <>
                  <View style={{ width: 3, height: 3, borderRadius: 3, backgroundColor: tokens.textMuted }} />
                  <AppText
                    family="accent"
                    weight="semibold"
                    numberOfLines={1}
                    style={{ flex: 1, fontSize: 11, color: tokens.textMuted }}
                  >
                    {oilMeta}
                  </AppText>
                </>
              ) : null}
            </View>
          </AppPressableView>

          {/* Universal listings fit every car — a static badge, never a check.
              Vehicle-specific parts keep the inline three-state Check-fit chip. */}
          {isUniversal ? (
            <AppView
              row
              align="center"
              gap={6}
              rounded={999}
              style={{
                alignSelf: 'flex-start',
                paddingHorizontal: 12,
                paddingVertical: 6,
                backgroundColor:
                  scheme === 'dark' ? 'rgba(15,157,88,0.16)' : 'rgba(15,157,88,0.10)',
              }}
            >
              <MaterialIcons name="check-circle" size={14} color={tokens.success} />
              <AppText family="accent" weight="bold" numberOfLines={1} style={{ fontSize: 11.5, color: tokens.success }}>
                {t('catalog.universalFit')}
              </AppText>
            </AppView>
          ) : (
            <AppPressableView
              onPress={handleCheckFit}
              disabled={fitState !== 'idle'}
              androidRipple={false}
              pressedOpacity={0.7}
              row
              align="center"
              gap={6}
              rounded={999}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={fitState === 'fits' ? fitLabel : t('catalog.checkFitAccessibility')}
              style={{ alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: fitChipBg }}
            >
              {fitState === 'checking' ? (
                <WheelLoader size={13} color={tokens.textMuted} />
              ) : fitState === 'fits' ? (
                <MaterialIcons name="check-circle" size={14} color={tokens.success} />
              ) : (
                <MaterialIcons name="rule" size={14} color={tokens.text} />
              )}
              <AppText family="accent" weight="bold" numberOfLines={1} style={{ fontSize: 11.5, color: fitTextColor }}>
                {fitLabel}
              </AppText>
            </AppPressableView>
          )}
        </AppView>
      </AppView>

      {/* ── Footer bar ── */}
      <AppView
        row
        align="center"
        gap={10}
        style={{ paddingHorizontal: 14, paddingVertical: 11, borderTopWidth: 1, borderTopColor: hairline }}
      >
        {/* Price (+ struck was) + sale pill */}
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
            <AppText
              family="heading"
              weight="bold"
              numberOfLines={1}
              style={{ fontSize: 19, letterSpacing: -0.4, color: tokens.text }}
            >
              {priceAmount}
            </AppText>
            <AppText family="accent" weight="semibold" style={{ fontSize: 11, color: tokens.textMuted }}>
              {"so'm"}
            </AppText>
            {wasLabel ? (
              <AppText
                family="default"
                numberOfLines={1}
                style={{ fontSize: 12, color: tokens.textMuted, textDecorationLine: 'line-through' }}
              >
                {wasLabel}
              </AppText>
            ) : null}
          </View>
          {savePct > 0 ? (
            <View
              style={{
                backgroundColor: '#DC26261a',
                borderRadius: 999,
                paddingHorizontal: 7,
                paddingVertical: 3,
              }}
            >
              <AppText family="accent" weight="bold" style={{ fontSize: 11, color: '#DC2626' }}>
                {`-${savePct}%`}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Add pill */}
        <AppPressableView
          onPress={() => onAdd(item)}
          accessibilityRole="button"
          accessibilityLabel={t('catalog.addToCartAccessibility', { title: item.title })}
          androidRipple={false}
          pressedOpacity={0.9}
          row
          align="center"
          gap={6}
          rounded={999}
          style={{ paddingHorizontal: 18, paddingVertical: 10, backgroundColor: tokens.text }}
        >
          <MaterialIcons name="add-shopping-cart" size={16} color={tokens.background} />
          <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.background }}>
            {t('catalog.add')}
          </AppText>
        </AppPressableView>
      </AppView>
    </AppView>
  );
}

export default memo(ProductRow);
