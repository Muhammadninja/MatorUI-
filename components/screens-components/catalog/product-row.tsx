import { Plus } from 'lucide-react-native';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useWindowDimensions, View } from 'react-native';

import ImageBox from '@/components/screens-components/home/image-box';
import { AppIconButton } from '@/components/shared/app-icon-button';
import { splitPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import WheelLoader from '@/components/shared/wheel-loader/wheel-loader';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useActiveSales } from '@/hooks/use-sales';
import { useToast } from '@/hooks/use-toast';
import type { CatalogItem } from '@/services/catalog-service';
import { checkCompatibility, type CompatibilityResult } from '@/services/compatibility-service';
import { resolveItemPricing } from '@/services/sales-service';

export type ProductRowProps = {
  item: CatalogItem;
  /** Open the item detail (image/title tap). */
  onOpen: (item: CatalogItem) => void;
  /** Add to cart (gated by the caller). */
  onAdd: (item: CatalogItem) => void;
};

type FitState = 'idle' | 'checking' | 'answered';

/**
 * Row sizing. The row is sized so that roughly THREE listings fill one
 * screenful — the catalog reads as a stack of real cards you flick through,
 * not a dense price list.
 *
 * The height is derived from the window rather than hard-coded, because
 * "three per screen" is a statement about the scrollable area, not about a
 * pixel count: `LIST_CHROME` is everything that is never list (status bar +
 * screen header, the results toolbar, the tab bar), and what is left over is
 * split three ways, clamped so the row stays sane on a small phone and does
 * not balloon on a tablet.
 */
const LIST_CHROME = 240;
const MIN_ROW = 186;
const MAX_ROW = 264;
/** Image column width as a share of the row height. The photo stretches to the
 *  row's full inner height, so this ratio is what keeps the picture a generous
 *  portrait block without starving the copy column on a narrow phone. */
const THUMB_RATIO = 0.64;

/**
 * `ProductRow` — the listing card behind every result screen (category,
 * vehicle parts, catalog directory).
 *
 * Laid out like an Amazon search result: a tall image column on the left, and
 * ONE copy column on the right that runs the whole height — tag, brand, title,
 * stars, fitment, price, delivery, and the add button. Nothing is stacked
 * across the full card width, so the image can be large without pushing the
 * buy affordance off-screen.
 *
 * Fitment is a single line of coloured text under the rating (Amazon's "This
 * fits your 2022 Chevrolet Cobalt"), not a padded chip on its own row — that
 * row is what used to cap the image size.
 *
 * Everything shown is a backend field. Stars render only when the part really
 * has a rating (`rating_avg` / `review_count`); unreviewed parts show none
 * rather than an invented score. The fitment line runs the REAL compatibility
 * check against the active garage vehicle.
 */
