import AppImage from '@/components/shared/app-image';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { toastService } from '@/services/toast-service';
import { triggerHaptic } from '@/utils/haptics';
import { memo, useEffect, useRef, useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { AppButton } from '../../shared/app-button';
import { AppCard } from '../../shared/app-card/app-card';
import { AppText } from '../../shared/app-text';
import { AppView } from '../../shared/app-view';
import { RADIUS_SHEET } from './radii';

/** Card placeholder used when no real product image is available. The
 *  card was historically hard-coded to this require — Step 6 moves it
 *  into a single named constant so the placeholder behavior is honest
 *  and easy to find/replace later. */
const PLACEHOLDER_IMAGE = require('@/assets/images/test-image.png');

export type SearchPartCardProps = {
  id: string;
  badge?: string;
  status?: string;
  title: string;
  description: string;
  priceLabel?: string;
  price: string;
  actionLabel?: string;
  /** Primary product image URL. When omitted (or empty string), the card
   *  falls back to a built-in placeholder. Strings are rendered as
   *  `{ uri }`; passing a static require result is also supported for
   *  legacy callers via `imageSource`. */
  image?: string;
  /** Escape hatch for static-asset callers (`require()` results). When
   *  both `image` and `imageSource` are provided, `image` wins. */
  imageSource?: number;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  /** Manufacturer / OEM part number. When set, renders as a small gray
   *  pill below the add-to-cart row so shoppers can cross-reference
   *  against an existing part. Omit to hide the pill entirely. */
  oem?: string;
};

function SearchPartCard({
  id,
  badge,
  status = 'Ready to ship',
  title,
  description,
  priceLabel = 'Starting at',
  price,
  actionLabel = 'Add to cart',
  image,
  imageSource,
  compact = false,
  style,
  onPress,
  oem,
}: SearchPartCardProps) {
  const { tokens } = useThemeContext();
  const { addItem } = useCartContext();
  const [wasJustAdded, setWasJustAdded] = useState(false);
  // Resolve the image source: prefer a URL string, fall back to a static
  // require result, fall back to the built-in placeholder. Empty string
  // counts as "no image" so the backend can ship `''` instead of null.
  const resolvedImageSource =
    image && image.length > 0
      ? { uri: image }
      : imageSource ?? PLACEHOLDER_IMAGE;
  const resetAddedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce guard: rapid double-taps within 800ms would otherwise push
  // duplicate line items into the cart.
  const lastAddRef = useRef(0);
  const cardPadding = compact ? 10 : 12;
  const mediaPadding = compact ? 10 : 12;
  const bodyGap = compact ? 8 : 10;
  const titleVariant = compact ? 'bodySm' : 'h4';
  const priceVariant = compact ? 'bodySm' : 'h4';

  useEffect(() => {
    return () => {
      if (resetAddedTimeoutRef.current) {
        clearTimeout(resetAddedTimeoutRef.current);
      }
    };
  }, []);

  const handleAddToCart = () => {
    const now = Date.now();
    if (now - lastAddRef.current < 800) return;
    lastAddRef.current = now;
    triggerHaptic('success');
    addItem({
      id,
      title,
      description,
      price,
      priceLabel,
      badge,
      status,
      imageUrl: image && image.length > 0 ? image : undefined,
    });
    // Toast for cross-surface parity: search row + item-detail + this
    // card all fire the same "Added to cart" toast on add. Without it,
    // catalogue / top-featured cards felt silent compared to the other
    // entry points.
    toastService.success('Added to cart', { description: title });
    setWasJustAdded(true);

    if (resetAddedTimeoutRef.current) {
      clearTimeout(resetAddedTimeoutRef.current);
    }

    resetAddedTimeoutRef.current = setTimeout(() => {
      setWasJustAdded(false);
    }, 1400);
  };

  return (
    <AppCard
      variant="outline"
      padding={cardPadding}
      rounded={RADIUS_SHEET}
      style={style}
      onPress={onPress}
      media={
        <AppView>
          <AppImage
            source={resolvedImageSource}
            width="100%"
            height={compact ? 140 : 180}
            contentFit="cover"
            priority="normal"
            alt={title}
          />
          {/* Badge + status overlay */}
          <AppView
            row
            align="center"
            justify="space-between"
            px={mediaPadding}
            py={compact ? 8 : 10}
            style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
          >
            {badge ? (
              <AppView px={10} py={6} rounded={36} style={{ backgroundColor: tokens.secondary }}>
                <AppText textVariant="bodyXs" weight="semibold" colorName="onSecondary">
                  {badge}
                </AppText>
              </AppView>
            ) : (
              <AppView />
            )}
            <AppView px={8} py={4} rounded={36} style={{ backgroundColor: tokens.scrim }}>
              <AppText textVariant="bodyXs" style={{ color: tokens.white }}>
                {status}
              </AppText>
            </AppView>
          </AppView>
        </AppView>
      }
    >
      <AppView gap={bodyGap} px={compact ? 4 : 8}>
        <AppView gap={compact ? 3 : 4}>
          <AppText textVariant={titleVariant} family="heading" numberOfLines={compact ? 2 : 1}>
            {title}
          </AppText>
          <AppText textVariant="bodySm" colorName="gray400" numberOfLines={compact ? 3 : 2}>
            {description}
          </AppText>
        </AppView>

        {compact ? (
          <AppView gap={8}>
            <AppView gap={2}>
              <AppText textVariant="bodyXs" colorName="gray400">
                {priceLabel}
              </AppText>
              <AppText textVariant={priceVariant} family="heading">
                {price}
              </AppText>
            </AppView>
            <AppButton
              title={wasJustAdded ? 'Added' : actionLabel}
              kind="secondary"
              size="xs"
              fullWidth
              onPress={handleAddToCart}
            />
            {oem ? (
              <AppView
                rounded={8}
                px={8}
                py={4}
                style={{ alignSelf: 'flex-start', backgroundColor: tokens.gray100 }}
              >
                <AppText textVariant="bodyXs" colorName="gray400">
                  OEM {oem}
                </AppText>
              </AppView>
            ) : null}
          </AppView>
        ) : (
          <AppView gap={8}>
            <AppView row align="center" justify="space-between" gap={12}>
              <AppView gap={2} style={{ flex: 1 }}>
                <AppText textVariant="bodyXs" colorName="gray400">
                  {priceLabel}
                </AppText>
                {/* numberOfLines + adjustsFontSizeToFit: long prices
                 *  (e.g. "UZS 11,008,400") would otherwise wrap to a
                 *  second line because the price column gets whatever
                 *  width is left after the fixed-size button. One-line
                 *  clamp + auto-shrink fits any length without
                 *  truncating digits. */}
                <AppText
                  textVariant={priceVariant}
                  family="heading"
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.7}
                >
                  {price}
                </AppText>
              </AppView>
              <AppButton
                title={wasJustAdded ? 'Added' : actionLabel}
                kind="secondary"
                size="sm"
                containerStyle={{ flexShrink: 0 }}
                onPress={handleAddToCart}
              />
            </AppView>
            {oem ? (
              <AppView
                rounded={8}
                px={8}
                py={4}
                style={{ alignSelf: 'flex-start', backgroundColor: tokens.gray100 }}
              >
                <AppText textVariant="bodyXs" colorName="gray400">
                   {oem}
                </AppText>
              </AppView>
            ) : null}
          </AppView>
        )}
      </AppView>
    </AppCard>
  );
}

export default memo(SearchPartCard);
