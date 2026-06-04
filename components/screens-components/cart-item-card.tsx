import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import type { CartItem } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { Image } from 'expo-image';

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

  return (
    <AppView
      rounded={24}
      px={14}
      py={14}
      gap={10}
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
      }}
    >
      <AppView row align="center" gap={12}>
        <Image
          source={require('@/assets/images/test-image.png')}
          style={{ width: 72, height: 72, borderRadius: 14 }}
          contentFit="cover"
        />
        <AppView gap={4} style={{ flex: 1 }}>
          <AppText textVariant="bodySemibold">{item.title}</AppText>
          <AppText textVariant="bodySm" colorName="gray400">
            {item.description}
          </AppText>
        </AppView>
        <AppText textVariant="bodySemibold">{item.price}</AppText>
      </AppView>
      <AppView row align="center" justify="space-between" gap={12}>
        <AppText textVariant="bodyXs" colorName="gray400">
          {item.badge ?? 'Featured'} . {item.status ?? 'Ready'}
        </AppText>
        <AppView row align="center" gap={8}>
          <AppPressableView
            rounded={36}
            px={10}
            py={6}
            colorName="card"
            borderWidth={1}
            borderName="border"
            onPress={onDecrement}
          >
            <AppText textVariant="bodySm">-</AppText>
          </AppPressableView>
          <AppText textVariant="bodySm" family="heading">
            {item.quantity}
          </AppText>
          <AppPressableView
            rounded={36}
            px={10}
            py={6}
            colorName="card"
            borderWidth={1}
            borderName="border"
            onPress={onIncrement}
          >
            <AppText textVariant="bodySm">+</AppText>
          </AppPressableView>
          <AppButton
            title="Remove"
            kind="secondary"
            variant="outline"
            size="xs"
            onPress={onRemove}
          />
        </AppView>
      </AppView>
    </AppView>
  );
}
