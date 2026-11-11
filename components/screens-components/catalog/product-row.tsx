import { Check, CircleAlert, Heart, Plus, X } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View, type ViewStyle } from 'react-native';

import ImageBox from '@/components/screens-components/home/image-box';
import { AppIconButton } from '@/components/shared/app-icon-button';
import { splitPrice } from '@/components/shared/app-price';
import { formatSomAmount } from '@/utils/format-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import WheelLoader from '@/components/shared/wheel-loader/wheel-loader';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useLikesContext } from '@/contexts/likes.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useActiveSales } from '@/hooks/use-sales';
import { useToast } from '@/hooks/use-toast';
import type { CatalogItem } from '@/services/catalog-service';
import { checkCompatibility, type CompatibilityResult } from '@/services/compatibility-service';
import { resolveItemPricing } from '@/services/sales-service';
import { triggerHaptic } from '@/utils/haptics';

export type ProductRowProps = {
  item: CatalogItem;
  /** Open the item detail (image/title tap). */
  onOpen: (item: CatalogItem) => void;
  /** Add to cart (gated by the caller). */
  onAdd: (item: CatalogItem) => void;
};

type FitState = 'idle' | 'checking' | 'answered';

const ADDED_FEEDBACK_MS = 1500;
const SCREEN_GUTTER = 16;
const GRID_GAP = 8;
/** Above this system text scale two columns stop being usable. */
const ONE_COLUMN_FONT_SCALE = 1.3;

/** Columns of the product grid: two, or one under large accessibility text. */
export function useProductGridColumns(): number {
  const { fontScale } = useWindowDimensions();
  return fontScale >= ONE_COLUMN_FONT_SCALE ? 1 : 2;
}

/** The padding that puts a grid cell on the screen gutters with an exact gap,
 *  without insetting the list's full-width header. */
export function productCellStyle(index: number, columns: number): ViewStyle {
  const column = index % columns;
  return {
    flex: 1,
    paddingLeft: column === 0 ? SCREEN_GUTTER : GRID_GAP / 2,
    paddingRight: column === columns - 1 ? SCREEN_GUTTER : GRID_GAP / 2,
    paddingBottom: GRID_GAP,
  };
}

/**
 * Price type size. Every real price gets the SAME one (18) — the steps below
 * exist only for an amount long enough to crowd the add button out of the row,
 * which in UZS means eight figures and up.
 *
 * It cannot be left to `adjustsFontSizeToFit` alone: paired with an explicit
 * `lineHeight` that prop shrinks the text to a few pixels on iOS while its box
 * keeps the full width, which is what stranded the currency mid-card. The
 * amount is only ever digits and non-breaking separators, so the size that
 * fits the copy column follows from the character count.
 */
function priceFontSize(amount: string): number {
  const n = amount.length;
  if (n <= 7) return 18;
  if (n <= 10) return 16;
  return 14;
}

/**
 * `ProductRow` — the listing card behind every result screen (category,
 * vehicle parts, catalog directory, favorites), laid out for a two-column grid:
 * image with the heart on top, then title, brand, fitment, and price + add at
 * the foot of the card.
 *
 * Everything shown is a backend field. Stars render only when the part really
 * has a rating (`rating_avg` / `review_count`); unreviewed parts show none
 * rather than an invented score. The fitment badge runs the REAL compatibility
 * check against the active garage vehicle and is never inferred.
 */
