import { router } from 'expo-router';
import { Box, ChevronRight, PackageX } from 'lucide-react-native';
import { memo, useCallback } from 'react';

import OrderRowSkeleton from '@/components/screens-components/orders/order-row-skeleton';

import AppList from '@/components/shared/app-list';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useOrders } from '@/hooks/use-orders';
import type { OrderListRow, OrderListStatus } from '@/services/orders-service';
import { triggerHaptic } from '@/utils/haptics';

type ThemeTokens = ReturnType<typeof useThemeContext>['tokens'];

// Status colors live in the theme so they flip with dark mode.
// Status → token-key → tokens[key]; defined as a function (not a static
// map) so it picks up the active scheme at render time.
function statusColorFor(status: OrderListStatus, tokens: ThemeTokens): string {
  switch (status) {
    case 'Delivered':
      return tokens.success;
    case 'In Transit':
    case 'Out for delivery':
      return tokens.warning;
    case 'Processing':
      return tokens.info;
    case 'Cancelled':
      return tokens.error;
    default:
      return tokens.gray400;
  }
}

const IN_PROCESS_STATUSES = new Set<OrderListStatus>([
  'In Transit',
  'Out for delivery',
  'Processing',
]);

export default function OrderHistoryScreen() {
  const { tokens } = useThemeContext();
  const { state, page, error, refresh } = useOrders();
  const orders = page?.items ?? [];

  // Loading / error / empty render plain non-virtual content, so we keep
  // a ScrollView for them. The success path swaps to FlashList so order
  // counts of 100+ stay 60fps.
  const isList = state === 'success';
  const header = (
    <AppView px="lg" pb="md">
      <AppText textVariant="bodySm" colorName="gray400">
        {orderCountLabel(state, page?.total ?? 0)}
      </AppText>
    </AppView>
  );

  const keyExtractor = useCallback((order: OrderListRow) => order.id, []);
  const renderItem = useCallback(
    ({ item }: { item: OrderListRow }) => (
      <AppView px="lg" pb="md">
        <OrderRow order={item} />
      </AppView>
    ),
    [],
  );

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Order History" fallbackHref="/profile" />
      {isList ? (
        <AppList<OrderListRow>
          data={orders}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 8, paddingBottom: 32, flexGrow: 1 }}
        >
          <AppView gap="lg" style={{ flex: 1 }}>
            {header}
            {state === 'loading' || state === 'idle' ? (
              <OrderRowSkeleton />
            ) : state === 'error' ? (
              <AppView px="lg">
                <ErrorCard message={error ?? 'Could not load orders.'} onRetry={refresh} />
              </AppView>
            ) : (
              <AppView px="lg">
                <EmptyCard />
              </AppView>
            )}
          </AppView>
        </AppScrollView>
      )}
    </AppView>
  );
}

function orderCountLabel(state: ReturnType<typeof useOrders>['state'], total: number): string {
  if (state === 'success') return `${total} order${total === 1 ? '' : 's'} placed in the last 12 months.`;
  if (state === 'empty') return 'No orders yet.';
  return ' ';
}

const OrderRow = memo(function OrderRow({ order }: { order: OrderListRow }) {
  const { tokens } = useThemeContext();
  const isActionable = IN_PROCESS_STATUSES.has(order.status);
  const handlePress = isActionable
    ? () => {
        triggerHaptic('selection');
        router.push(`/track-order?orderId=${encodeURIComponent(order.id)}`);
      }
    : undefined;

  return (
    <AppPressableView
      androidRipple={false}
      onPress={handlePress}
      disabled={!isActionable}
      accessibilityRole={isActionable ? 'button' : undefined}
      accessibilityLabel={
        isActionable
          ? `Track order ${order.id}, ${order.status}`
          : `Order ${order.id}, ${order.status}`
      }
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
        padding: 16,
      }}
    >
      <AppView gap={10}>
        <AppView row align="center" justify="space-between">
          <AppView row align="center" gap="sm">
            <AppView
              center
              rounded={8}
              style={{
                width: 34,
                height: 34,
                backgroundColor: tokens.backgroundSecondary,
              }}
            >
              <Box size={16} strokeWidth={2.1} color={tokens.icon} />
            </AppView>
            <AppView gap={2}>
              <AppText textVariant="bodySemibold" weight="semibold">
                {order.id}
              </AppText>
              <AppText textVariant="bodyXs" colorName="gray400">
                {order.date}
              </AppText>
            </AppView>
          </AppView>
          {isActionable ? (
            <ChevronRight size={16} strokeWidth={2.2} color={tokens.gray400} />
          ) : null}
        </AppView>

        <AppView
          style={{ height: 1, backgroundColor: tokens.divider, marginHorizontal: -2 }}
        />

        <AppView row align="center" justify="space-between">
          <AppView gap={3}>
            <AppText textVariant="bodyXs" colorName="gray400">
              {order.summary}
            </AppText>
            <AppView row align="center" gap={6}>
              <AppView
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  backgroundColor: statusColorFor(order.status, tokens),
                }}
              />
              <AppText
                textVariant="caption"
                family="accent"
                weight="semibold"
                style={{ color: statusColorFor(order.status, tokens) }}
              >
                {order.status}
              </AppText>
            </AppView>
          </AppView>
          <AppText textVariant="bodySemibold" weight="bold">
            {order.total}
          </AppText>
        </AppView>
      </AppView>
    </AppPressableView>
  );
});

function EmptyCard() {
  const { tokens } = useThemeContext();
  return (
    <AppView
      rounded={16}
      px={20}
      py={28}
      gap="md"
      align="center"
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
      }}
    >
      <AppView
        center
        rounded={999}
        colorName="backgroundSecondary"
        borderName="border"
        borderWidth={1}
        style={{ width: 56, height: 56 }}
      >
        <PackageX size={22} strokeWidth={2} color={tokens.gray400} />
      </AppView>
      <AppView align="center" gap="xs">
        <AppText textVariant="bodySemibold">No orders yet</AppText>
        <AppText textVariant="bodySm" colorName="gray400" align="center">
          When you place an order it will appear here.
        </AppText>
      </AppView>
    </AppView>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      rounded={16}
      px={20}
      py={20}
      gap="sm"
      align="center"
      onPress={onRetry}
      accessibilityRole="button"
      accessibilityLabel="Retry"
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
      }}
    >
      <AppText textVariant="bodySemibold">Could not load orders</AppText>
      <AppText textVariant="bodySm" colorName="gray400" align="center">
        {message}
      </AppText>
      <AppText textVariant="bodySm" weight="semibold" style={{ color: tokens.text, marginTop: 4 }}>
        Tap to retry
      </AppText>
    </AppPressableView>
  );
}
