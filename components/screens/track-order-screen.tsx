import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Timer } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView } from 'react-native';

import { WheelLoader } from '@/components/shared/wheel-loader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OrderLinePrice, OrderPriceBreakdown } from '@/components/screens-components/orders/order-price-breakdown';
import { OrderTimeline } from '@/components/screens-components/orders/order-timeline';
import { OrderChargeRows } from '@/components/screens-components/checkout/checkout-sections';
import { PickupPoints } from '@/components/screens-components/checkout/pickup-points';
import { AppButton } from '@/components/shared/app-button';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useCancelOrderToCart } from '@/hooks/use-cancel-order';
import { useRecoverPayment } from '@/hooks/use-order-payment';
import { useOrderCancelWindow } from '@/hooks/use-order-cancel-window';
import { useOrder } from '@/hooks/use-orders';
import { useToast } from '@/hooks/use-toast';
import { ApiError } from '@/services/api-client';
import { formatCurrency } from '@/services/cart-math';
import {
  isAwaitingOnlinePayment,
  paymentFailureKey,
} from '@/services/checkout-presentation';
import {
  formatOrderNo,
  ORDER_STATUS_LABEL_I18N,
  ORDER_STEP_I18N,
  type OrderDetail,
  type PickupPoint,
} from '@/services/orders-service';
import { formatCountdown } from '@/services/order-cancel-window';
import {
  isClosedOrder,
  ORDER_STAGE_I18N,
  orderStage,
  orderStageBodyKey,
} from '@/services/order-groups';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Track Order — faithful rebuild of the prototype's `scTrackOrder`, now
 * driven by the real `OrderDetail`. The screen is reached with an `orderId`
 * route param (from confirmation, order-history, or a deep-link);
 * `useOrder(id)` fetches the detail and its `steps` / `currentStepIndex`
 * populate the vertical timeline. The map placeholder + ETA card render the
 * server's `etaWindow` / `statusLabel`.
 */
