import { router } from 'expo-router';
import {
  ArrowRight,
  Check,
  ChevronRight,
  CreditCard,
  Lock,
  MapPin,
  Truck,
  X,
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppButton } from '@/components/shared/app-button';
import AppBlurView, { useBlurHeaderInset } from '@/components/shared/app-blur-view';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/utils/haptics';

const HEADER_HEIGHT = 56;

type DeliveryKey = 'standard' | 'express' | 'same_day';
type Phase = 'idle' | 'placing' | 'success';

const DELIVERY_OPTIONS: { key: DeliveryKey; label: string; eta: string; price: number }[] = [
  { key: 'standard', label: 'Standard', eta: '3–5 business days', price: 0 },
  { key: 'express', label: 'Express', eta: '1–2 business days', price: 9.99 },
  { key: 'same_day', label: 'Same day', eta: 'By 9 PM today', price: 19.99 },
];

const MOCK_ADDRESS = {
  label: 'Home',
  line1: '128 Marrakesh Rd, Suite 4',
  city: 'Brooklyn, NY 11211',
};

const MOCK_CARD = {
  brand: 'Mastercard',
  last4: '4242',
  exp: '09/27',
};

export default function CheckoutScreen() {
  const { tokens, scheme } = useThemeContext();
  const toast = useToast();
  const topInset = useBlurHeaderInset(HEADER_HEIGHT);
  const insets = useSafeAreaInsets();
  const { items, itemCount, totals, formatCurrency, clearCart } = useCartContext();
  const bottomInset = Math.max(insets.bottom, 16);

  const [delivery, setDelivery] = useState<DeliveryKey>('standard');
  const [note, setNote] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [orderId, setOrderId] = useState<string | null>(null);

  const deliveryFee = DELIVERY_OPTIONS.find((d) => d.key === delivery)?.price ?? 0;
  const grandTotal = totals.total + deliveryFee;
  const orderEta = DELIVERY_OPTIONS.find((d) => d.key === delivery)?.eta ?? '';

  const placeOrder = () => {
    if (phase !== 'idle') return;
    triggerHaptic('selection');
    setPhase('placing');
    setTimeout(() => {
      const id = `M-${Math.floor(40000 + Math.random() * 60000)}`;
      setOrderId(id);
      setPhase('success');
      triggerHaptic('success');
      clearCart();
    }, 1400);
  };

  if (phase === 'success' && orderId) {
    return <SuccessView orderId={orderId} eta={orderEta} />;
  }

  return (
    <AppView flex={1} colorName="background">
      <AppScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          paddingTop: topInset + 8,
          paddingHorizontal: 16,
          paddingBottom: 140 + bottomInset,
          gap: 16,
        }}
      >
        {/* Express checkout strip */}
        <AppView gap={10}>
          <AppText textVariant="bodyXs" colorName="gray400" weight="semibold">
            EXPRESS CHECKOUT
          </AppText>
          <AppView row gap={8}>
            <ExpressButton label="Apple Pay" symbol="" onPress={() => toast.info('Apple Pay placeholder')} />
            <ExpressButton label="G Pay" symbol="G" onPress={() => toast.info('Google Pay placeholder')} />
            <ExpressButton label="Shop Pay" symbol="S" onPress={() => toast.info('Shop Pay placeholder')} />
          </AppView>
          <AppView row align="center" gap={10} mt={6}>
            <AppView style={{ flex: 1, height: 1, backgroundColor: tokens.divider }} />
            <AppText textVariant="bodyXs" colorName="gray400">
              or pay below
            </AppText>
            <AppView style={{ flex: 1, height: 1, backgroundColor: tokens.divider }} />
          </AppView>
        </AppView>

        {/* Delivery address */}
        <Section
          title="Deliver to"
          onChange={() => toast.info('Address picker placeholder')}
        >
          <AppView row align="center" gap={12}>
            <AppView
              center
              rounded={36}
              style={{
                width: 36,
                height: 36,
                backgroundColor: scheme === 'dark' ? tokens.gray200 : tokens.gray100,
              }}
            >
              <MapPin size={16} strokeWidth={2.2} color={tokens.text} />
            </AppView>
            <AppView gap={2} style={{ flex: 1 }}>
              <AppText textVariant="bodySemibold">{MOCK_ADDRESS.label}</AppText>
              <AppText textVariant="bodyXs" colorName="gray400">
                {MOCK_ADDRESS.line1} · {MOCK_ADDRESS.city}
              </AppText>
            </AppView>
          </AppView>
        </Section>

        {/* Delivery speed */}
        <Section title="Delivery speed">
          <AppView gap={8}>
            {DELIVERY_OPTIONS.map((opt) => {
              const selected = opt.key === delivery;
              return (
                <AppPressableView
                  key={opt.key}
                  onPress={() => {
                    triggerHaptic('selection');
                    setDelivery(opt.key);
                  }}
                  androidRipple={false}
                  style={{
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: selected ? tokens.text : tokens.border,
                    backgroundColor: selected
                      ? scheme === 'dark'
                        ? tokens.gray200
                        : tokens.gray100
                      : 'transparent',
                  }}
                >
                  <AppView row align="center" gap={12} px={12} py={12}>
                    <AppView
                      center
                      rounded={36}
                      style={{
                        width: 18,
                        height: 18,
                        borderWidth: 2,
                        borderColor: selected ? tokens.text : tokens.gray400,
                        backgroundColor: 'transparent',
                      }}
                    >
                      {selected ? (
                        <AppView
                          rounded={36}
                          style={{ width: 8, height: 8, backgroundColor: tokens.text }}
                        />
                      ) : null}
                    </AppView>
                    <AppView gap={2} style={{ flex: 1 }}>
                      <AppText textVariant="bodySm" weight="semibold">
                        {opt.label}
                      </AppText>
                      <AppText textVariant="bodyXs" colorName="gray400">
                        {opt.eta}
                      </AppText>
                    </AppView>
                    <AppText textVariant="bodySm" weight="semibold">
                      {opt.price === 0 ? 'Free' : formatCurrency(opt.price)}
                    </AppText>
                  </AppView>
                </AppPressableView>
              );
            })}
          </AppView>
        </Section>

        {/* Payment */}
        <Section
          title="Payment"
          onChange={() => toast.info('Payment method picker placeholder')}
        >
          <AppView row align="center" gap={12}>
            <AppView
              center
              rounded={10}
              style={{
                width: 44,
                height: 32,
                backgroundColor: scheme === 'dark' ? tokens.gray200 : tokens.gray100,
              }}
            >
              <CreditCard size={16} strokeWidth={2.2} color={tokens.text} />
            </AppView>
            <AppView gap={2} style={{ flex: 1 }}>
              <AppText textVariant="bodySemibold">
                {MOCK_CARD.brand} •••• {MOCK_CARD.last4}
              </AppText>
              <AppText textVariant="bodyXs" colorName="gray400">
                Exp {MOCK_CARD.exp}
              </AppText>
            </AppView>
          </AppView>
        </Section>

        {/* Items review */}
        <Section title={`Order items · ${itemCount}`}>
          <AppView gap={8}>
            {items.map((item) => (
              <AppView key={item.id} row align="center" gap={12}>
                <AppText textVariant="bodySm" style={{ flex: 1 }} numberOfLines={1}>
                  {item.title}
                </AppText>
                <AppText textVariant="bodyXs" colorName="gray400">
                  × {item.quantity}
                </AppText>
                <AppText textVariant="bodySm" weight="semibold">
                  {item.price}
                </AppText>
              </AppView>
            ))}
          </AppView>
        </Section>

        {/* Note */}
        <Section title="Note for courier (optional)">
          <AppView
            rounded={12}
            px={12}
            style={{
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: tokens.background,
            }}
          >
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Leave at the door, ring twice…"
              placeholderTextColor={tokens.gray400}
              multiline
              style={{
                minHeight: 56,
                color: tokens.text,
                fontSize: 14,
                paddingTop: 10,
                paddingBottom: 10,
                textAlignVertical: 'top',
              }}
            />
          </AppView>
        </Section>

        {/* Summary */}
        <AppView
          rounded={24}
          px={16}
          py={16}
          gap={10}
          style={{
            borderWidth: 1,
            borderColor: tokens.border,
            backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
          }}
        >
          <AppText textVariant="subtitle" family="accent">
            Summary
          </AppText>
          <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
          {totals.discount > 0 ? (
            <SummaryRow
              label="Discount"
              value={`- ${formatCurrency(totals.discount)}`}
              accentColor={tokens.success}
            />
          ) : null}
          <SummaryRow
            label="Delivery"
            value={deliveryFee === 0 ? 'Free' : formatCurrency(deliveryFee)}
          />
          <AppView style={{ height: 1, backgroundColor: tokens.divider, marginVertical: 4 }} />
          <AppView row align="center" justify="space-between">
            <AppText textVariant="bodySemibold">Total</AppText>
            <AppText textVariant="h4" family="heading" weight="bold">
              {formatCurrency(grandTotal)}
            </AppText>
          </AppView>
        </AppView>

        {/* Trust */}
        <AppView row align="center" justify="center" gap={6} mt={4}>
          <Lock size={12} strokeWidth={2.2} color={tokens.gray400} />
          <AppText textVariant="bodyXs" colorName="gray400">
            Secure checkout · Encrypted end-to-end
          </AppText>
        </AppView>
      </AppScrollView>

      {/* Blur header */}
      <AppBlurView contentHeight={HEADER_HEIGHT}>
        <AppView row align="center" justify="space-between" px={16} pt={8} pb={12}>
          <AppPressableView
            center
            rounded={36}
            onPress={() => router.back()}
            androidRipple
            accessibilityLabel="Close checkout"
            style={{
              width: 36,
              height: 36,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            }}
          >
            <X size={18} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>
          <AppText textVariant="bodySm" weight="semibold">
            Checkout
          </AppText>
          <AppView style={{ width: 36 }} />
        </AppView>
      </AppBlurView>

      {/* Sticky bottom CTA */}
      <AppView
        px={16}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          paddingTop: 14,
          paddingBottom: bottomInset,
          backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
          borderTopWidth: 1,
          borderTopColor: tokens.divider,
        }}
      >
        <AppView row align="center" justify="space-between" gap={12}>
          <AppView gap={2} style={{ flex: 1 }}>
            <AppText textVariant="bodyXs" colorName="gray400">
              Total
            </AppText>
            <AppText textVariant="h4" family="heading" weight="bold">
              {formatCurrency(grandTotal)}
            </AppText>
          </AppView>
          <AppPressableView
            onPress={placeOrder}
            disabled={items.length === 0 || phase === 'placing'}
            androidRipple
            accessibilityLabel="Place order"
            style={{
              borderRadius: 36,
              paddingHorizontal: 20,
              paddingVertical: 14,
              backgroundColor: tokens.brandBg,
              opacity: items.length === 0 ? 0.5 : 1,
              minWidth: 160,
            }}
          >
            <AppView row align="center" justify="center" gap={8}>
              {phase === 'placing' ? (
                <ActivityIndicator size="small" color={tokens.onBrand} />
              ) : (
                <>
                  <AppText weight="bold" style={{ color: tokens.onBrand }}>
                    Place order
                  </AppText>
                  <ArrowRight size={16} strokeWidth={2.4} color={tokens.onBrand} />
                </>
              )}
            </AppView>
          </AppPressableView>
        </AppView>
      </AppView>
    </AppView>
  );
}

