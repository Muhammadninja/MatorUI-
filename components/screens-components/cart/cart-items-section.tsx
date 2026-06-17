import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import type { CartItem } from '@/contexts/cart.context';

import CartItemCard from './cart-item-card';

export type CartItemsSectionProps = {
  items: CartItem[];
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onRemove: (itemId: string) => void;
};

export default function CartItemsSection({
  items,
  onIncrement,
  onDecrement,
  onRemove,
}: CartItemsSectionProps) {
  return (
    <AppView gap="md">
      <AppText textVariant="subtitle" family="accent">
        Cart items
      </AppText>
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
