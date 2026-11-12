import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, useWindowDimensions } from 'react-native';

import AppImage from '@/components/shared/app-image';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import PartImagePlaceholder from '@/components/shared/part-image-placeholder';
import { useCartContext } from '@/contexts/cart.context';
import { useLikesContext } from '@/contexts/likes.context';
import { useThemeContext } from '@/contexts/theme.context';
import { toastService } from '@/services/toast-service';
import type { SearchResult } from '@/types/search';
import { triggerHaptic } from '@/utils/haptics';

import { RADIUS_CARD, RADIUS_SHEET } from '../radii';
import AddToCartButton from './add-to-cart-button';
import HighlightedTitle from './highlighted-title';
import LikeButton from './like-button';
import PriceBlock from './price-block';
import Thumbnail, { THUMB_INSET } from './thumbnail';

const PREVIEW_SIZE = 300;
/** The list's side gutter; the card's image column is a third of what is left. */
export const CARD_GUTTER = 16;
/** Room kept clear of the corner heart at the end of the title. */
const HEART_CLEARANCE = 36;

export type SearchResultRowProps = {
  result: SearchResult;
  query: string;
  onPress: (result: SearchResult) => void;
};

/**
 * Horizontal result card: the image in a third of the width, then title, part
 * numbers, price and «В корзину», with the favourite heart in the corner. Pure
 * composition: every visual block is its own file under `./`. This file owns only
 * the wrapper pressable and the add-to-cart guard. Delivery lives on Item Detail,
 * Cart and Checkout.
 */
function SearchResultRow({ result, query, onPress }: SearchResultRowProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const { width: windowWidth } = useWindowDimensions();
  // A third of the card, less the tile's inset from the card's edge.
  const imageWidth = Math.round((windowWidth - CARD_GUTTER * 2) / 3) - THUMB_INSET;
  const { isLiked, toggleLike } = useLikesContext();
  const { addItem } = useCartContext();
  const liked = isLiked(result.id);
  const image = result.images?.[0];
  const outOfStock = /out of stock/i.test(result.status ?? '');
  const partNumbers = [result.gm && `GM ${result.gm}`, result.oem && `OEM ${result.oem}`]
    .filter(Boolean)
    .join(' · ');
  const [viewerVisible, setViewerVisible] = useState(false);
  // Debounce guard: ignore a second tap within 800ms so rapid taps can't
  // push duplicate line items into the cart.
  const lastAddRef = useRef(0);

  const handleAddToCart = () => {
    const now = Date.now();
    if (now - lastAddRef.current < 800) return;
    lastAddRef.current = now;
    addItem({
      id: result.id,
      title: result.title,
      description: result.description,
      price: result.price,
      priceLabel: result.priceLabel,
      badge: result.badge,
      status: result.status,
      // Without this the part lost its photo on the way to the cart and the
      // line item fell back to the placeholder.
      imageUrl: image,
    });
    toastService.success(t('search.addedToCart'), { description: result.title });
  };

  return (
    <AppPressableView
      onPress={() => {
        triggerHaptic('selection');
        onPress(result);
      }}
      onLongPress={() => {
        triggerHaptic('selection');
        setViewerVisible(true);
      }}
      androidRipple
      testID={`part-card-${result.id}`}
      accessibilityRole="button"
      accessibilityLabel={t('search.openItemA11y', { title: result.title })}
      colorName="card"
      style={{
        marginHorizontal: CARD_GUTTER,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: RADIUS_CARD,
        overflow: 'hidden',
      }}
    >
      <AppView row>
        <Thumbnail alt={result.title} uri={image} width={imageWidth} />

        <AppView flex={1} style={{ minWidth: 0, padding: 12 }}>
          <AppView style={{ paddingRight: HEART_CLEARANCE }}>
            <HighlightedTitle text={result.title} query={query} />
          </AppView>

          {partNumbers ? (
            <AppText textVariant="bodyXs" colorName="textMuted" style={{ marginTop: 4 }}>
              {partNumbers}
            </AppText>
          ) : null}

          {/* Title → OEM 4, OEM → price 14, price → button 8. */}
          <AppView gap={8} style={{ marginTop: 14 }}>
            <AppView>
              <PriceBlock priceLabel={result.priceLabel} price={result.price} />
              {outOfStock ? (
                <AppText textVariant="bodyXs" weight="medium" style={{ color: tokens.error }}>
                  {t('catalog.outOfStock')}
                </AppText>
              ) : null}
            </AppView>
            <AddToCartButton
              testID={`search-add-${result.id}`}
              onPress={handleAddToCart}
              outOfStock={outOfStock}
            />
          </AppView>
        </AppView>
      </AppView>

      {/* Its own target in the card's corner: a tap here never opens the part. */}
      <AppView style={{ position: 'absolute', top: 2, right: 2 }}>
        <LikeButton
          testID={`search-like-${result.id}`}
          liked={liked}
          onToggle={() => toggleLike(result.id)}
        />
      </AppView>

      <Modal
        visible={viewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerVisible(false)}
      >
        {/* Backdrop closes the preview when tapped outside the card. */}
        <Pressable
          onPress={() => setViewerVisible(false)}
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Stop propagation so taps on the image itself don't close. */}
          <Pressable
            onPress={(e) => e.stopPropagation?.()}
            style={{
              width: PREVIEW_SIZE,
              height: PREVIEW_SIZE,
              borderRadius: RADIUS_SHEET,
              overflow: 'hidden',
              backgroundColor: isDark ? tokens.card : tokens.white,
            }}
          >
            {image ? (
              <AppImage
                source={image}
                width="100%"
                height="100%"
                targetWidth={PREVIEW_SIZE}
                contentFit="contain"
                placeholderColor="transparent"
                fallback={
                  <PartImagePlaceholder
                    label={result.title}
                    width="100%"
                    height="100%"
                    backgroundColor="transparent"
                  />
                }
                alt={result.title}
              />
            ) : (
              <PartImagePlaceholder
                label={result.title}
                width="100%"
                height="100%"
                backgroundColor="transparent"
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </AppPressableView>
  );
}

export default memo(SearchResultRow);
