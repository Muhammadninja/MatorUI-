import { router } from 'expo-router';
import { Truck } from 'lucide-react-native';
import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CartBuyAgainSection from '@/components/screens-components/cart/cart-buy-again-section';
import CartEmptyState from '@/components/screens-components/cart/cart-empty-state';
import CartItemsSection from '@/components/screens-components/cart/cart-items-section';
import CartListsSection from '@/components/screens-components/cart/cart-lists-section';
import CartSectionTabs, {
    type CartSection,
} from '@/components/screens-components/cart/cart-section-tabs';
import CartSummary from '@/components/screens-components/cart/cart-summary';
import { AppButton } from '@/components/shared/app-button';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useAuthGuard } from '@/guards';
import { triggerHaptic } from '@/utils/haptics';

// Mocked while the orders backend isn't wired; track-order screen also uses mock data.
const MOCK_AWAITING_ORDERS: number = 2;

export default function CartScreen() {
  const {
    items,
    itemCount,
    totals,
    appliedPromo,
    freeShippingThreshold,
    freeShippingRemaining,
    isHydrated,
    incrementItem,
    decrementItem,
    removeItem,
    formatCurrency,
  } = useCartContext();
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { requireAuth } = useAuthGuard();
  const [section, setSection] = useState<CartSection>('cart');

  const handleProceedToCheckout = requireAuth(() => router.push('/checkout'), {
    title: 'Sign in to check out',
    message:
      'You must sign up or log in before you can place an order. Your cart will stay saved.',
    redirectTo: '/checkout',
  });

  const handleTrackOrder = () => {
    triggerHaptic('selection');
    router.push('/track-order');
  };

  const hasItems = items.length > 0;
  const showBottomBar = section === 'cart' && hasItems;
  const awaitingOrders = MOCK_AWAITING_ORDERS;

  return (
    <AppView flex={1} colorName="background">
      <AppView
        px={16}
        pb={16}
        gap={16}
        style={{
          paddingTop: insets.top + 12,
          borderBottomWidth: 0.5,
          borderBottomColor: tokens.gray400,
        }}
      >
        <AppView row align="center" justify="space-between" gap={12}>
          <AppView gap={2} style={{ flex: 1 }}>
            <AppText textVariant="bodyXs" colorName="gray400">
              {hasItems
                ? `Total · ${itemCount} item${itemCount === 1 ? '' : 's'}`
                : 'Total'}
            </AppText>
            <AppText textVariant="h3" family="heading" weight="bold">
              {formatCurrency(totals.total)}
            </AppText>
          </AppView>
          <AppView style={{ position: 'relative' }}>
            <AppPressableView
              center
              rounded={36}
              onPress={handleTrackOrder}
              androidRipple
              accessibilityLabel={
                awaitingOrders > 0
                  ? `Track ${awaitingOrders} order${awaitingOrders === 1 ? '' : 's'} awaiting`
                  : 'Track orders'
              }
              style={{
                width: 36,
                height: 36,
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
              }}
            >
              <Truck size={18} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
            {awaitingOrders > 0 ? (
              <AppView
                center
                rounded={36}
                style={{
                  position: 'absolute',
                  top: -6,
                  right: -6,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 5,
                  backgroundColor: scheme === 'dark' ? tokens.white : tokens.black,
                }}
              >
                <AppText
                  textVariant="bodyXs"
                  weight="bold"
                  style={{ color: scheme === 'dark' ? tokens.black : tokens.white }}
                >
                  {awaitingOrders > 99 ? '99+' : String(awaitingOrders)}
                </AppText>
              </AppView>
            ) : null}
          </AppView>
        </AppView>

        <AppView
          style={{ height: 0.5, backgroundColor: tokens.gray400, marginHorizontal: -16 }}
        />

        <CartSectionTabs active={section} onChange={setSection} />
      </AppView>

      <AppView flex={1} px={16}>
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: showBottomBar ? 120 : 24, paddingTop: 12 }}
        >
          {section === 'cart' ? (
            !isHydrated ? (
              // Render nothing — the persisted cart hasn't been read yet, so
              // showing the empty state here would flash an incorrect view.
              null
            ) : hasItems ? (
              <AppView gap={12}>
                <CartItemsSection
                  items={items}
                  onIncrement={incrementItem}
                  onDecrement={decrementItem}
                  onRemove={removeItem}
                />
                <CartSummary
                  totals={totals}
                  appliedPromo={appliedPromo}
                  freeShippingThreshold={freeShippingThreshold}
                  freeShippingRemaining={freeShippingRemaining}
                  formatCurrency={formatCurrency}
                />
              </AppView>
            ) : (
              <CartEmptyState />
            )
          ) : null}

          {section === 'lists' ? <CartListsSection /> : null}
          {section === 'buy-again' ? <CartBuyAgainSection /> : null}
        </AppScrollView>
      </AppView>

      {showBottomBar ? (
        <AppView
          px={16}
          py={12}
          style={{
            paddingBottom: Math.max(insets.bottom, 24)
          }}
        >
          <AppButton
            title="Checkout"
            kind="brand"
            weight="bold"
            size="md"
            fullWidth
            onPress={handleProceedToCheckout}
          />
        </AppView>
      ) : null}
    </AppView>
  );
}
