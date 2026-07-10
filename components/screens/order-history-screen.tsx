import React from 'react';
import { router } from 'expo-router';
import { AlertCircle, PackageOpen } from 'lucide-react-native';
import { RefreshControl, ScrollView } from 'react-native';

import { WheelLoader } from '@/components/shared/wheel-loader';

import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useOrders } from '@/hooks/use-orders';
import type { OrderListRow, OrderListStatus } from '@/services/orders-service';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Order History — faithful rebuild of the prototype's order list, now on the
 * real orders layer (`useOrders`) with its loading / empty / error / success
 * state machine. Each row taps through to Track Order carrying its `orderId`.
 */
export default function OrderHistoryScreen() {
  const { tokens } = useThemeContext();
  const { state, page, error, refresh } = useOrders();

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Order history" fallbackHref="/profile" />

      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={30} color={tokens.text} />
        </AppView>
      ) : state === 'error' ? (
        <AppView flex={1} center px="xl" gap={12}>
          <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
          <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}>
            {error ?? 'Could not load your orders.'}
          </AppText>
          <AppButton title="Retry" kind="secondary" size="sm" onPress={refresh} />
        </AppView>
      ) : state === 'empty' ? (
        <AppView flex={1} center px="xl" gap={12}>
          <PackageOpen size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center' }}>
            You haven&apos;t placed any orders yet.
          </AppText>
          <AppButton title="Start shopping" kind="brand" size="sm" onPress={() => router.navigate('/explore')} />
        </AppView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 12, paddingHorizontal: 16 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={tokens.textMuted} colors={[tokens.brandBg]} />
          }
        >
          {(page?.items ?? []).map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </ScrollView>
      )}
    </AppView>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────

const statusToneMap: Record<OrderListStatus, 'success' | 'warning' | 'error'> = {
  Delivered: 'success',
  'In Transit': 'warning',
  'Out for delivery': 'warning',
  Processing: 'warning',
  Cancelled: 'error',
};

const OrderCard = React.memo(function OrderCard({ order }: { order: OrderListRow }) {
  const { tokens } = useThemeContext();

  const tone = statusToneMap[order.status] ?? 'warning';
  const statusColor = tone === 'success' ? tokens.success : tone === 'error' ? tokens.error : tokens.warning;

  const handlePress = () => {
    triggerHaptic('selection');
    router.push({ pathname: '/track-order', params: { orderId: order.id } });
  };

  return (
    <AppPressableView
      androidRipple={false}
      pressedOpacity={0.88}
      pressedScale={0.99}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel={`Order ${order.id}, ${order.status}`}
      style={{
        backgroundColor: tokens.card,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* Top row: order # mono/bold + status pill */}
      <AppView row align="center" justify="space-between">
        <AppText
          weight="bold"
          style={{
            fontFamily: 'SpaceMono',
            fontSize: 14,
            lineHeight: 18,
            color: tokens.text,
          }}
        >
          {order.id}
        </AppText>

        <AppView
          style={{
            backgroundColor: tokens.backgroundSecondary,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 3,
          }}
        >
          <AppText
            family="accent"
            weight="bold"
            style={{ fontSize: 11, color: statusColor }}
          >
            {order.status}
          </AppText>
        </AppView>
      </AppView>

      {/* Summary line */}
      <AppText
        family="default"
        weight="semibold"
        numberOfLines={1}
        style={{ fontSize: 13.5, color: tokens.text, marginTop: 8 }}
      >
        {order.summary}
      </AppText>

      {/* Bottom row: date · N items + total */}
      <AppView row align="center" justify="space-between" style={{ marginTop: 6 }}>
        <AppText
          family="default"
          style={{ fontSize: 13, color: tokens.textMuted }}
        >
          {order.date} · {order.items} item{order.items > 1 ? 's' : ''}
        </AppText>
        <AppText
          family="heading"
          weight="bold"
          style={{ fontSize: 16, lineHeight: 20, color: tokens.text }}
        >
          {order.total}
        </AppText>
      </AppView>
    </AppPressableView>
  );
});
