import React, { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { AlertCircle, PackageOpen, Timer } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { RefreshControl, ScrollView } from 'react-native';

import { WheelLoader } from '@/components/shared/wheel-loader';

import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { stageColors } from '@/components/screens-components/orders/order-status-card';
import { useThemeContext } from '@/contexts/theme.context';
import { useOrderCancelWindow } from '@/hooks/use-order-cancel-window';
import { useOrders } from '@/hooks/use-orders';
import { formatCountdown } from '@/services/order-cancel-window';
import {
  ORDER_STAGE_I18N,
  orderStage,
  orderStageTone,
  ordersForTab,
  type OrdersTab,
} from '@/services/order-groups';
import {
  formatOrderNo,
  ORDER_LIST_STATUS_I18N,
  type OrderListRow,
  type OrderListStatus,
} from '@/services/orders-service';
import { triggerHaptic } from '@/utils/haptics';
import { useGoToTab } from '@/hooks/use-app-navigation';

/**
 * My orders — the buyer's orders on the real orders layer (`useOrders`) with its loading /
 * empty / error / success states, in two tabs: what is still under way, and everything.
 * A cancelled or expired order is never listed (see order-groups). It opens on "Active"
 * when something is under way, on "All" otherwise. Each row taps through to Track Order
 * carrying its `orderId`.
 */
export default function OrderHistoryScreen() {
  const goToTab = useGoToTab();
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { state, page, refresh } = useOrders();
  const [chosenTab, setChosenTab] = useState<OrdersTab | null>(null);

  const active = useMemo(() => ordersForTab(page?.items ?? [], 'active'), [page]);
  const all = useMemo(() => ordersForTab(page?.items ?? [], 'all'), [page]);
  const tab: OrdersTab = chosenTab ?? (active.length > 0 ? 'active' : 'all');
  const shown = tab === 'active' ? active : all;

  return (
    <AppView flex={1} colorName="background" testID="order-history-screen">
      <AppSettingsHeader title={t('orderHistory.title')} fallbackHref="/profile" />

      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={30} color={tokens.text} />
        </AppView>
      ) : state === 'error' ? (
        <AppView flex={1} center px="xl" gap={12}>
          <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
          <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}>
            {t('orderHistory.loadError')}
          </AppText>
          <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={refresh} />
        </AppView>
      ) : state === 'empty' || all.length === 0 ? (
        <AppView flex={1} center px="xl" gap={12} testID="order-history-empty">
          <PackageOpen size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center' }}>
            {t('orderHistory.emptyText')}
          </AppText>
          <AppButton title={t('orderHistory.startShopping')} kind="brand" size="sm" onPress={() => goToTab('/explore')} />
        </AppView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 40, gap: 12, paddingHorizontal: 16 }}
          refreshControl={
            <RefreshControl refreshing={false} onRefresh={refresh} tintColor={tokens.textMuted} colors={[tokens.brandBg]} />
          }
        >
          <OrdersTabs
            tab={tab}
            onChange={setChosenTab}
            counts={{ active: active.length, all: all.length }}
          />
          {shown.length === 0 ? (
            <AppView center gap={12} testID="order-history-active-empty" style={{ paddingVertical: 48 }}>
              <PackageOpen size={30} strokeWidth={2} color={tokens.textMuted} />
              <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center' }}>
                {t('orderHistory.noActive')}
              </AppText>
              <AppButton title={t('orderHistory.showAll')} kind="secondary" size="sm" onPress={() => setChosenTab('all')} />
            </AppView>
          ) : (
            shown.map((order) => <OrderCard key={order.id} order={order} />)
          )}
        </ScrollView>
      )}
    </AppView>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