function Section({
  title,
  onChange,
  children,
}: {
  title: string;
  onChange?: () => void;
  children: React.ReactNode;
}) {
  const { tokens, scheme } = useThemeContext();
  return (
    <AppView
      rounded={24}
      px={16}
      py={16}
      gap={12}
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
      }}
    >
      <AppView row align="center" justify="space-between">
        <AppText textVariant="bodyXs" colorName="gray400" weight="semibold">
          {title.toUpperCase()}
        </AppText>
        {onChange ? (
          <AppPressableView
            onPress={() => {
              triggerHaptic('selection');
              onChange();
            }}
            androidRipple={false}
          >
            <AppView row align="center" gap={4}>
              <AppText textVariant="bodyXs" weight="semibold">
                Change
              </AppText>
              <ChevronRight size={12} strokeWidth={2.4} color={tokens.text} />
            </AppView>
          </AppPressableView>
        ) : null}
      </AppView>
      {children}
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

function ExpressButton({
  label,
  symbol,
  onPress,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
}) {
  const { tokens } = useThemeContext();
  return (
    <AppPressableView
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      androidRipple
      style={{
        flex: 1,
        borderRadius: 14,
        paddingVertical: 14,
        backgroundColor: tokens.text,
      }}
    >
      <AppView row align="center" justify="center" gap={6}>
        <AppText weight="bold" style={{ color: tokens.background, fontSize: 14 }}>
          {symbol || ''} {label}
        </AppText>
      </AppView>
    </AppPressableView>
  );
}

