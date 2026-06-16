import { memo, useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';

import AppImage from '@/components/shared/app-image';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useCartContext } from '@/contexts/cart.context';
import { useLikesContext } from '@/contexts/likes.context';
import { useThemeContext } from '@/contexts/theme.context';
import { toastService } from '@/services/toast-service';
import type { SearchResult } from '@/types/search';
import { triggerHaptic } from '@/utils/haptics';

import { RADIUS_SHEET } from '../radii';
import AddToCartButton from './add-to-cart-button';
import DeliveryRow from './delivery-row';
import HighlightedTitle from './highlighted-title';
import LikeButton from './like-button';
import PriceBlock from './price-block';
import RatingRow from './rating-row';
import { resolvePriceSignal } from './signal';
import StatusLine from './status-line';
import Thumbnail from './thumbnail';
import { deriveCardVariant } from './variant';

const ROW_IMAGE_SOURCE = require('@/assets/images/test-image.png');
const PREVIEW_SIZE = 300;

export type SearchResultRowProps = {
  result: SearchResult;
  query: string;
  /** True when this row is the cheapest in the currently displayed set —
   *  the corner ribbon switches to green CHEAPEST instead of the badge. */
  isCheapest?: boolean;
  onPress: (result: SearchResult) => void;
};

/**
 * Amazon-style result card. Pure composition: every visual block is its
 * own file under `./`. This file owns only the wrapper pressable and
 * the per-card derived data (rating, review count, variant).
 */
function SearchResultRow({
  result,
  query,
  isCheapest,
  onPress,
}: SearchResultRowProps) {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const variant = deriveCardVariant(result.id);
  const { isLiked, toggleLike } = useLikesContext();
  const { addItem } = useCartContext();
  const liked = isLiked(result.id);
  const [viewerVisible, setViewerVisible] = useState(false);

  const handleAddToCart = () => {
    addItem({
      id: result.id,
      title: result.title,
      description: result.description,
      price: result.price,
      priceLabel: result.priceLabel,
      badge: result.badge,
      status: result.status,
    });
    toastService.success('Added to cart', { description: result.title });
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
      accessibilityLabel={`Open ${result.title}`}
      style={{
        backgroundColor: isDark ? tokens.card : tokens.white,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: tokens.divider,
      }}
    >
      <AppView row gap={10}  align="stretch" flex={1}>
        <Thumbnail alt={result.title} />

        <AppView
          flex={1}
          justify="space-between"
          pb={12}
        >
          {/* Title row + heart LikeButton on the right. Title can grow up
           *  to 3 lines; LikeButton stays pinned to the top-right corner. */}
          <AppView row gap={30} align="flex-start">
            <AppView mt={12} style={{ flex: 1 }}>
              <HighlightedTitle text={result.title} query={query} />
            </AppView>
            <LikeButton liked={liked} onToggle={() => toggleLike(result.id)} />
          </AppView>

          {/* Bottom-anchored cluster: stacked info on the left
           *  (price → delivery → status → rating), AddToCartButton pinned
           *  bottom-right. align="flex-end" aligns the button with the
           *  bottom edge of the info column so it sits next to whichever
           *  row is last (rating, status, or delivery). */}
          <AppView row align="flex-end" gap={8}>
            <AppView flex={1}>
              <PriceBlock
                priceLabel={result.priceLabel}
                price={result.price}
                signal={resolvePriceSignal({
                  isCheapest,
                  badge: result.badge,
                  accentTagKind: result.accentTagKind,
                  accentTagFallback: variant.accentTag,
                })}
              />
              <DeliveryRow delivery={variant.delivery} />
              {result.status ? <StatusLine status={result.status} /> : null}
              {result.rating != null ? (
                <RatingRow
                  rating={result.rating}
                  reviewCount={result.reviewCount ?? 0}
                />
              ) : null}
            </AppView>
            <AppView mr={8}>
              <AddToCartButton onPress={handleAddToCart} />
            </AppView>
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
            <AppImage
              source={ROW_IMAGE_SOURCE}
              width="100%"
              height="100%"
              contentFit="cover"
              placeholderColor="transparent"
              alt={result.title}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </AppPressableView>
  );
}

export default memo(SearchResultRow);
