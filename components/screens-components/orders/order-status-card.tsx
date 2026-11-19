import { router, useFocusEffect } from 'expo-router';
import {
  ChevronRight,
  Clock,
  MapPin,
  Package,
  PackageCheck,
  Store,
  Timer,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react-native';
import { useCallback, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView, type AppViewProps } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useOrderCancelWindow } from '@/hooks/use-order-cancel-window';
import { useOrder, useOrders } from '@/hooks/use-orders';
import { formatCountdown } from '@/services/order-cancel-window';
import {
  ORDER_STAGE_I18N,
  orderStageBodyKey,
  orderStageTone,
  statusCardOrders,
  type OrderStage,
  type OrderStageTone,
} from '@/services/order-groups';
import { formatOrderNo, type OrderListRow } from '@/services/orders-service';
import { triggerHaptic } from '@/utils/haptics';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

/** A focus reads the list again at most this often: tab switches are frequent. */
const FOCUS_REFRESH_MS = 30_000;

const STAGE_ICON: Record<OrderStage, LucideIcon> = {
  awaiting_payment: Wallet,
  awaiting_confirmation: Clock,
  preparing: Package,
  on_the_way: Truck,
  ready_for_pickup: Store,
  delivered: PackageCheck,
  refunded: PackageCheck,
};

export function stageColors(tokens: Tokens, tone: OrderStageTone): { fg: string; bg: string } {
  switch (tone) {
    case 'warning':
      return { fg: tokens.warning, bg: tokens.warningSoft };
    case 'brand':
      return { fg: tokens.brandText, bg: tokens.brandSoft };
    case 'success':
      return { fg: tokens.success, bg: tokens.successSoft };
    default:
      return { fg: tokens.textMuted, bg: tokens.backgroundSecondary };
  }
}

/**
 * Where the buyer's orders stand, at a glance: the one that needs them most (paying, then
 * collecting, then what is on its way), with a link to the rest. Shown on Home and Profile
 * for a signed-in buyer with an order under way or just delivered; nothing otherwise, so a
 * guest or a buyer with no current order sees no empty box.
 */
export function OrderStatusCard({
  testID = 'order-status-card',
  px,
}: {
  testID?: string;
  /** Side padding, for a screen whose content has none of its own. */
  px?: AppViewProps['px'];
}) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const { page, refresh } = useOrders();

  // The list was read on mount; read it again on coming back, so an order placed, paid or
  // moved on meanwhile shows up without pulling to refresh.
  const lastRead = useRef(Date.now());
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useFocusEffect(
    useCallback(() => {
      const now = Date.now();
      if (now - lastRead.current < FOCUS_REFRESH_MS) return;
      lastRead.current = now;
      refreshRef.current();
    }, []),
  );

  const cards = useMemo(() => statusCardOrders(page?.items ?? []), [page]);
  if (cards.length === 0) return null;
  const [first, ...rest] = cards;

  return (
    <AppView testID={testID} gap={8} px={px}>
      <OrderStatusRow tokens={tokens} row={first!.row} stage={first!.stage} />
      {rest.length > 0 ? (
        <AppPressableView
          testID={`${testID}-more`}
          onPress={() => {
            triggerHaptic('selection');
            router.push('/order-history');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('orderStage.moreOrders', { count: rest.length })}
          row
          align="center"
          gap={4}
          style={{ alignSelf: 'flex-start', minHeight: 32, paddingHorizontal: 4 }}
        >
          <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.brandText }}>
            {t('orderStage.moreOrders', { count: rest.length })}
          </AppText>
          <ChevronRight size={14} strokeWidth={2.2} color={tokens.brandText} />
        </AppPressableView>
      ) : null}
    </AppView>
  );
}

function OrderStatusRow({ tokens, row, stage }: { tokens: Tokens; row: OrderListRow; stage: OrderStage }) {
  const { t } = useTranslation();
  const Icon = STAGE_ICON[stage];
  const colors = stageColors(tokens, orderStageTone(stage));
  const title = t(ORDER_STAGE_I18N[stage].title);
  const body = t(orderStageBodyKey(stage, row.deliveryMethod));
  const orderNo = formatOrderNo(row.id);

  return (
    <AppPressableView
      testID="order-status-row"
      onPress={() => {
        triggerHaptic('selection');
        router.push({ pathname: '/track-order', params: { orderId: row.id } });
      }}
      accessibilityRole="button"
      accessibilityLabel={t('orderStage.cardA11y', { title, number: orderNo, body })}
      androidRipple={false}
      pressedOpacity={0.88}
      fillContainer
      rounded={16}
      colorName="card"
      borderWidth={1}
      borderName="border"
      row
      gap={12}
      style={{ padding: 14 }}
    >
      <AppView center rounded={12} style={{ width: 40, height: 40, backgroundColor: colors.bg, flexShrink: 0 }}>
        <Icon size={20} strokeWidth={2} color={colors.fg} />
      </AppView>
      <AppView gap={3} style={{ flex: 1, minWidth: 0 }}>
        <AppView row align="center" gap={8}>
          <AppText family="accent" weight="bold" style={{ fontSize: 15, lineHeight: 20, color: tokens.text, flex: 1 }}>
            {title}
          </AppText>
          <AppText family="mono" weight="bold" style={{ fontSize: 12, color: tokens.textMuted, flexShrink: 0 }}>
            {orderNo}
          </AppText>
        </AppView>
        <AppText family="default" style={{ fontSize: 13, lineHeight: 18, color: tokens.textMuted }}>
          {body}
        </AppText>
        {stage === 'awaiting_payment' ? <PaymentDeadline tokens={tokens} row={row} /> : null}
        {stage === 'ready_for_pickup' ? <PickupAddress tokens={tokens} orderId={row.id} /> : null}
      </AppView>
      <AppView justify="center" style={{ flexShrink: 0 }}>
        <ChevronRight size={18} strokeWidth={2} color={tokens.textMuted} />
      </AppView>
    </AppPressableView>
  );
}

/** Time left before the backend expires the unpaid online order. Display only. */
function PaymentDeadline({ tokens, row }: { tokens: Tokens; row: OrderListRow }) {
  const { t } = useTranslation();
  const { remainingMs, expired } = useOrderCancelWindow(row);
  if (remainingMs === null) return null;
  const time = formatCountdown(remainingMs);
  return (
    <AppView testID="order-status-deadline" row align="center" gap={6} style={{ marginTop: 2 }}>
      <Timer size={13} strokeWidth={2.2} color={tokens.warning} />
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

/** Where to collect it: each dealer's name and address, as the order's detail states them. */
function PickupAddress({ tokens, orderId }: { tokens: Tokens; orderId: string }) {
  const { order } = useOrder(orderId);
  const points = (order?.pickupPoints ?? []).filter((point) => point.address || point.dealerName);
  if (points.length === 0) return null;
  return (
    <AppView gap={4} style={{ marginTop: 4 }}>
      {points.map((point, index) => (
        <AppView key={point.dealerId ?? `place_${index}`} testID="order-status-pickup" row gap={6}>
          <MapPin size={14} strokeWidth={2} color={tokens.text} style={{ marginTop: 2 }} />
          <AppText family="default" style={{ fontSize: 13, lineHeight: 18, color: tokens.text, flex: 1 }}>
            {[point.dealerName, point.address].filter(Boolean).join(' · ')}
          </AppText>
        </AppView>
      ))}
    </AppView>
  );
}
