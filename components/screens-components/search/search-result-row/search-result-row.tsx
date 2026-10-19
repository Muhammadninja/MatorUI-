import { memo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet } from 'react-native';

import AppImage from '@/components/shared/app-image';
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
import DeliveryRow from './delivery-row';
import HighlightedTitle from './highlighted-title';
import LikeButton from './like-button';
import PriceBlock from './price-block';
import Ribbon from './ribbon';
import RatingRow from './rating-row';
import { resolvePriceSignal } from './signal';
import StatusLine from './status-line';
import Thumbnail from './thumbnail';
import { deriveCardVariant } from './variant';

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
function SearchResultRow({ result, query, isCheapest, onPress }: SearchResultRowProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const variant = deriveCardVariant(result.id);
  const { isLiked, toggleLike } = useLikesContext();
  const { addItem } = useCartContext();
  const liked = isLiked(result.id);
  const image = result.images?.[0];
  // Resolved once here rather than inline in the price block: the ribbon now
  // sits ABOVE the title (see below), where a storefront puts a "Лучшая цена" /
  // "Хит продаж" tag, instead of crowding the price line.
  const signal = resolvePriceSignal({
    t,
    isCheapest,
    badge: result.badge,
    accentTagKind: result.accentTagKind,
    accentTagFallback: variant.accentTag,
  });
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
      style={{
        backgroundColor: isDark ? tokens.card : tokens.white,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: tokens.divider,
      }}
    >
      <AppView row gap={10} align="stretch" flex={1}>
        <Thumbnail alt={result.title} uri={image} />

        <AppView flex={1} justify="space-between" pb="md">
          {/* Signal tag + title, with the heart pinned to the top-right.
           *  The tag leads the column: it qualifies the PRODUCT, so it reads
           *  before the name, and the price line below is left to the price. */}
          <AppView row gap={30} align="flex-start">
            <AppView mt="md" gap={6} style={{ flex: 1 }}>
              {signal ? (
                <AppView row>
                  <Ribbon
                    label={signal.label}
                    icons={signal.icons}
                    tone={signal.tone}
                    composite={signal.composite}
                  />
                </AppView>
              ) : null}
              <HighlightedTitle text={result.title} query={query} />
            </AppView>
            <LikeButton liked={liked} onToggle={() => toggleLike(result.id)} />
          </AppView>

          {/* Bottom-anchored cluster: stacked info on the left
           *  (price → delivery → status → rating), AddToCartButton pinned
           *  bottom-right. align="flex-end" aligns the button with the
           *  bottom edge of the info column so it sits next to whichever
           *  row is last (rating, status, or delivery). */}
          <AppView row align="flex-end" gap="sm">
            <AppView flex={1}>
              <PriceBlock priceLabel={result.priceLabel} price={result.price} />
              <DeliveryRow delivery={variant.delivery} />
              {result.status ? <StatusLine status={result.status} /> : null}
              {result.rating != null ? (
                <RatingRow rating={result.rating} reviewCount={result.reviewCount ?? 0} />
              ) : null}
            </AppView>
            <AppView mr="sm">
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
