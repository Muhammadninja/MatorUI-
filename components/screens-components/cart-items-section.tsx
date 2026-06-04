import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import type { CartItem } from '@/contexts/cart.context';

import CartItemCard from './cart-item-card';

export type CartItemsSectionProps = {
  items: CartItem[];
  onClear: () => void;
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onRemove: (itemId: string) => void;
};

export default function CartItemsSection({
  items,
  onClear,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemsSectionProps) {
  return (
    <AppView gap={12}>
      <AppView row justify="space-between" align="center">
        <AppText textVariant="subtitle" family="accent">
          Cart items
        </AppText>
        <AppButton title="Clear" kind="secondary" variant="outline" size="xs" onPress={onClear} />
      </AppView>
      {items.map((item) => (
        <CartItemCard
          key={item.id}
          item={item}
          onIncrement={() => onIncrement(item.id)}
          onDecrement={() => onDecrement(item.id)}
          onRemove={() => onRemove(item.id)}
        />
      ))}
    </AppView>
  );
}