export default function TrackOrderScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();

  // Localize a service-emitted display string: status words (statusLabel /
  // an overloaded etaWindow like "Delivered") resolve to their translation,
  // while real ETA/date strings — absent from the map — pass through as-is.
  const localizeStatus = (s: string) =>
    s ? t(ORDER_STATUS_LABEL_I18N[s] ?? '\0', { defaultValue: s }) : s;

  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { state, order, refresh } = useOrder(orderId ?? null);
  const recover = useRecoverPayment(orderId, refresh);
  const { remainingMs, expired, canCancel } = useOrderCancelWindow(order);
  const cancel = useCancelOrderToCart(order);
  const toast = useToast();
  const [cancelFailure, setCancelFailure] = useState<string | null>(null);

  const askToCancel = () => {
    Alert.alert(t('trackOrder.cancelConfirmTitle'), t('trackOrder.cancelConfirmBody'), [
      { text: t('trackOrder.cancelKeep'), style: 'cancel' },
      {
        text: t('trackOrder.cancelConfirm'),
        style: 'destructive',
        onPress: () => {
          setCancelFailure(null);
          // Its parts go back into the cart, so calling the order off loses nothing chosen.
          cancel.run().then(
            ({ cancelled, restoredToCart }) => {
              if (cancelled) {
                triggerHaptic('success');
                toast.success(
                  t(restoredToCart ? 'trackOrder.cancelledToCart' : 'trackOrder.cancelled'),
                );
              }
              refresh();
            },
            (err: unknown) => {
              setCancelFailure(
                t(
                  err instanceof ApiError && err.status === 409
                    ? 'trackOrder.cancelRefused'
                    : 'trackOrder.cancelFailed',
                ),
              );
              refresh();
            },
          );
        },
      },
    ]);
  };

  // Pull the latest status every time the screen is focused — navigating here
  // from order history (or returning to a still-mounted track screen) must show
  // the current status immediately, not a cached one that only the 15s poll
  // would eventually correct. `refresh` isn't referentially stable (React Query
  // returns a new result each render), so call it through a ref to keep the
  // focus callback stable and avoid a refetch-on-every-render loop.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useFocusEffect(
    useCallback(() => {
      refreshRef.current();
    }, []),
  );

  const stage = order ? orderStage(stageSource(order)) : null;
  const stageBody = stage && order ? t(orderStageBodyKey(stage, order.deliveryMethod)) : null;
  const pickupPoints = order ? orderPickupPoints(order) : null;

  const goShopping = () => {
    triggerHaptic('selection');
    router.navigate('/explore');
  };

  return (
    <AppView flex={1} colorName="background" testID="track-order-screen">
      <AppSettingsHeader title={t('trackOrder.title')} fallbackHref="/explore" />

      {state === 'loading' || state === 'idle' ? (
        <AppView flex={1} center>
          <WheelLoader size={30} color={tokens.text} />
        </AppView>
      ) : state === 'error' || state === 'not_found' || !order ? (
        <AppView flex={1} center px="xl" gap={12}>
          <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
          <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}>
            {t(state === 'error' ? 'orderConfirmation.loadErrorTitle' : 'trackOrder.notFound')}
          </AppText>
          <AppView row gap={10}>
            {state === 'error' ? <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={refresh} /> : null}
            <AppButton title={t('trackOrder.backToShopping')} kind="brand" size="sm" onPress={goShopping} />
          </AppView>
        </AppView>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom + 24, 40),
            gap: 16,
          }}
        >
          {/* Status card — brand-filled. Big line = ETA when known, else the
              status label (so pending orders read "Awaiting payment" once, on a
              single line). Order # is the short display form. */}
          <AppView
            row
            align="center"
            style={{
              backgroundColor: tokens.brandBg,
              borderRadius: 16,
              padding: 16,
              gap: 12,
            }}
          >
            <AppView style={{ flex: 1 }}>
              <AppText
                family="accent"
                weight="semibold"
                style={{
                  fontSize: 11,
                  color: `${tokens.onBrand}B3`,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                {t('trackOrder.orderStatus')}
              </AppText>
              <AppText
                family="heading"
                weight="bold"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
                style={{ fontSize: 20, color: tokens.onBrand }}
              >
                {stage
                  ? t(ORDER_STAGE_I18N[stage].title)
                  : localizeStatus(order.etaWindow) ||
                    t(ORDER_STEP_I18N[order.status], {
                      defaultValue: localizeStatus(order.statusLabel),
                    })}
              </AppText>
              {stageBody ? (
                <AppText
                  testID="track-order-stage-body"
                  family="default"
                  style={{ fontSize: 12.5, lineHeight: 17, color: `${tokens.onBrand}D9`, marginTop: 2 }}
                >
                  {stageBody}
                </AppText>
              ) : null}
            </AppView>
            <AppView style={{ alignItems: 'flex-end', flexShrink: 0 }}>
              <AppText
                family="accent"
                weight="semibold"
                style={{
                  fontSize: 11,
                  color: `${tokens.onBrand}B3`,
                }}
              >
                {t('trackOrder.order')}
              </AppText>
              <AppText
                family="mono"
                weight="bold"
                numberOfLines={1}
                style={{ fontSize: 14, color: tokens.onBrand }}
              >
                {formatOrderNo(order.id)}
              </AppText>
            </AppView>
          </AppView>

          {/* An order still waiting for online payment can be paid from here, at any time
              until it expires. It is the same order: nothing new is created. */}
          {isAwaitingOnlinePayment(order) ? (
            <AppView gap={8} testID="track-order-pay">
              <AppButton
                testID="track-order-pay-btn"
                title={
                  recover.paying
                    ? t('checkout.payingOrder')
                    : t('trackOrder.payNow', { total: order.totalLabel })
                }
                kind="brand"
                size="lg"
                fullWidth
                disabled={recover.paying}
                onPress={recover.pay}
              />
              {recover.failure ? (
                <AppView row align="center" gap={8}>
                  <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
                  <AppText family="default" style={{ fontSize: 12.5, color: tokens.error, flex: 1 }}>
                    {t(paymentFailureKey(recover.failure))}
                  </AppText>
                </AppView>
              ) : null}
            </AppView>
          ) : null}

          {/* An unpaid online order: time left until the backend's expires_at. Display
              only; at zero the order is re-read, never cancelled from here. */}
          {remainingMs !== null ? (
            <AppView
              testID="track-order-deadline"
              gap={14}
              style={{
                backgroundColor: tokens.card,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 16,
                padding: 16,
              }}
            >
              <AppView row align="center" gap={12}>
                <AppView
                  center
                  rounded={999}
                  style={{ width: 44, height: 44, backgroundColor: tokens.warningSoft, flexShrink: 0 }}
                >
                  <Timer size={22} strokeWidth={2.2} color={tokens.warning} />
                </AppView>
                <AppView flex={1} gap={2}>
                  <AppText family="accent" weight="bold" style={{ fontSize: 15, color: tokens.text }}>
                    {t('trackOrder.autoCancelTitle')}
                  </AppText>
                  <AppText family="default" style={{ fontSize: 12.5, lineHeight: 17, color: tokens.textMuted }}>
                    {expired ? t('trackOrder.autoCancelExpired') : t('trackOrder.autoCancelBody')}
                  </AppText>
                </AppView>
                <AppText
                  testID="track-order-countdown"
                  family="heading"
                  weight="bold"
                  accessibilityLabel={t('trackOrder.autoCancelA11y', { time: formatCountdown(remainingMs) })}
                  style={{ fontSize: 22, color: tokens.warning, fontVariant: ['tabular-nums'], flexShrink: 0 }}
                >
                  {formatCountdown(remainingMs)}
                </AppText>
              </AppView>
            </AppView>
          ) : null}

          {/* An order still waiting (for online payment, or for an operator) can be called
              off. No timer: the backend decides, and refuses with 409 once it cannot. */}
          {canCancel ? (
            <AppView gap={8} testID="track-order-cancel">
              <AppButton
                testID="track-order-cancel-btn"
                title={cancel.isPending ? t('trackOrder.cancelling') : t('trackOrder.cancelOrder')}
                kind="error"
                variant="outline"
                size="md"
                fullWidth
                disabled={cancel.isPending}
                onPress={askToCancel}
              />
            </AppView>
          ) : null}
          {cancelFailure ? (
            <AppView row align="center" gap={8} testID="track-order-cancel-error">
              <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
              <AppText family="default" style={{ fontSize: 12.5, color: tokens.error, flex: 1 }}>
                {cancelFailure}
              </AppText>
            </AppView>
          ) : null}

          {/* A pickup order: where each dealer's goods are collected, as the backend
              recorded them for this order. */}
          {pickupPoints && pickupPoints.length > 0 ? (
            <AppView
              testID="track-order-pickup"
              style={{
                backgroundColor: tokens.card,
                borderWidth: 1,
                borderColor: tokens.border,
                borderRadius: 16,
                padding: 16,
              }}
            >
              <PickupPoints tokens={tokens} state="success" points={pickupPoints} onRetry={refresh} />
            </AppView>
          ) : null}

          {/* Order items — real line data (no placeholder imagery). */}
          <AppView
            style={{
              backgroundColor: tokens.card,
              borderWidth: 1,
              borderColor: tokens.border,
              borderRadius: 16,
              padding: 16,
              gap: 10,
            }}
          >
            <AppText
              family="accent"
              weight="semibold"
              style={{ fontSize: 11, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.6 }}
            >
              {t('trackOrder.items')}
            </AppText>
            {order.items.map((line, index) => (
              <AppView key={line.id} row justify="space-between" style={{ gap: 12 }}>
                <AppText
                  family="default"
                  style={{ fontSize: 14, color: tokens.textMuted, flex: 1 }}
                >
                  {line.title}{line.quantity > 0 ? ` × ${line.quantity}` : ''}
                </AppText>
                {order.pricing ? (
                  <OrderLinePrice line={order.pricing.lines[index]} />
                ) : (
                  <AppText family="accent" weight="semibold" style={{ fontSize: 14, color: tokens.text }}>
                    {line.price}
                  </AppText>
                )}
              </AppView>
            ))}
            <AppView style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 2 }} />
            {/* Confirmed amounts, without substituting units for line totals. */}
            {order.pricing ? (
              <OrderPriceBreakdown
                pricing={order.pricing}
                hideZeroServiceFee
                deliveryLabel={t('checkout.deliveryPriceLabel')}
              />
            ) : (
              <>
                {order.charges ? (
                  <>
                    <OrderChargeRows tokens={tokens} charges={order.charges} formatCurrency={formatCurrency} />
                    <AppView style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 2 }} />
                  </>
                ) : null}
                <AppView row justify="space-between">
                  <AppText family="default" weight="semibold" style={{ fontSize: 14, color: tokens.textMuted }}>
                    {t('trackOrder.total')}
                  </AppText>
                  <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text }}>
                    {order.totalLabel}
                  </AppText>
                </AppView>
              </>
            )}
          </AppView>

          {/* Only a delivered order: before that, cancellation applies (above). Opens
              the return conditions and support — no request is created in the app. */}
          {order.serverStatus === 'delivered' ? (
            <AppButton
              testID="track-order-return-btn"
              title={t('trackOrder.returnConditions')}
              kind="secondary"
              variant="outline"
              size="md"
              fullWidth
              onPress={() => {
                triggerHaptic('selection');
                router.push({ pathname: '/return-policy', params: { orderId: order.id } });
              }}
            />
          ) : null}

          <OrderTimeline order={order} />

          {/* Ghost CTA */}
          <AppButton
            title={t('trackOrder.backToShopping')}
            kind="secondary"
            variant="outline"
            size="lg"
            fullWidth
            onPress={goShopping}
          />
        </ScrollView>
      )}
    </AppView>
  );
}

/** A pickup order's points, in the shape the checkout's pickup card reads. None once closed. */
function orderPickupPoints(order: OrderDetail): PickupPoint[] | null {
  if (order.deliveryMethod !== 'pickup' || !order.pickupPoints) return null;
  if (isClosedOrder(stageSource(order))) return null;
  return order.pickupPoints.map((point) => ({
    ...point,
    items: point.items.map((item) => ({
      cartItemId: item.id,
      partId: item.partId,
      title: item.title,
      quantity: item.quantity,
    })),
  }));
}

/** The detail, as the stage rules read it. Its timeline status is not a list pill. */
function stageSource(order: OrderDetail) {
  return {
    serverStatus: order.serverStatus,
    paymentType: order.paymentType,
    deliveryMethod: order.deliveryMethod,
    status: order.status === 'cancelled' ? ('Cancelled' as const) : undefined,
  };
}
