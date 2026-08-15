import { memo } from 'react';
import { useTranslation } from 'react-i18next';

import { AppOemPill } from '@/components/shared/app-oem-pill';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { money, savePercent, type MatorProduct } from '@/mocks/mator-catalog';
import { openItemDetail } from '@/utils/nav';

import ImageBox from './image-box';
import Rating from './rating';

export type ProductCardProps = {
  product: MatorProduct;
};

/**
 * Grid product card from the prototype's `productCard()`: image (120h, 11r)
 * with an optional green "SAVE X%" pill, 2-line title, OEM pill, and a
 * price (+ struck was) / rating row. Taps through to Item Detail.
 */
function ProductCard({ product: p }: ProductCardProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const save = savePercent(p);

  return (
    <AppPressableView
      onPress={() => openItemDetail(p.id)}
      accessibilityRole="button"
      accessibilityLabel={p.title}
      androidRipple={false}
      pressedOpacity={0.9}
      flex={1}
      gap={8}
      rounded={16}
      p={10}
      colorName="card"
      borderWidth={1}
      borderName="border"
    >
      <AppView style={{ position: 'relative' }}>
        <ImageBox label={p.img} uri={p.imageUrl} height={120} radius={11} />
        {save !== null ? (
          <AppView
            style={{
              position: 'absolute',
              top: 8,
              left: 8,
              backgroundColor: tokens.value,
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 6,
            }}
          >
            <AppText family="accent" weight="bold" style={{ fontSize: 10, color: tokens.onValue }}>
              {t('home.savePercent', { percent: save })}
            </AppText>
          </AppView>
        ) : null}
      </AppView>

      <AppText
        family="default"
        weight="semibold"
        numberOfLines={2}
        style={{ fontSize: 13, lineHeight: 17, color: tokens.text, minHeight: 34 }}
      >
        {p.title}
      </AppText>

      <AppOemPill oem={p.oem} />

      <AppView row align="center" justify="space-between" style={{ marginTop: 2 }}>
        <AppView row align="flex-end" gap={6}>
          <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
            {money(p.price)}
          </AppText>
          {p.was ? (
            <AppText
              family="default"
              style={{ fontSize: 11, color: tokens.textMuted, textDecorationLine: 'line-through' }}
            >
              {money(p.was)}
            </AppText>
          ) : null}
        </AppView>
        <Rating value={p.rating} size={11} />
      </AppView>
    </AppPressableView>
  );
}

export default memo(ProductCard);
