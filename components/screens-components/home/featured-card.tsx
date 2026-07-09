import { router } from 'expo-router';
import { memo } from 'react';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { money, type MatorProduct } from '@/mocks/mator-catalog';

import ImageBox from './image-box';
import Rating from './rating';

export type FeaturedCardProps = {
  product: MatorProduct;
};

/**
 * Top-Featured carousel card from the prototype's Explore carousel: fixed
 * 200px width, image (110h), title, brand, and a price / rating row.
 */
function FeaturedCard({ product: p }: FeaturedCardProps) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      onPress={() => router.push(`/item-detail/${p.id}`)}
      accessibilityRole="button"
      accessibilityLabel={p.title}
      androidRipple={false}
      pressedOpacity={0.9}
      gap={10}
      rounded={16}
      p={12}
      colorName="card"
      borderWidth={1}
      borderName="border"
      style={{ width: 200 }}
    >
      <ImageBox label={p.img} uri={p.imageUrl} height={110} radius={11} />
      <AppText family="default" weight="semibold" numberOfLines={1} style={{ fontSize: 14, color: tokens.text }}>
        {p.title}
      </AppText>
      <AppText family="default" numberOfLines={1} style={{ fontSize: 12, color: tokens.textMuted }}>
        {p.brand}
      </AppText>
      <AppView row align="center" justify="space-between">
        <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
          {money(p.price)}
        </AppText>
        <Rating value={p.rating} size={12} />
      </AppView>
    </AppPressableView>
  );
}

export default memo(FeaturedCard);
