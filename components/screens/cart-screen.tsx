import { router } from 'expo-router';

import CartEmptyState from '@/components/screens-components/cart-empty-state';
import CartItemsSection from '@/components/screens-components/cart-items-section';
import ScreenShell from '@/components/screens-components/screen-shell';
import { AppButton } from '@/components/shared/app-button';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppView } from '@/components/shared/app-view';
import { useCartContext } from '@/contexts/cart.context';
import { useGlobalModal } from '@/hooks/use-global-modal';

export default function CartScreen() {
  const { items, itemCount, clearCart, incrementItem, decrementItem, removeItem } =
    useCartContext();
  const { openCheckoutSheet } = useGlobalModal();

  return (
    <AppView flex={1} colorName="background" px={16} mt={20}>
      <ScreenShell
        title="Review your selections"
        description={
          itemCount
            ? `${itemCount} item${itemCount === 1 ? '' : 's'} ready for checkout.`
            : 'Your saved parts and upgrades will appear here.'
        }
      >
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          <AppView mt={12} gap={12}>
            {items.length ? (
              <>
                <CartItemsSection
                  items={items}
                  onClear={clearCart}
                  onIncrement={incrementItem}
                  onDecrement={decrementItem}
                  onRemove={removeItem}
                />
                <AppButton
                  title="Proceed to checkout"
                  kind="brand"
                  size="lg"
                  fullWidth
                  onPress={() =>
                    openCheckoutSheet({
                      title: 'Checkout details',
                      description:
                        'Add delivery details, decide on installment, and choose the payment method before continuing.',
                      confirmLabel: 'Review order',
                      cancelLabel: 'Not now',
                      paymentMethods: ['Card', 'Cash on delivery', 'Bank transfer', 'Apple Pay'],
                      onSubmit: () => router.push('/checkout'),
                    })
                  }
                />
              </>
            ) : (
              <CartEmptyState />
            )}
          </AppView>
        </AppScrollView>
      </ScreenShell>
    </AppView>
  );
}
