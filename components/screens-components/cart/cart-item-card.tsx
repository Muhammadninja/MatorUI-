import { Minus, Plus, Trash2 } from 'lucide-react-native';

import AppImage from '@/components/shared/app-image';
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

export default function CartItemCard({
  item,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemCardProps) {
  const { tokens, scheme } = useThemeContext();
  const imageSource = item.imageUrl ? { uri: item.imageUrl } : FALLBACK_IMAGE;

  return (
    <AppView
      rounded={16}
      px={14}
      py={14}
      gap="md"
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
      }}
    >
      <AppView row align="center" gap="md">
        <AppImage
          source={imageSource}
          width={64}
          height={64}
          rounded={8}
          contentFit="cover"
          alt={item.title}
        />
        <AppView gap="xs" style={{ flex: 1 }}>
          <AppText textVariant="bodySemibold" numberOfLines={2}>
            {item.title}
          </AppText>
          <AppText textVariant="bodyXs" colorName="gray400">
            {item.badge ? `${item.badge} · ` : ''}
            {item.status ?? 'Ready'}
          </AppText>
        </AppView>
        <AppText textVariant="bodySemibold">{item.price}</AppText>
      </AppView>
      <AppView row align="center" justify="space-between" gap="md">
        <AppPressableView
          onPress={onRemove}
          p={6}
          rounded={8}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.title} from cart`}
        >
          <Trash2 size={18} strokeWidth={2} color={tokens.gray400} />
        </AppPressableView>
        <AppView row align="center" gap="xs">
          <AppPressableView
            rounded={8}
            px={10}
            py={6}
            colorName="card"
            borderWidth={1}
            borderName="border"
            onPress={onDecrement}
            accessibilityRole="button"
            accessibilityLabel={`Decrease quantity of ${item.title}`}
            hitSlop={{ top: 9, bottom: 9, left: 8, right: 8 }}
          >
            <Minus size={14} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
          <AppView
            style={{ minWidth: 28, alignItems: 'center' }}
          >
            <AppText textVariant="bodySm" family="heading">
              {item.quantity}
            </AppText>
          </AppView>
          <AppPressableView
            rounded={8}
            px={10}
            py={6}
            colorName="card"
            borderWidth={1}
            borderName="border"
            onPress={onIncrement}
            accessibilityRole="button"
            accessibilityLabel={`Increase quantity of ${item.title}`}
            hitSlop={{ top: 9, bottom: 9, left: 8, right: 8 }}
          >
            <Plus size={14} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
        </AppView>
      </AppView>
    </AppView>
  );
}
