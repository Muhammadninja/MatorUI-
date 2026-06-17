import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import type { CartTotals, PromoCode } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';

export type CartSummaryProps = {
  totals: CartTotals;
  appliedPromo: PromoCode | null;
  freeShippingThreshold: number;
  freeShippingRemaining: number;
  formatCurrency: (amount: number) => string;
};

export default function CartSummary({
  totals,
  appliedPromo,
  freeShippingThreshold,
  freeShippingRemaining,
  formatCurrency,
}: CartSummaryProps) {
  const { tokens, scheme } = useThemeContext();
  const shippingLabel = totals.shipping > 0 ? formatCurrency(totals.shipping) : 'Free';
  const showDiscount = totals.discount > 0;

  const progress =
    freeShippingThreshold > 0
      ? Math.min(1, totals.subtotal / freeShippingThreshold)
      : 0;
  const unlocked = freeShippingRemaining <= 0 && totals.subtotal > 0;
  const widthAnim = useRef(new Animated.Value(progress)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: progress,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, widthAnim]);

  return (
    <AppView
      rounded={16}
      px="lg"
      py="lg"
      gap="md"
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
      }}
    >
      <AppText textVariant="subtitle" family="accent">
        Order summary
      </AppText>

      <AppView gap={6}>
        <AppView row align="center" justify="space-between">
          <AppText textVariant="bodyXs" weight="semibold">
            {unlocked ? 'Free shipping unlocked' : 'Free shipping'}
          </AppText>
          <AppText textVariant="bodyXs" colorName="gray400">
            {unlocked ? 'On us' : `Add ${formatCurrency(freeShippingRemaining)} more`}
          </AppText>
        </AppView>
        <AppView
          rounded={36}
          style={{
            height: 4,
            overflow: 'hidden',
            backgroundColor: scheme === 'dark' ? tokens.gray200 : tokens.gray100,
          }}
        >
          <Animated.View
            style={{
              height: '100%',
              width: widthAnim.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
              backgroundColor: unlocked ? tokens.success : tokens.secondary,
              borderRadius: 36,
            }}
          />
        </AppView>
      </AppView>

      <AppView style={{ height: 1, backgroundColor: tokens.divider }} />

      <AppView gap={6}>
        <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
        {showDiscount ? (
          <SummaryRow
            label={`Discount${appliedPromo ? ` (${appliedPromo.code})` : ''}`}
            value={`- ${formatCurrency(totals.discount)}`}
            accentColor={tokens.success}
          />
        ) : null}
        <SummaryRow label="Shipping" value={shippingLabel} />
      </AppView>
    </AppView>
  );
}

function SummaryRow({
  label,
  value,
  accentColor,
}: {
  label: string;
  value: string;
  accentColor?: string;
}) {
  return (
    <AppView row align="center" justify="space-between">
      <AppText textVariant="bodySm" colorName="gray400">
        {label}
      </AppText>
      <AppText textVariant="bodySm" style={accentColor ? { color: accentColor } : undefined}>
        {value}
      </AppText>
    </AppView>
  );
}
