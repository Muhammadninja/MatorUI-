import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { WheelLoader } from '@/components/shared/wheel-loader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import { OrderLinePrice, OrderPriceBreakdown } from '@/components/screens-components/orders/order-price-breakdown';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useOrder } from '@/hooks/use-orders';
import {
  formatOrderNo,
  ORDER_STATUS_LABEL_I18N,
  ORDER_STEP_I18N,
} from '@/services/orders-service';
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
                {localizeStatus(order.etaWindow) ||
                  t(ORDER_STEP_I18N[order.status], {
                    defaultValue: localizeStatus(order.statusLabel),
                  })}
              </AppText>
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
                <OrderLinePrice line={order.pricing?.lines[index]} />
              </AppView>
            ))}
            <AppView style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 2 }} />
            <OrderPriceBreakdown pricing={order.pricing} />
          </AppView>

          {/* Timeline */}
          <AppView style={{ paddingLeft: 4 }}>
            {order.steps.map((step, i) => {
              const isLast = i === order.steps.length - 1;
              const done = i <= order.currentStepIndex;
              const active = i === order.currentStepIndex;
              return (
                <AppView
                  key={step.key}
                  row
                  style={{ gap: 14, minHeight: isLast ? 30 : 62 }}
                >
                  {/* Dot + connector column */}
                  <AppView style={{ alignItems: 'center' }}>
                    <AppView
                      center
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        backgroundColor: done ? tokens.brandBg : 'transparent',
                        borderWidth: done ? 0 : 2,
                        borderColor: done ? tokens.brandBg : tokens.border,
                        flexShrink: 0,
                      }}
                    >
                      {done ? (
                        <AppText
                          style={{
                            fontSize: 11,
                            fontWeight: '700',
                            color: tokens.onBrand,
                          }}
                        >
                          ✓
                        </AppText>
                      ) : null}
                    </AppView>
                    {!isLast ? (
                      <AppView
                        style={{
                          flex: 1,
                          width: 2,
                          backgroundColor: done ? tokens.brandBg : tokens.border,
                          marginTop: 2,
                        }}
                      />
                    ) : null}
                  </AppView>

                  {/* Label + sub */}
                  <AppView style={{ paddingBottom: 8 }}>
                    <AppText
                      family="accent"
                      weight={active ? 'bold' : 'semibold'}
                      style={{
                        fontSize: 15,
                        color: done ? tokens.text : tokens.textMuted,
                      }}
                    >
                      {t(ORDER_STEP_I18N[step.key], { defaultValue: step.label })}
                    </AppText>
                    <AppText
                      family="default"
                      style={{ fontSize: 12, color: tokens.textMuted, marginTop: 2 }}
                    >
                      {step.caption}
                    </AppText>
                  </AppView>
                </AppView>
              );
            })}
          </AppView>

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
