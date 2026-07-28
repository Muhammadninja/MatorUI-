import { router } from 'expo-router';
import { BadgeCheck, Car, Heart, ShoppingCart } from 'lucide-react-native';
import { memo } from 'react';

import ImageBox from '@/components/screens-components/home/image-box';
import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useLikesContext } from '@/contexts/likes.context';
import { useThemeContext } from '@/contexts/theme.context';
import type { CatalogItem } from '@/services/catalog-service';

// Hairline border shared by the card and the like-button chip.
const HAIRLINE = '#E6E7EA';

type ProductRowItem = CatalogItem & {
  brand?: string;
  gm?: string;
};

export type ProductRowProps = {
  item: CatalogItem;
  /** Open the item detail (image/title tap). */
  onOpen: (item: CatalogItem) => void;
  /** Add to cart (gated by the caller). */
  onAdd: (item: CatalogItem) => void;
};

/**
 * `ProductRow` — the AutoZone-style result card on Category / Search, backed by
 * the real catalog (`CatalogItem`). A white product-image tile on the left; on
 * the right the title, Part # (OEM), and price; and a
 * full-width "Add to cart" below. Only fields the catalog actually carries are
 * shown — rating, warranty, core deposit, store address, and delivery are
 * omitted rather than faked.
 */
function ProductRow({ item, onOpen, onAdd }: ProductRowProps) {
  const product = item as ProductRowItem;
  const { tokens } = useThemeContext();
  const { isLiked, toggleLike } = useLikesContext();
  const { currentActiveVehicle } = useActiveVehicle();
  const liked = isLiked(product.id);
  const image = product.images?.[0];

  const activeVehicle = currentActiveVehicle?.vehicle ?? null;
  // "Check if it fits" (amber) until a vehicle is active in the garage, then
  // "Fits your <car>" (green) — mirrors the item-detail confirmed-fit banner.
  const fitColor = activeVehicle ? tokens.success : tokens.warning;
  const fitLabel = activeVehicle
    ? `Fits your ${activeVehicle.year} ${activeVehicle.make}`
    : 'Check if it fits';

  // The backend `title` is the full localized part name — it already carries
  // the model (e.g. "Cobalt Remen Generator Xitoy Original"), so show it
  // verbatim rather than slicing arbitrary words. The subtitle is the part
  // brand · category (`description`, e.g. "Gates · Dvigatel kamarlari").
  const primaryTitle = product.title;
  const subtitle = product.description?.trim() || undefined;

  return (
    // Two columns: the image stretches to the full card height on the left;
    // details + price + button stack in the right column so the button sits
    // beside the image and never interrupts it. (Row align defaults to
    // 'stretch', which is what lets the image fill the column height.)
    <AppView row gap={10} p={8} colorName="background">
      {/* Product image — white `contain` tile filling the full column height. */}
      <AppPressableView
        testID={`part-card-${item.id}`}
        onPress={() => onOpen(item)}
        androidRipple={false}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={{ width: 128 }}
      >
        <ImageBox
          label={item.title}
          uri={image}
          height={250}
          radius={10}
          contentFit="contain"
          backgroundColor={tokens.white}
        />
        {/* Like toggle — inline, top-right over the image */}
        <AppPressableView
          onPress={() => toggleLike(item.id)}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Remove from favorites' : 'Save to favorites'}
          androidRipple={false}
          center
          rounded={32}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.92)', borderWidth: 1, borderColor: HAIRLINE }}
        >
          <Heart
            size={16}
            strokeWidth={2.2}
            color={liked ? tokens.error : 'rgba(0,0,0,0.55)'}
            fill={liked ? tokens.error : 'none'}
          />
        </AppPressableView>
      </AppPressableView>

      {/* Right column: details, price, and the Add to cart button. */}
      <AppView flex={1} gap={8}>
        <AppPressableView onPress={() => onOpen(item)} androidRipple={false}>
          {/* Title = the full localized part name (already includes the model). */}
          <AppText
            family="default"
            weight="bold"
            numberOfLines={2}
            style={{ fontSize: 16, lineHeight: 20, color: tokens.text }}
          >
            {primaryTitle}
          </AppText>
          {/* Subtitle = part brand · category, smaller + muted. */}
          {subtitle ? (
            <AppText
              family="default"
              numberOfLines={1}
              style={{ fontSize: 12, lineHeight: 16, color: tokens.textMuted, marginTop: 2 }}
            >
              {subtitle}
            </AppText>
          ) : null}
        </AppPressableView>

        {/* MATOR Certified trust badge — shown only when the backend marks this
            part's seller certified (operator-panel toggle). Off by default. */}
        {product.certified ? (
          <AppView
            row
            align="center"
            gap={5}
            rounded={7}
            px={8}
            py={3}
            borderWidth={1}
            style={{ alignSelf: 'flex-start', backgroundColor: `${tokens.info}14`, borderColor: `${tokens.info}45` }}
          >
            <BadgeCheck size={13} strokeWidth={2.5} color={tokens.info} />
            <AppText family="accent" weight="bold" style={{ fontSize: 10.5, letterSpacing: 0.3, color: tokens.info }}>
              MATOR Certified
            </AppText>
          </AppView>
        ) : null}

        {/* OEM / GM cross-reference numbers */}
        {product.oem || product.gm ? (
          <AppView row wrap gap={6}>
            {product.oem ? (
              <AppView row align="center" gap={4} rounded={6} px={7} py={3} colorName="backgroundSecondary">
                <AppText family="accent" weight="bold" style={{ fontSize: 9.5, letterSpacing: 0.5, color: tokens.textMuted }}>
                  OEM
                </AppText>
                <AppText family="default" weight="semibold" numberOfLines={1} style={{ fontSize: 11, color: tokens.text }}>
                  {product.oem}
                </AppText>
              </AppView>
            ) : null}
            {product.gm ? (
              <AppView row align="center" gap={4} rounded={6} px={7} py={3} colorName="backgroundSecondary">
                <AppText family="accent" weight="bold" style={{ fontSize: 9.5, letterSpacing: 0.5, color: tokens.textMuted }}>
                  GM
                </AppText>
                <AppText family="default" weight="semibold" numberOfLines={1} style={{ fontSize: 11, color: tokens.text }}>
                  {product.gm}
                </AppText>
              </AppView>
            ) : null}
          </AppView>
        ) : null}

        {/* Check-if-it-fits banner — routes to the garage to pick a vehicle,
            or shows the confirmed fit when one is already active. */}
        <AppPressableView
          onPress={() => (activeVehicle ? onOpen(item) : router.navigate('/garage'))}
          androidRipple={false}
          pressedOpacity={0.85}
          row
          align="center"
          gap={8}
          rounded={10}
          px={10}
          py={8}
          borderWidth={1}
          accessibilityRole="button"
          accessibilityLabel={activeVehicle ? fitLabel : 'Check if this part fits your car'}
          style={{ borderColor: fitColor, backgroundColor: `${fitColor}18` }}
        >
          <Car size={15} strokeWidth={2.3} color={fitColor} />
          <AppText family="accent" weight="bold" numberOfLines={1} style={{ flex: 1, fontSize: 12, color: tokens.text }}>
            {fitLabel}
          </AppText>
        </AppPressableView>

        {/* Price — pushed to the right, just above the button. `marginTop:auto`
            pins the price + button to the bottom of the column so the image
            (which matches this column's height) isn't left with empty space. */}
        <AppView row justify="flex-start" style={{ marginTop: 'auto' }}>
          {/* Amazon-style price tag — near-black (theme text) so it reads as
              bold near-black in light mode and stays legible in dark mode. */}
          <AppPrice value={item.price} color={tokens.text} />
        </AppView>

        {/* Add to cart — in the right column, beside the image (never over it). */}
        <AppPressableView
          onPress={() => onAdd(item)}
          accessibilityRole="button"
          accessibilityLabel={`Add ${item.title} to cart`}
          androidRipple={false}
          pressedOpacity={0.9}
          row
          center
          gap={8}
          rounded={36}
          py={6}
          style={{ backgroundColor: tokens.text }}
        >
          {/* Foreground = `tokens.background` (the inverse of `tokens.text`),
              so the icon + label always contrast: dark button/light text in
              light mode, light button/dark text in dark mode. */}
          <ShoppingCart size={17} strokeWidth={2.4} color={tokens.background} />
          <AppText family="accent" weight="bold" style={{ fontSize: 14, color: tokens.background, letterSpacing: 0.3 }}>
            Add to cart
          </AppText>
        </AppPressableView>
      </AppView>
    </AppView>
  );
}

export default memo(ProductRow);
