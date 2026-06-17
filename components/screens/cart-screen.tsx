import { router } from 'expo-router';
import { Truck } from 'lucide-react-native';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CartEmptyState from '@/components/screens-components/cart/cart-empty-state';
import CartItemsSection from '@/components/screens-components/cart/cart-items-section';
import CartSummary from '@/components/screens-components/cart/cart-summary';
import { AppButton } from '@/components/shared/app-button';
import { AppIconButton } from '@/components/shared/app-icon-button';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useAuthGuard } from '@/guards';
import { useOrders } from '@/hooks/use-orders';
import type { OrderListStatus } from '@/services/orders-service';
import { triggerHaptic } from '@/utils/haptics';

// Statuses that map to "a delivery is in motion" — these are the ones
// the cart's truck icon should jump straight to. Anything terminal
// (Delivered / Cancelled) is intentionally excluded.
const IN_TRANSIT_STATUSES = new Set<OrderListStatus>([
  'In Transit',
  'Out for delivery',
  'Processing',
]);

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
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { requireAuth } = useAuthGuard();

  const handleProceedToCheckout = requireAuth(() => router.push('/checkout'), {
    title: 'Sign in to check out',
    message:
      'You must sign up or log in before you can place an order. Your cart will stay saved.',
    redirectTo: '/checkout',
  });

  // Resolve the most recent in-transit order so the truck icon jumps
  // straight to its tracking screen. Falls back to the order list when
  // nothing is currently in motion.
  const ordersPage = useOrders();
  const activeOrderId = useMemo(() => {
    const rows = ordersPage.page?.items ?? [];
    return rows.find((o) => IN_TRANSIT_STATUSES.has(o.status))?.id ?? null;
  }, [ordersPage.page]);

  const handleTrackOrder = () => {
    triggerHaptic('selection');
    if (activeOrderId) {
      router.push(`/track-order?orderId=${encodeURIComponent(activeOrderId)}`);
      return;
    }
    // No in-flight delivery — fall back to the order list so the user
    // still has somewhere meaningful to land.
    router.push('/order-history');
  };

  const hasItems = items.length > 0;
  const showBottomBar = hasItems;

  return (
    <AppView flex={1} colorName="background">
      <AppView
        px="lg"
        pb="md"
        style={{
          paddingTop: insets.top + 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.divider,
        }}
      >
        <AppView row align="center" justify="space-between" gap="md">
          <AppView gap={2} style={{ flex: 1 }}>
            <AppText textVariant="h3" family="heading" weight="bold">
              Cart
            </AppText>
            {hasItems ? (
              <AppText textVariant="bodyXs" colorName="gray400">
                {itemCount} item{itemCount === 1 ? '' : 's'}
              </AppText>
            ) : null}
          </AppView>
          <AppIconButton
            Icon={Truck}
            onPress={handleTrackOrder}
            accessibilityLabel="Track orders"
            backgroundColorName="card"
            borderColorName="border"
            colorName="text"
          />
        </AppView>
      </AppView>

      <AppView flex={1} px="lg">
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingBottom: showBottomBar ? 120 : 24,
            paddingTop: 12,
            flexGrow: 1,
          }}
        >
          {!isHydrated ? null : hasItems ? (
            <AppView gap="md">
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
          )}
        </AppScrollView>
      </AppView>

      {showBottomBar ? (
        <AppView
          px="lg"
          py="md"
          style={{
            paddingBottom: Math.max(insets.bottom, 24),
          }}
        >
          <AppButton
            title={`Checkout · ${formatCurrency(totals.total)}`}
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