function SuccessView({ orderId, eta }: { orderId: string; eta: string }) {
  const { tokens, scheme } = useThemeContext();
  const insets = useSafeAreaInsets();

  return (
    <AppView flex={1} colorName="background" px={20} pt={80}>
      <AppView align="center" gap={20}>
        <AppView
          center
          rounded={64}
          style={{ width: 80, height: 80, backgroundColor: tokens.success }}
        >
          <Check size={36} strokeWidth={3} color={tokens.white} />
        </AppView>
        <AppView align="center" gap={6}>
          <AppText textVariant="title" family="heading" weight="bold">
            Order placed
          </AppText>
          <AppText textVariant="bodySm" colorName="gray400" style={{ textAlign: 'center' }}>
            We sent a confirmation to your email. You can follow it on the way.
          </AppText>
        </AppView>

        <AppView
          rounded={24}
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
          <AppView row align="center" justify="space-between">
            <AppText textVariant="bodyXs" colorName="gray400">
              Order number
            </AppText>
            <AppText textVariant="bodySm" weight="semibold">
              #{orderId}
            </AppText>
          </AppView>
          <AppView row align="center" justify="space-between">
            <AppText textVariant="bodyXs" colorName="gray400">
              Estimated arrival
            </AppText>
            <AppText textVariant="bodySm" weight="semibold">
              {eta}
            </AppText>
          </AppView>
        </AppView>
      </AppView>

      <AppView style={{ flex: 1 }} />

      <AppView gap={10} style={{ paddingBottom: Math.max(insets.bottom, 24) }}>
        <AppPressableView
          onPress={() => {
            triggerHaptic('selection');
            router.replace('/track-order');
          }}
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
              Track order
            </AppText>
          </AppView>
        </AppPressableView>
        <AppButton
          title="Continue shopping"
          kind="secondary"
          variant="outline"
          size="md"
          fullWidth
          onPress={() => {
            triggerHaptic('selection');
            router.replace('/explore');
          }}
        />
      </AppView>
    </AppView>
  );
}