function ProductRow({ item, onOpen, onAdd }: ProductRowProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { currentActiveVehicle } = useActiveVehicle();
  const { isLiked, toggleLike } = useLikesContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  const image = item.images?.[0];
  const activeVehicle = currentActiveVehicle?.vehicle ?? null;
  const vehicleLabel = activeVehicle
    ? `${activeVehicle.year} ${activeVehicle.model ?? activeVehicle.make}`.trim()
    : null;

  // ── Fit check — real, on demand ────────────────────────────────────────────
  const [fitState, setFitState] = useState<FitState>('idle');
  const [fit, setFit] = useState<CompatibilityResult | null>(null);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  // FlashList RECYCLES row components: the same instance is handed a different
  // part as you scroll, without unmounting. Without this reset the previous
  // part's fit verdict would still be on screen, attached to the wrong product.
  useEffect(() => {
    setFitState('idle');
    setFit(null);
  }, [item.id]);

  const handleCheckFit = useCallback(async () => {
    if (fitState !== 'idle') return;
    const vehicleId = currentActiveVehicle?.vehicleId;
    const vin = currentActiveVehicle?.vehicle?.vin;
    if (!vehicleId && !vin) {
      toast.info(t('catalog.addVehicleToConfirmFit'));
      return;
    }
    setFitState('checking');
    const result = await checkCompatibility(item.id, { vehicleId, vin });
    if (!alive.current) return;
    if (!result) {
      // The check couldn't run (offline, mock transport, server error). Say so
      // and reset — never fall back to a fabricated "fits".
      setFitState('idle');
      toast.warning(t('catalog.fitCheckUnavailable'));
      return;
    }
    setFit(result);
    setFitState('answered');
  }, [currentActiveVehicle, fitState, item.id, t, toast]);

  // ── Sale — real ────────────────────────────────────────────────────────────
  const sales = useActiveSales();
  const { savePct, wasUzs: wasNum } = resolveItemPricing(item, sales);
  const priceAmount = splitPrice(item.price).amount || item.price;
  const priceSize = priceFontSize(priceAmount);
  const wasLabel = wasNum > 0 ? formatSomAmount(wasNum) : null;

  const brandEyebrow = (item.brand ?? item.description?.split('·')[0])?.trim();
  const outOfStock = /out of stock/i.test(item.status ?? '');

  // Oils carry no OEM/GM number; their viscosity · volume goes in that slot.
  const oil = item.kind === 'MOTOR_OIL' ? item.motorOil : null;
  const oilMeta = oil ? [oil.viscosity, oil.volumeLabel].filter(Boolean).join(' · ') : '';
  const secondary = [item.titleDetail || oilMeta, item.oem ? `OEM ${item.oem}` : '']
    .filter(Boolean)
    .join(' · ');

  const eta =
    item.deliveryEtaMinDays != null && item.deliveryEtaMaxDays != null
      ? t('catalog.deliveryDaysRange', {
          min: item.deliveryEtaMinDays,
          max: item.deliveryEtaMaxDays,
        })
      : null;

  const fitTone =
    fit?.badge.color === 'green'
      ? { color: tokens.success, bg: tokens.successSoft, Icon: Check }
      : fit?.badge.color === 'red'
        ? { color: tokens.error, bg: tokens.errorSoft, Icon: X }
        : { color: tokens.warning, bg: tokens.warningSoft, Icon: CircleAlert };

  // ── Favorite — the same like state and toast as Item Detail ────────────────
  const liked = isLiked(item.id);
  const handleToggleLike = () => {
    triggerHaptic(liked ? 'selection' : 'success');
    const nowLiked = toggleLike(item.id);
    toast.success(t(nowLiked ? 'itemDetail.savedToFavorites' : 'itemDetail.removedFromFavorites'));
  };

  // ── Add — the cart update is optimistic, so "added" is the feedback and the
  // pause blocks a duplicate tap. Guests are sent to sign-in by the caller and
  // never see it. Cart failures surface through the cart context.
  const [added, setAdded] = useState(false);
  useEffect(() => {
    setAdded(false);
  }, [item.id]);
  useEffect(() => {
    if (!added) return;
    const timer = setTimeout(() => setAdded(false), ADDED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [added]);
  const handleAdd = () => {
    if (added) return;
    onAdd(item);
    if (isAuthenticated) setAdded(true);
  };

  return (
    <AppView
      flex={1}
      rounded={12}
      colorName="card"
      borderWidth={1}
      borderName="border"
      gap="sm"
      style={{ padding: 12 }}
    >
      {/* The testID lives on the image: E2E taps an element's centre, and this
       *  one always opens detail. */}
      <AppView style={{ aspectRatio: 1, width: '100%' }}>
        <AppPressableView
          testID={`part-card-${item.id}`}
          onPress={() => onOpen(item)}
          androidRipple={false}
          accessibilityRole="button"
          accessibilityLabel={item.title}
          style={{ flex: 1 }}
        >
          <ImageBox
            label={item.title}
            uri={image}
            height="100%"
            radius={8}
            contentFit="contain"
            backgroundColor={tokens.white}
          />
        </AppPressableView>
        {/* GM cross-reference, cornered on the photo. A part carries OEM xor GM
         *  (see `resolvePartNumber`), and the GM number is THE identifier in
         *  this market — Chevrolet / Ravon / Daewoo are the UZ fleet. */}
        {item.gm ? (
          <AppView
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              maxWidth: '100%',
              paddingHorizontal: 5,
              paddingVertical: 2,
              borderTopRightRadius: 8,
              borderBottomLeftRadius: 8,
              backgroundColor: tokens.scrim,
            }}
          >
            <AppText
              family="mono"
              weight="bold"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{ fontSize: 10, letterSpacing: 0.2, color: tokens.white }}
            >
              {`GM ${item.gm}`}
            </AppText>
          </AppView>
        ) : null}
        <AppPressableView
          testID={`part-like-${item.id}`}
          onPress={handleToggleLike}
          androidRipple={false}
          pressedOpacity={0.7}
          center
          accessibilityRole="button"
          accessibilityLabel={
            liked ? t('itemDetail.removeFromFavorites') : t('itemDetail.saveToFavorites')
          }
          accessibilityState={{ selected: liked }}
          style={{ position: 'absolute', top: -8, right: -8, width: 48, height: 48 }}
        >
          <Heart
            size={20}
            strokeWidth={2.2}
            // The photo is white in both themes, so the heart takes the
            // on-photo inks rather than the page's.
            color={liked ? tokens.onPhotoAccent : tokens.onPhotoMuted}
            fill={liked ? tokens.onPhotoAccent : 'transparent'}
          />
        </AppPressableView>
      </AppView>

      {/* Tags, the way a storefront flags a listing. */}
      {item.bestseller || item.certified || item.lowestPrice ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
          {item.bestseller ? (
            <Tag label={t('catalog.bestseller')} color={tokens.text} bg={tokens.warningSoft} />
          ) : null}
          {item.certified ? (
            <Tag
              label={t('catalog.matorCertified')}
              color={tokens.success}
              bg={tokens.successSoft}
            />
          ) : null}
          {item.lowestPrice ? (
            <Tag label={t('catalog.lowestPrice')} color={tokens.info} bg={tokens.infoSoft} />
          ) : null}
        </View>
      ) : null}

      <AppPressableView gap={4} onPress={() => onOpen(item)} androidRipple={false}>
        {/* Two lines, then ellipsis, with the height reserved so one-line names
         *  keep the row's prices level. The full title is on Item Detail and in
         *  the image's accessibility label. */}
        <AppText
          family="default"
          weight="semibold"
          numberOfLines={2}
          style={{ fontSize: 14, lineHeight: 20, minHeight: 40, color: tokens.text }}
        >
          {item.title}
        </AppText>
        {brandEyebrow ? (
          <AppText textVariant="bodyXs" colorName="textMuted">
            {brandEyebrow}
          </AppText>
        ) : null}
        {/* Qualifiers `normalizePartTitle` lifted out of the raw title (plus an
         *  oil's viscosity · volume and the OEM number). */}
        {secondary ? (
          <AppText textVariant="bodyXs" colorName="textMuted">
            {secondary}
          </AppText>
        ) : null}
      </AppPressableView>

      {/* Real review aggregate. No reviews → no row; never a stand-in. */}
      {item.rating != null ? (
        <AppView row align="center" wrap gap={4}>
          <Stars value={item.rating} />
          <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.text }}>
            {item.rating.toFixed(1)}
          </AppText>
          {item.reviewCount ? (
            <AppText textVariant="bodyXs" colorName="textMuted">
              {t('catalog.reviewCount', { count: item.reviewCount })}
            </AppText>
          ) : null}
        </AppView>
      ) : null}

      {/* ── Fitment: a verdict badge, only from real data ── */}
      {item.isUniversal ? (
        <FitBadge
          label={t('catalog.universalFit')}
          color={tokens.success}
          bg={tokens.successSoft}
          Icon={Check}
        />
      ) : fitState === 'answered' && fit ? (
        <FitBadge
          label={fit.badge.text}
          color={fitTone.color}
          bg={fitTone.bg}
          Icon={fitTone.Icon}
        />
      ) : (
        <AppPressableView
          onPress={handleCheckFit}
          disabled={fitState === 'checking'}
          androidRipple={false}
          pressedOpacity={0.6}
          row
          align="center"
          gap={4}
          hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('catalog.checkFitAccessibility')}
          accessibilityState={{ busy: fitState === 'checking' }}
          style={{ alignSelf: 'flex-start' }}
        >
          {fitState === 'checking' ? <WheelLoader size={11} color={tokens.textMuted} /> : null}
          <AppText
            weight="semibold"
            style={{
              fontSize: 12,
              lineHeight: 16,
              color: fitState === 'checking' ? tokens.textMuted : tokens.brandText,
            }}
          >
            {fitState === 'checking'
              ? t('catalog.checking')
              : vehicleLabel
                ? t('catalog.checkFitFor', { vehicle: vehicleLabel })
                : t('catalog.checkFit')}
          </AppText>
        </AppPressableView>
      )}

      {/* ── Price and add, pinned to the card's foot so they line up across the
       *  row whatever the copy above them runs to. ── */}
      <AppView row align="flex-end" gap="sm" style={{ marginTop: 'auto' }}>
        <AppView flex={1} gap={2} style={{ minWidth: 0 }}>
          {wasLabel || savePct > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 4 }}>
              {wasLabel ? (
                <AppText
                  textVariant="bodyXs"
                  colorName="textMuted"
                  style={{ textDecorationLine: 'line-through' }}
                >
                  {wasLabel}
                </AppText>
              ) : null}
              {savePct > 0 ? (
                <AppText
                  family="accent"
                  weight="bold"
                  style={{ fontSize: 12, color: tokens.error }}
                >
                  {`−${savePct}%`}
                </AppText>
              ) : null}
            </View>
          ) : null}
          {/* Amount + currency are ONE unit that wraps as a block; the amount
           *  itself stays on one line. `priceFontSize` already fits it, so the
           *  auto-shrink is a backstop and carries NO explicit `lineHeight`,
           *  the pair that collapses the text on iOS. */}
          <View
            style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 4 }}
          >
            <AppText
              family="heading"
              weight="bold"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={{ fontSize: priceSize, fontVariant: ['tabular-nums'], color: tokens.text }}
            >
              {priceAmount}
            </AppText>
            <AppText textVariant="bodyXs" weight="medium" colorName="textMuted">
              {t('common.currency')}
            </AppText>
          </View>
          {/* Stock first — it decides whether the delivery promise means
           *  anything — then the ETA when the part carries one. */}
          {outOfStock ? (
            <AppText
              family="accent"
              weight="semibold"
              style={{ fontSize: 12, lineHeight: 16, color: tokens.error }}
            >
              {t('catalog.outOfStock')}
            </AppText>
          ) : eta ? (
            <AppText textVariant="bodyXs" colorName="textMuted">
              {eta}
            </AppText>
          ) : null}
        </AppView>

        <AppIconButton
          Icon={added ? Check : Plus}
          onPress={handleAdd}
          disabled={outOfStock}
          size={48}
          rounded={12}
          iconSize={22}
          strokeWidth={2.6}
          backgroundColor={outOfStock ? tokens.disabledBg : tokens.brand}
          color={outOfStock ? tokens.disabledFg : tokens.onBrand}
          accessibilityLabel={
            outOfStock
              ? t('catalog.outOfStock')
              : added
                ? t('catalog.addedToCart')
                : t('catalog.addToCartAccessibility', { title: item.title })
          }
        />
      </AppView>
    </AppView>
  );
}

