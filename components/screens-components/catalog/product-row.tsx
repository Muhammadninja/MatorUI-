import { Heart, Plus } from 'lucide-react-native';
import { memo } from 'react';

import ImageBox from '@/components/screens-components/home/image-box';
import AppOemPill from '@/components/shared/app-oem-pill/app-oem-pill';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useLikesContext } from '@/contexts/likes.context';
import { useThemeContext } from '@/contexts/theme.context';
import type { CatalogItem } from '@/services/catalog-service';

export type ProductRowProps = {
  item: CatalogItem;
  /** Open the item detail (image/title tap). */
  onOpen: (item: CatalogItem) => void;
  /** Add to cart (gated by the caller). */
  onAdd: (item: CatalogItem) => void;
};

/**
 * `ProductRow` — the horizontal result row on Category / Search, backed by the
 * real catalog (`CatalogItem`). A 104px real product image on the left; on the
 * right the title, a like (heart) toggle, description, an OEM pill (when
 * present), and a price + status + "+ Add" row. Fields the catalog doesn't
 * carry (rating, was-price, fitment) are omitted rather than faked.
 */
function ProductRow({ item, onOpen, onAdd }: ProductRowProps) {
  const { tokens } = useThemeContext();
  const { isLiked, toggleLike } = useLikesContext();
  const liked = isLiked(item.id);
  const image = item.images?.[0];

  return (
    <AppView row gap={14} rounded={16} borderColor={tokens.border} borderTopWidth={1} pt={ 4} pb={14}>
      {/* Real product image */}
      <AppPressableView
        onPress={() => onOpen(item)}
        androidRipple={false}
        accessibilityRole="button"
        accessibilityLabel={item.title}
        style={{ width: 140 }}
      >
        <ImageBox label={item.title} uri={image} height={160} />
        {/* Like toggle — inline, top-right over the image */}
        <AppPressableView
          onPress={() => toggleLike(item.id)}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Remove from favorites' : 'Save to favorites'}
          androidRipple={false}
          center
          rounded={999}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, backgroundColor: 'rgba(255,255,255,0.92)' }}
        >
          <Heart
            size={16}
            strokeWidth={2.2}
            color={liked ? tokens.error : 'rgba(0,0,0,0.55)'}
            fill={liked ? tokens.error : 'none'}
          />
        </AppPressableView>
      </AppPressableView>

      {/* Details */}
      <AppView flex={1}>
        <AppPressableView onPress={() => onOpen(item)} androidRipple={false}>
          <AppText
            family="default"
            weight="semibold"
            numberOfLines={2}
            style={{ fontSize: 14, lineHeight: 18.5, color: tokens.text }}
          >
            {item.title}
          </AppText>
          {item.description ? (
            <AppText
              family="default"
              numberOfLines={1}
              style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}
            >
              {item.description}
            </AppText>
          ) : null}
        </AppPressableView>

        {item.oem ? (
          <AppView style={{ marginTop: 7 }}>
            <AppOemPill oem={item.oem} />
          </AppView>
        ) : null}

        {/* Price + status + Add */}
        <AppView row align="flex-end" justify="space-between" gap={10} style={{ marginTop: 'auto', paddingTop: 10 }}>
          <AppView flex={1}>
            <AppText family="heading" weight="bold" numberOfLines={1} style={{ fontSize: 18, color: tokens.info }}>
              {item.price}
            </AppText>
            {item.status ? (
              <AppText family="default" numberOfLines={1} style={{ fontSize: 11, color: tokens.success, marginTop: 1 }}>
                {item.status}
              </AppText>
            ) : null}
          </AppView>

          <AppPressableView
            onPress={() => onAdd(item)}
            accessibilityRole="button"
            accessibilityLabel={`Add ${item.title} to cart`}
            androidRipple={false}
            pressedOpacity={0.85}
            row
            align="center"
            gap={5}
            rounded={32}
            px={5}
            py={5}
            style={{ backgroundColor: tokens.brandBg }}
          >
            <Plus size={20} strokeWidth={2.8} color={tokens.onBrand} />
          </AppPressableView>
        </AppView>
      </AppView>
    </AppView>
  );
}

export default memo(ProductRow);