function ProductRow({ item, onOpen, onAdd }: ProductRowProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { currentActiveVehicle } = useActiveVehicle();
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
      toast.info(t('catalog.fitCheckUnavailable'));
      return;
    }
    setFit(result);
    setFitState('answered');
  }, [currentActiveVehicle, fitState, item.id, t, toast]);

  // ── Sale — real ────────────────────────────────────────────────────────────
  const sales = useActiveSales();
  const { savePct, wasUzs: wasNum } = resolveItemPricing(item, sales);
  const priceAmount = splitPrice(item.price).amount || item.price;
  const wasLabel = wasNum > 0 ? wasNum.toLocaleString('ru-RU') : null;

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

  const { height: windowHeight } = useWindowDimensions();
  const rowHeight = Math.round(
    Math.max(MIN_ROW, Math.min(MAX_ROW, (windowHeight - LIST_CHROME) / 3)),
  );
  const thumb = Math.round(rowHeight * THUMB_RATIO);

  const fitColor =
    fit?.badge.color === 'green'
      ? tokens.success
      : fit?.badge.color === 'red'
        ? tokens.error
        : tokens.warning;

  return (
    // Flat, full-bleed row — no card surface, no corner radius, no outer
    // margin. The list draws a hairline between rows; the only inset is the
    // text's own breathing room from the screen edge.
    <AppView
      row
      gap={14}
      style={{ paddingHorizontal: 16, paddingVertical: 15, minHeight: rowHeight }}
    >
      {/* ── Image column ── */}
      {/* The testID lives HERE, not on the card root: E2E taps an element's
       *  centre, and the card's centre now falls on the copy column (the fit
       *  link, or the add button) rather than on something that opens detail. */}
      <AppPressableView
        testID={`part-card-${item.id}`}
        onPress={() => onOpen(item)}
        androidRipple={false}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={{ width: thumb, alignSelf: 'stretch' }}
      >
        <ImageBox
          label={item.title}
          uri={image}
          height="100%"
          radius={8}
          contentFit="contain"
          backgroundColor={tokens.white}
        />
        {/* GM cross-reference, cornered on the photo. A part carries OEM xor GM
         *  (see `resolvePartNumber`), and the GM number is THE identifier in
         *  this market — Chevrolet / Ravon / Daewoo are the UZ fleet — so a GM
         *  part gets a corner tag instead of hiding the number in the meta
         *  line. Small, but dark-on-photo so it reads at a glance. */}
        {item.gm ? (
          <AppView
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              maxWidth: thumb,
              paddingHorizontal: 5,
              paddingVertical: 2,
              borderTopLeftRadius: 8,
              borderBottomRightRadius: 7,
              backgroundColor: tokens.scrim,
            }}
          >
            <AppText
              family="mono"
              weight="bold"
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={{ fontSize: 9, letterSpacing: 0.2, color: tokens.white }}
            >
              {`GM ${item.gm}`}
            </AppText>
          </AppView>
        ) : null}
      </AppPressableView>

      {/* ── Copy column — runs the full card height ── */}
      {/* `space-between` (with the gap as the floor) distributes the taller
       *  row's extra height instead of parking it under the last line: the
       *  name stays at the top edge, price and add sit at the bottom, level
       *  with the base of the photo. */}
      <AppView flex={1} gap={5} justify="space-between">
        {/* Tags above the title, the way a storefront flags a listing. */}
        {item.bestseller || item.certified || item.lowestPrice ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 5 }}>
            {item.bestseller ? (
              <Tag label={t('catalog.bestseller')} color={tokens.onValue} bg={tokens.rating} />
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

        <AppPressableView gap={3} onPress={() => onOpen(item)} androidRipple={false}>
          {brandEyebrow ? (
            <AppText
              family="accent"
              weight="bold"
              style={{
                fontSize: 10.5,
                letterSpacing: 1,
                color: tokens.textMuted,
                textTransform: 'uppercase',
              }}
            >
              {brandEyebrow}
            </AppText>
          ) : null}

          <AppText
            family="default"
            weight="semibold"
            style={{ fontSize: 15.5, lineHeight: 20.5, color: tokens.text }}
          >
            {item.title}
          </AppText>

          {/* Qualifiers `normalizePartTitle` lifted out of the raw title (plus
           *  an oil's viscosity · volume and the OEM number) — the detail that
           *  was glued to the name. */}
          {secondary ? (
            <AppText
              family="default"
              style={{ fontSize: 12, lineHeight: 16, color: tokens.textMuted }}
            >
              {secondary}
            </AppText>
          ) : null}
        </AppPressableView>

        {/* Real review aggregate. No reviews → no row; never a stand-in. */}
        {item.rating != null ? (
          <AppView row align="center" gap={5}>
            <Stars value={item.rating} />
            <AppText family="accent" weight="bold" style={{ fontSize: 11.5, color: tokens.text }}>
              {item.rating.toFixed(1)}
            </AppText>
            {item.reviewCount ? (
              <AppText family="default" style={{ fontSize: 11, color: tokens.textMuted }}>
                {t('catalog.reviewCount', { count: item.reviewCount })}
              </AppText>
            ) : null}
          </AppView>
        ) : null}

        {/* ── Fitment: ONE line of coloured text, no chrome ── */}
        {item.isUniversal ? (
          <AppText family="accent" weight="bold" style={{ fontSize: 11.5, color: tokens.success }}>
            {`✓ ${t('catalog.universalFit')}`}
          </AppText>
        ) : fitState === 'answered' && fit ? (
          <AppText family="accent" weight="bold" style={{ fontSize: 11.5, color: fitColor }}>
            {`${fit.badge.color === 'green' ? '✓' : fit.badge.color === 'red' ? '✕' : '!'} ${fit.badge.text}`}
          </AppText>
        ) : (
          <AppPressableView
            onPress={handleCheckFit}
            disabled={fitState === 'checking'}
            androidRipple={false}
            pressedOpacity={0.6}
            row
            align="center"
            gap={6}
            hitSlop={{ top: 8, bottom: 8, left: 6, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('catalog.checkFitAccessibility')}
            style={{ alignSelf: 'flex-start' }}
          >
            {fitState === 'checking' ? <WheelLoader size={11} color={tokens.textMuted} /> : null}
            <AppText
              family="accent"
              weight="bold"
              style={{
                fontSize: 11.5,
                color: fitState === 'checking' ? tokens.textMuted : tokens.info,
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

        {/* ── Price, and the add control on the far right ── */}
        {/* The add affordance is a single `+` pinned to the right edge of this
         *  row, not a full-width pill: the pill spanned the whole copy column,
         *  read as the card's primary surface, and pushed the real content
         *  (title, fitment, price) into the top half of the row. A `+` says
         *  "add this" in the space a chevron would take. */}
        <AppView row align="center" gap={10} style={{ marginTop: 3 }}>
          <AppView flex={1} gap={2}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                columnGap: 7,
                rowGap: 2,
              }}
            >
              <AppText
                family="heading"
                weight="bold"
                style={{ fontSize: 21, lineHeight: 25, letterSpacing: -0.4, color: tokens.text }}
              >
                {priceAmount}
              </AppText>
              <AppText
                family="accent"
                weight="semibold"
                style={{ fontSize: 11, color: tokens.textMuted }}
              >
                {t('common.currency')}
              </AppText>
              {wasLabel ? (
                <AppText
                  family="default"
                  style={{
                    fontSize: 12,
                    color: tokens.textMuted,
                    textDecorationLine: 'line-through',
                  }}
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

            {/* Stock first — it decides whether the delivery promise means
             *  anything — then the ETA when the part carries one. */}
            {outOfStock ? (
              <AppText
                family="accent"
                weight="bold"
                style={{ fontSize: 11.5, color: tokens.textMuted }}
              >
                {t('catalog.outOfStock')}
              </AppText>
            ) : eta ? (
              <AppText family="default" style={{ fontSize: 11.5, color: tokens.textMuted }}>
                {eta}
              </AppText>
            ) : null}
          </AppView>

          <AppIconButton
            Icon={Plus}
            onPress={() => onAdd(item)}
            disabled={outOfStock}
            size={42}
            iconSize={22}
            strokeWidth={2.6}
            backgroundColor={outOfStock ? tokens.disabledBg : tokens.text}
            color={outOfStock ? tokens.disabledFg : tokens.background}
            accessibilityLabel={
              outOfStock
                ? t('catalog.outOfStock')
                : t('catalog.addToCartAccessibility', { title: item.title })
            }
          />
        </AppView>
      </AppView>
    </AppView>
  );
}

/** Five glyphs, filled to the nearest half — the storefront rating convention,
 *  set in type so it carries no icon dependency. */
function Stars({ value }: { value: number }) {
  const { tokens } = useThemeContext();
  const filled = Math.round(value);
  return (
    <AppText family="accent" weight="bold" style={{ fontSize: 11, letterSpacing: 0.5 }}>
      <AppText style={{ color: tokens.rating }}>{'★'.repeat(Math.min(5, filled))}</AppText>
      <AppText style={{ color: tokens.gray300 }}>{'★'.repeat(Math.max(0, 5 - filled))}</AppText>
    </AppText>
  );
}

/** Small filled tag above the title (bestseller, certified, lowest price). */
function Tag({ label, color, bg }: { label: string; color: string; bg: string }) {
  return (
    <AppView rounded={4} px={6} py={2} style={{ backgroundColor: bg }}>
      <AppText family="accent" weight="bold" style={{ fontSize: 9.5, letterSpacing: 0.4, color }}>
        {label.toUpperCase()}
      </AppText>
    </AppView>
  );
}

export default memo(ProductRow);