/** Icon + text, so a verdict never rests on colour alone. */
function FitBadge({
  label,
  color,
  bg,
  Icon,
}: {
  label: string;
  color: string;
  bg: string;
  Icon: typeof Check;
}) {
  return (
    <AppView
      row
      align="flex-start"
      gap={4}
      rounded={8}
      px={6}
      py={4}
      style={{ alignSelf: 'flex-start', backgroundColor: bg }}
    >
      <Icon size={14} strokeWidth={2.6} color={color} style={{ marginTop: 1 }} />
      <AppText weight="medium" style={{ flexShrink: 1, fontSize: 12, lineHeight: 16, color }}>
        {label}
      </AppText>
    </AppView>
  );
}

/** Five glyphs, filled to the nearest half — the storefront rating convention,
 *  set in type so it carries no icon dependency. */
function Stars({ value }: { value: number }) {
  const { tokens } = useThemeContext();
  const filled = Math.round(value);
  return (
    <AppText family="accent" weight="bold" style={{ fontSize: 12, letterSpacing: 0.5 }}>
      <AppText style={{ color: tokens.rating }}>{'★'.repeat(Math.min(5, filled))}</AppText>
      <AppText style={{ color: tokens.gray300 }}>{'★'.repeat(Math.max(0, 5 - filled))}</AppText>
    </AppText>
  );
}

/** Small filled tag above the title (bestseller, certified, lowest price). */
function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <AppView rounded={8} px={6} py={2} style={{ backgroundColor: bg }}>
      <AppText weight="medium" style={{ fontSize: 12, lineHeight: 16, color }}>
        {label}
      </AppText>
    </AppView>
  );
}

export default memo(ProductRow);
