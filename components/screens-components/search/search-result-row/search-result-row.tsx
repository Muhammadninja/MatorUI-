import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable } from 'react-native';

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

import { RADIUS_SHEET } from '../radii';
import AddToCartButton from './add-to-cart-button';
import HighlightedTitle from './highlighted-title';
import LikeButton from './like-button';
import PriceBlock from './price-block';
import Thumbnail from './thumbnail';

const PREVIEW_SIZE = 300;

export type SearchResultRowProps = {
  result: SearchResult;
  query: string;
  onPress: (result: SearchResult) => void;
};

/**
 * Horizontal result row: image, title, favorite, price and add to cart. Pure
 * composition: every visual block is its own file under `./`. This file owns only
 * the wrapper pressable and the add-to-cart guard. Delivery lives on Item Detail,
 * Cart and Checkout.
 */
function SearchResultRow({ result, query, onPress }: SearchResultRowProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const { isLiked, toggleLike } = useLikesContext();
  const { addItem } = useCartContext();
  const liked = isLiked(result.id);
  const image = result.images?.[0];
  const outOfStock = /out of stock/i.test(result.status ?? '');
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
      style={{ paddingVertical: 16, paddingHorizontal: 20 }}
    >
      <AppView row gap={12}>
        <Thumbnail alt={result.title} uri={image} />

        <AppView flex={1} gap={4} style={{ minWidth: 0 }}>
          {/* The heart keeps its own column, so it can't overlap the title. */}
          <AppView row align="flex-start" gap={4}>
            <AppView flex={1} style={{ minWidth: 0 }}>
              <HighlightedTitle text={result.title} query={query} />
            </AppView>
            <LikeButton liked={liked} onToggle={() => toggleLike(result.id)} />
          </AppView>

          {/* Pinned to the row's foot, so the button sits at the bottom right. */}
          <AppView row align="center" justify="space-between" gap={8} style={{ marginTop: 'auto' }}>
            <AppView flex={1} style={{ minWidth: 0 }}>
              <PriceBlock priceLabel={result.priceLabel} price={result.price} />
              {outOfStock ? (
                <AppText textVariant="bodyXs" weight="medium" style={{ color: tokens.error }}>
                  {t('catalog.outOfStock')}
                </AppText>
              ) : null}
            </AppView>
            <AddToCartButton onPress={handleAddToCart} outOfStock={outOfStock} />
          </AppView>
        </AppView>
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
