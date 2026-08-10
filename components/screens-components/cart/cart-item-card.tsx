import { memo } from 'react';
import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import AppImage from '@/components/shared/app-image';
import { AppOemPill } from '@/components/shared/app-oem-pill';
import { AppQtyStepper } from '@/components/shared/app-qty-stepper';
import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import type { CartItem } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';

const FALLBACK_IMAGE = require('@/assets/images/test-image.png');

export type CartItemCardProps = {
  item: CartItem;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
};

/**
 * Cart line item, styled to the Mator handoff: 80px thumbnail, title + OEM
 * pill (when present), line price, a 30px quantity stepper, and an ✕ remove
 * affordance. Real cart data only — the OEM pill renders only if the item
 * carries an `oem`.
 */
function CartItemCard({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemCardProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const imageSource = item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE;
  const oem = (item as CartItem & { oem?: string }).oem;

  return (
    <AppView
      row
      gap="md"
      rounded={16}
      px={12}
      py={12}
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
      }}
    >
      <AppImage
        source={imageSource}
        width={80}
        height={80}
        rounded={12}
        contentFit="cover"
        alt={item.title}
      />
      <AppView flex={1} gap={8} style={{ justifyContent: 'space-between' }}>
        <AppView row align="flex-start" gap={8}>
          <AppView flex={1} gap={5}>
            <AppText textVariant="bodySemibold" weight="semibold" numberOfLines={2}>
              {item.title}
            </AppText>
            {oem ? <AppOemPill oem={oem} /> : null}
          </AppView>
          <AppPressableView
            onPress={onRemove}
            center
            rounded={999}
            pressedOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel={t('cart.removeItemFromCart', { title: item.title })}
            style={{ width: 26, height: 26 }}
          >
            <X size={16} strokeWidth={2.2} color={tokens.textMuted} />
          </AppPressableView>
        </AppView>

        <AppView row align="center" justify="space-between" gap="md">
          <AppPrice value={item.price} size={18} />
          <AppQtyStepper
            value={item.quantity}
            onIncrement={onIncrement}
            onDecrement={onDecrement}
            size="sm"
          />
        </AppView>
      </AppView>
    </AppView>
  );
}

export default memo(CartItemCard);
