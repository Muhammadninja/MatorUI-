import { Platform } from 'react-native';

import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useLikesContext } from '@/contexts/likes.context';
import { useThemeContext } from '@/contexts/theme.context';
import type { SearchResult } from '@/types/search';
import { triggerHaptic } from '@/utils/haptics';

import AccentTag from './accent-tag';
import DeliveryRow from './delivery-row';
import { pseudoRating, pseudoReviewCount } from './helpers';
import HighlightedTitle from './highlighted-title';
import LikeButton from './like-button';
import PriceBlock from './price-block';
import RatingRow from './rating-row';
import StatusLine from './status-line';
import Thumbnail from './thumbnail';
import { deriveCardVariant } from './variant';

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
export default function SearchResultRow({
  result,
  query,
  isCheapest,
  onPress,
}: SearchResultRowProps) {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const rating = pseudoRating(result.id);
  const reviewCount = pseudoReviewCount(result.id);
  const variant = deriveCardVariant(result.id);
  const { isLiked, toggleLike } = useLikesContext();
  const liked = isLiked(result.id);

  return (
    <AppPressableView
      onPress={() => {
        triggerHaptic('selection');
        onPress(result);
      }}
      androidRipple
      accessibilityLabel={`Open ${result.title}`}
      style={{
        position: 'relative',
        borderRadius: 14,
        backgroundColor: isDark ? tokens.card : tokens.white,
        borderWidth: 1,
        borderColor: isDark ? tokens.border : tokens.gray100,
        ...Platform.select({
          ios: {
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: isDark ? 0.35 : 0.1,
            shadowRadius: 14,
          },
          android: { elevation: 4 },
          default: {},
        }),
      }}
    >
      <AppView row gap={14} align="stretch">
        <Thumbnail
          badge={result.badge}
          alt={result.title}
          isCheapest={isCheapest}
        />

        <AppView
          style={{
            flex: 1,
            paddingTop: 18,
            paddingBottom: 14,
            paddingRight: 14,
            gap: 6,
          }}
        >
          {/* Title row + heart LikeButton on the right. Title can grow up
           *  to 3 lines; LikeButton stays pinned to the top-right corner. */}
          <AppView row align="flex-start" gap={8} style={{ flex: 1 }}>
            <AppView style={{ flex: 1 }}>
              <HighlightedTitle text={result.title} query={query} />
            </AppView>
            <LikeButton liked={liked} onToggle={() => toggleLike(result.id)} />
          </AppView>

          {variant.accentTag ? <AccentTag tag={variant.accentTag} /> : null}
          <PriceBlock priceLabel={result.priceLabel} price={result.price} />
          <DeliveryRow delivery={variant.delivery} />
          {result.status ? <StatusLine status={result.status} /> : null}

          {/* Rating sits at the very bottom now — least-critical info,
           *  least visual weight; lets the title own the top. */}
          <RatingRow rating={rating} reviewCount={reviewCount} />
        </AppView>
      </AppView>
    </AppPressableView>
  );
}