function OrdersTabs({
  tab,
  onChange,
  counts,
}: {
  tab: OrdersTab;
  onChange: (tab: OrdersTab) => void;
  counts: Record<OrdersTab, number>;
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const tabs: { key: OrdersTab; label: string }[] = [
    { key: 'active', label: t('orderHistory.tabActive') },
    { key: 'all', label: t('orderHistory.tabAll') },
  ];
  return (
    <AppView
      testID="order-history-tabs"
      row
      accessibilityRole="tablist"
      style={{ backgroundColor: tokens.backgroundSecondary, borderRadius: 12, padding: 3 }}
    >
      {tabs.map(({ key, label }) => {
        const selected = key === tab;
        return (
          <AppPressableView
            key={key}
            testID={`order-history-tab-${key}`}
            onPress={() => {
              if (selected) return;
              triggerHaptic('selection');
              onChange(key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={t('orderHistory.tabA11y', { label, count: counts[key] })}
            androidRipple={false}
            flex={1}
            row
            center
            gap={6}
            style={{
              minHeight: 38,
              borderRadius: 10,
              paddingHorizontal: 8,
              backgroundColor: selected ? tokens.card : 'transparent',
              borderWidth: selected ? 1 : 0,
              borderColor: tokens.border,
            }}
          >
            <AppText
              family="accent"
              weight={selected ? 'bold' : 'semibold'}
              numberOfLines={1}
              style={{ fontSize: 14, color: selected ? tokens.text : tokens.textMuted, flexShrink: 1 }}
            >
              {label}
            </AppText>
            <AppText
              family="accent"
              weight="bold"
              style={{ fontSize: 12, color: tokens.textMuted, fontVariant: ['tabular-nums'] }}
            >
              {counts[key]}
            </AppText>
          </AppPressableView>
        );
      })}
    </AppView>
  );
}

// ── Order card ────────────────────────────────────────────────────────────────

const statusToneMap: Record<OrderListStatus, 'success' | 'warning' | 'error'> = {
  Delivered: 'success',
  Refunded: 'success',
  'In Transit': 'warning',
  'Out for delivery': 'warning',
  Processing: 'warning',
  Cancelled: 'error',
};

const OrderCard = React.memo(function OrderCard({ order }: { order: OrderListRow }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  // The stage's own words and colour (Awaiting payment, On the way, Ready for pickup…),
  // or the list pill's for a status the app has no stage for.
  const stage = orderStage(order);
  const tone = statusToneMap[order.status] ?? 'warning';
  const statusColor = stage
    ? stageColors(tokens, orderStageTone(stage)).fg
    : tone === 'success'
      ? tokens.success
      : tone === 'error'
        ? tokens.error
        : tokens.warning;
  const statusText = stage
    ? t(ORDER_STAGE_I18N[stage].title)
    : t(ORDER_LIST_STATUS_I18N[order.status] ?? '', { defaultValue: order.status });

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
      accessibilityLabel={t('orderHistory.orderAccessibility', { id: order.id, status: statusText })}
      style={{
        backgroundColor: tokens.card,
        borderWidth: 1,
        borderColor: tokens.border,
        borderRadius: 16,
        padding: 16,
      }}
    >
      {/* Top row: order # mono/bold + status pill */}
      <AppView row align="center" justify="space-between" style={{ gap: 10 }}>
        <AppText
          weight="bold"
          style={{
            fontFamily: 'SpaceMono',
            fontSize: 14,
            lineHeight: 18,
            color: tokens.text,
            flexShrink: 1,
          }}
        >
          {formatOrderNo(order.id)}
        </AppText>

        <AppView
          style={{
            flexShrink: 0,
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
            {statusText}
          </AppText>
        </AppView>
      </AppView>

      {/* Summary line */}
      <AppText
        family="default"
        weight="semibold"
        style={{ fontSize: 14, color: tokens.text, marginTop: 8 }}
      >
        {order.summary}
      </AppText>

      <OrderCountdownChip order={order} />

      {/* Bottom row: date · N items + total */}
      <AppView row wrap align="center" justify="space-between" style={{ marginTop: 6 }}>
        <AppText
          family="default"
          style={{ fontSize: 13, color: tokens.textMuted }}
        >
          {t('orderHistory.dateItems', { date: order.date, count: order.items })}
        </AppText>
        <AppPrice value={order.total} size={16} color={tokens.text} />
      </AppView>
    </AppPressableView>
  );
});

// ── Countdown chip ────────────────────────────────────────────────────────────

/** Time left before the backend expires an unpaid online order. Renders nothing
 *  for an order with no deadline. Display only: at zero the order is re-read. */
function OrderCountdownChip({ order }: { order: OrderListRow }) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { remainingMs, expired } = useOrderCancelWindow(order);
  if (remainingMs === null) return null;

  const time = formatCountdown(remainingMs);
  return (
    <AppView
      testID="order-countdown"
      row
      align="center"
      gap={6}
      accessible
      accessibilityLabel={
        expired ? t('orderHistory.autoCancelling') : t('orderHistory.autoCancelA11y', { time })
      }
      style={{
        alignSelf: 'flex-start',
        marginTop: 8,
        backgroundColor: tokens.warningSoft,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Timer size={14} strokeWidth={2.2} color={tokens.warning} />
      <AppText
        family="accent"
        weight="bold"
        style={{ fontSize: 12, color: tokens.warning, fontVariant: ['tabular-nums'] }}
      >
        {expired ? t('orderHistory.autoCancelling') : t('orderHistory.autoCancelIn', { time })}
      </AppText>
    </AppView>
  );
}
