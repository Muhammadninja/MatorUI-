import { router, useLocalSearchParams } from 'expo-router';
import { Check, Truck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { triggerHaptic } from '@/utils/haptics';

export default function OrderConfirmationScreen() {
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ orderId?: string; eta?: string }>();

  const orderId = typeof params.orderId === 'string' ? params.orderId : '';
  const eta = typeof params.eta === 'string' ? params.eta : '';

  const goToCart = () => {
    triggerHaptic('selection');
    // Checkout was replaced when the order was placed, so back/dismissTo
    // both land on cart cleanly. dismissTo also covers the deep-link case
    // where the confirmation was opened without cart in history.
    router.dismissTo('/cart');
  };

  const viewOrderDetails = () => {
    triggerHaptic('selection');
    // Replace the confirmation with track-order so Back from track-order
    // lands on cart — the confirmation is a transient success state and
    // shouldn't be revisited.
    const href = orderId
      ? `/track-order?orderId=${encodeURIComponent(orderId)}`
      : '/track-order';
    router.replace(href as never);
  };

  return (
    <AppView flex={1} colorName="background">
      <AppView flex={1} px={20} pt={Math.max(insets.top + 24, 48)}>
        <AppView align="center" gap={20}>
          {/* Concentric rings — outer halo + brand-tinted ring + solid puck —
           *  give the success moment a tactile centerpiece instead of a flat
           *  green disc. */}
          <AppView
            center
            rounded={999}
            style={{
              width: 120,
              height: 120,
              backgroundColor: `${tokens.success}14`,
            }}
          >
            <AppView
              center
              rounded={999}
              style={{
                width: 96,
                height: 96,
                backgroundColor: `${tokens.success}24`,
              }}
            >
              <AppView
                center
                rounded={999}
                style={{
                  width: 72,
                  height: 72,
                  backgroundColor: tokens.success,
                }}
              >
                <Check size={36} strokeWidth={3} color={tokens.white} />
              </AppView>
            </AppView>
          </AppView>
          <AppView align="center" gap={6}>
            <AppText textVariant="title" family="heading" weight="bold">
              Thanks for your order
            </AppText>
            <AppText
              textVariant="bodySm"
              colorName="gray400"
              style={{ textAlign: 'center' }}
            >
              We sent a confirmation to your email. You can follow it on the way.
            </AppText>
          </AppView>

          {orderId || eta ? (
            <AppView
              rounded={16}
              px={20}
              py={20}
              gap={14}
              style={{
                alignSelf: 'stretch',
                borderWidth: 1,
                borderColor: tokens.border,
                backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
              }}
            >
              {orderId ? (
                <AppView row align="center" justify="space-between">
                  <AppText textVariant="bodyXs" colorName="gray400">
                    Order number
                  </AppText>
                  <AppText textVariant="bodySm" weight="semibold">
                    #{orderId}
                  </AppText>
                </AppView>
              ) : null}
              {eta ? (
                <AppView row align="center" justify="space-between">
                  <AppText textVariant="bodyXs" colorName="gray400">
                    Estimated arrival
                  </AppText>
                  <AppText textVariant="bodySm" weight="semibold">
                    {eta}
                  </AppText>
                </AppView>
              ) : null}
            </AppView>
          ) : null}
        </AppView>

        <AppView style={{ flex: 1 }} />

        <AppView gap={10} style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
          <AppPressableView
            onPress={viewOrderDetails}
            androidRipple
            style={{
              borderRadius: 36,
              paddingVertical: 16,
              backgroundColor: tokens.brandBg,
            }}
          >
            <AppView row align="center" justify="center" gap={8}>
              <Truck size={18} strokeWidth={2.4} color={tokens.onBrand} />
              <AppText weight="bold" style={{ color: tokens.onBrand }}>
                View order details
              </AppText>
            </AppView>
          </AppPressableView>
          <AppButton
            title="Close"
            kind="secondary"
            variant="outline"
            size="md"
            fullWidth
            onPress={goToCart}
          />
        </AppView>
      </AppView>
    </AppView>
  );
}
