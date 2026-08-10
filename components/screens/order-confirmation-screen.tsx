import { router, useLocalSearchParams } from 'expo-router';
import { AlertCircle, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView } from 'react-native';

import { WheelLoader } from '@/components/shared/wheel-loader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useOrder } from '@/hooks/use-orders';
import { formatOrderNo } from '@/services/orders-service';
import { triggerHaptic } from '@/utils/haptics';

/**
 * Order Confirmation — faithful rebuild of the prototype's `scOrderConfirm`,
 * now reading the freshly-created order from the orders layer. Checkout
 * navigates here with an `orderId` route param; `useOrder(id)` fetches the
 * `OrderDetail`, whose `totalLabel` + line items populate the receipt.
 */
export default function OrderConfirmationScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();

  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const { state, order, error, refresh } = useOrder(orderId ?? null);

  const goTrackOrder = () => {
    triggerHaptic('selection');
    router.push({ pathname: '/track-order', params: orderId ? { orderId } : {} });
  };

  const goShopping = () => {
    triggerHaptic('selection');
    // This screen lives on the Cart tab's stack ([cart → checkout → here]).
    // Pop the whole checkout flow back to the cart root FIRST, so returning to
    // the Cart tab shows the (now-empty) cart, not this receipt. Then jump to
    // Explore with `navigate` (not `push`) so we land on the existing Explore
    // root instead of stacking a duplicate.
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/explore');
  };

  if (state === 'loading' || state === 'idle') {
    return (
      <AppView flex={1} colorName="background" center>
        <WheelLoader size={30} color={tokens.text} />
      </AppView>
    );
  }

  if (state === 'error' || state === 'not_found' || !order) {
    return (
      <AppView flex={1} colorName="background" center px="xl" gap={12}>
        <AlertCircle size={32} strokeWidth={2} color={tokens.error} />
        <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
          {t('orderConfirmation.loadErrorTitle')}
        </AppText>
        <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}>
          {error ?? t('orderConfirmation.notFound')}
        </AppText>
        <AppView row gap={10}>
          <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={refresh} />
          <AppButton title={t('orderConfirmation.continueShopping')} kind="brand" size="sm" onPress={goShopping} />
        </AppView>
      </AppView>
    );
  }

  return (
    <AppView flex={1} colorName="background" testID="order-confirmation-screen">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 40,
          paddingBottom: 28,
          paddingHorizontal: 24,
          alignItems: 'center',
        }}
      >
        {/* 88px success circle + check */}
        <AppView
          center
          rounded={999}
          style={{ width: 88, height: 88, backgroundColor: tokens.success }}
        >
          <Check size={46} strokeWidth={2.5} color={tokens.white} />
        </AppView>

        {/* Heading */}
        <AppText
          family="heading"
          weight="bold"
          style={{ fontSize: 26, lineHeight: 32, color: tokens.text, marginTop: 22, textAlign: 'center' }}
        >
          {t('orderConfirmation.orderPlaced')}
        </AppText>

        {/* Sub-copy */}
        <AppText
          family="default"
          style={{
            fontSize: 14,
            color: tokens.textMuted,
            marginTop: 8,
            maxWidth: 260,
            lineHeight: 21,
            textAlign: 'center',
          }}
        >
          {t('orderConfirmation.subtitle')}
        </AppText>

        {/* Receipt card */}
        <AppView
          style={{
            width: '100%',
            backgroundColor: tokens.card,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: 16,
            padding: 18,
            marginTop: 24,
          }}
        >
          {/* Order number + Total row */}
          <AppView row justify="space-between" align="flex-start" style={{ marginBottom: 12, gap: 12 }}>
            <AppView style={{ flexShrink: 1 }}>
              <AppText
                family="accent"
                weight="semibold"
                style={{
                  fontSize: 11,
                  color: tokens.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                {t('orderConfirmation.orderNumber')}
              </AppText>
              <AppText
                family="mono"
                weight="bold"
                numberOfLines={1}
                style={{ fontSize: 16, color: tokens.text }}
              >
                {formatOrderNo(order.id)}
              </AppText>
            </AppView>
            <AppView style={{ alignItems: 'flex-end', flexShrink: 0 }}>
              <AppText
                family="accent"
                weight="semibold"
                style={{
                  fontSize: 11,
                  color: tokens.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                }}
              >
                {t('orderConfirmation.total')}
              </AppText>
              <AppPrice value={order.totalLabel} size={16} color={tokens.text} />
            </AppView>
          </AppView>

          {/* Divider */}
          <AppView
            style={{ height: 1, backgroundColor: tokens.divider, marginBottom: 12 }}
          />

          {/* Line items */}
          {order.items.map((line) => (
            <AppView
              key={line.id}
              row
              justify="space-between"
              style={{ marginBottom: 6 }}
            >
              <AppText
                family="default"
                style={{ fontSize: 13, color: tokens.textMuted, flex: 1 }}
                numberOfLines={1}
              >
                {line.title} × {line.quantity}
              </AppText>
              <AppText
                family="accent"
                weight="semibold"
                style={{ fontSize: 13, color: tokens.text }}
              >
                {line.price}
              </AppText>
            </AppView>
          ))}
        </AppView>

        {/* Buttons */}
        <AppView style={{ width: '100%', gap: 12, marginTop: 24 }}>
          <AppButton
            testID="confirmation-track-btn"
            title={t('orderConfirmation.trackOrder')}
            kind="brand"
            size="lg"
            fullWidth
            onPress={goTrackOrder}
          />
          <AppButton
            title={t('orderConfirmation.continueShopping')}
            kind="secondary"
            variant="outline"
            size="lg"
            fullWidth
            onPress={goShopping}
          />
        </AppView>
      </ScrollView>
    </AppView>
  );
}
