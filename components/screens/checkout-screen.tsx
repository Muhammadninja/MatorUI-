import { router } from 'expo-router';
import {
  Apple,
  ArrowRight,
  ChevronRight,
  CreditCard,
  Lock,
  MapPin,
  ShoppingBag,
  X,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AppBlurView, { useBlurHeaderInset } from '@/components/shared/app-blur-view';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useCartContext } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';
import {
  useAddresses,
  useCreateOrder,
  usePaymentMethods,
  useShippingQuote,
} from '@/hooks/use-orders';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/utils/haptics';

const HEADER_HEIGHT = 56;

export default function CheckoutScreen() {
  const { tokens, scheme } = useThemeContext();
  const toast = useToast();
  const topInset = useBlurHeaderInset(HEADER_HEIGHT);
  const insets = useSafeAreaInsets();
  const { items, itemCount, totals, appliedPromo, formatCurrency, clearCart } = useCartContext();
  const bottomInset = Math.max(insets.bottom, 16);

  // ── Server-driven address / payment / shipping ──────────────────────
  const addresses = useAddresses();
  const paymentMethods = usePaymentMethods();

  // Default to first / default-flagged. UI lets the user "Change" later
  // (the picker sheet is a follow-up; the data is already ready).
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAddressId && addresses.items.length > 0) {
      setSelectedAddressId(addresses.items[0]!.id);
    }
  }, [addresses.items, selectedAddressId]);

  useEffect(() => {
    if (!selectedPaymentId && paymentMethods.items.length > 0) {
      const def = paymentMethods.items.find((p) => p.isDefault) ?? paymentMethods.items[0];
      setSelectedPaymentId(def?.id ?? null);
    }
  }, [paymentMethods.items, selectedPaymentId]);

  const selectedAddress = useMemo(
    () => addresses.items.find((a) => a.id === selectedAddressId) ?? null,
    [addresses.items, selectedAddressId],
  );
  const selectedPayment = useMemo(
    () => paymentMethods.items.find((p) => p.id === selectedPaymentId) ?? null,
    [paymentMethods.items, selectedPaymentId],
  );

  const shippingRequest = useMemo(
    () =>
      selectedAddressId
        ? { addressId: selectedAddressId, subtotal: totals.subtotal }
        : null,
    [selectedAddressId, totals.subtotal],
  );
  const shipping = useShippingQuote(shippingRequest);

  const [selectedShippingKey, setSelectedShippingKey] = useState<string | null>(null);
  useEffect(() => {
    if (shipping.options.length === 0) return;
    // Auto-select first option when quote refreshes; preserve user's pick
    // if it's still present in the new quote.
    if (!selectedShippingKey || !shipping.options.find((o) => o.key === selectedShippingKey)) {
      setSelectedShippingKey(shipping.options[0]!.key);
    }
  }, [shipping.options, selectedShippingKey]);

  const selectedShipping = useMemo(
    () => shipping.options.find((o) => o.key === selectedShippingKey) ?? null,
    [shipping.options, selectedShippingKey],
  );

  const [note, setNote] = useState('');
  const { phase, error, placeOrder } = useCreateOrder();
  // Synchronous in-flight latch: blocks a second tap in the same tick before
  // any async work, since `phase` only reflects isPending on the next render.
  const placingRef = useRef(false);

  const deliveryFee = selectedShipping?.price ?? 0;
  const grandTotal = totals.total + deliveryFee;

  const canPlaceOrder =
    items.length > 0 &&
    !!selectedAddress &&
    !!selectedPayment &&
    !!selectedShipping &&
    phase !== 'placing';

  const handleClose = () => {
    triggerHaptic('selection');
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/cart');
    }
  };

  const handlePlaceOrder = async () => {
    // Authoritative guard: reject a second synchronous tap before any await.
    if (placingRef.current) return;
    if (!canPlaceOrder || !selectedAddress || !selectedPayment || !selectedShipping) return;
    placingRef.current = true;
    triggerHaptic('selection');
    try {
      const result = await placeOrder({
        items: items.map((i) => ({ productId: i.id, quantity: i.quantity })),
        addressId: selectedAddress.id,
        paymentMethodId: selectedPayment.id,
        shippingOptionKey: selectedShipping.key,
        promoCode: appliedPromo?.code ?? null,
        note: note.trim() || undefined,
      });
      if (!result) {
        triggerHaptic('error');
        toast.danger('Could not place order', { description: error ?? 'Try again.' });
        return;
      }
      triggerHaptic('success');
      clearCart();
      // Replace (not push) so the order can't be re-placed by tapping back —
      // back stack becomes [cart, order-confirmation] and Close/swipe-down
      // from the confirmation lands on cart directly.
      router.replace(
        `/order-confirmation?orderId=${encodeURIComponent(result.orderId)}&eta=${encodeURIComponent(result.eta)}`,
      );
    } finally {
      // Release the latch so a failed order can be retried.
      placingRef.current = false;
    }
  };

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
          <AppView row gap="sm">
            <ExpressButton
              label="Apple Pay"
              Icon={Apple}
              onPress={() => toast.info('Apple Pay placeholder')}
            />
            <ExpressButton
              label="Google Pay"
              Icon={CreditCard}
              onPress={() => toast.info('Google Pay placeholder')}
            />
            <ExpressButton
              label="Shop Pay"
              Icon={ShoppingBag}
              onPress={() => toast.info('Shop Pay placeholder')}
            />
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
          onChange={
            addresses.items.length > 1
              ? () => toast.info('Address picker', { description: 'Multi-address picker coming next.' })
              : undefined
          }
        >
          {addresses.state === 'loading' ? (
            <RowLoading />
          ) : selectedAddress ? (
            <AppView row align="center" gap="md">
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
                <AppText textVariant="bodySemibold">{selectedAddress.label}</AppText>
                <AppText textVariant="bodyXs" colorName="gray400">
                  {selectedAddress.line1} · {selectedAddress.city}
                </AppText>
              </AppView>
            </AppView>
          ) : (
            <AppText textVariant="bodyXs" colorName="gray400">
              No address on file. Add one in Profile → Shipping Addresses.
            </AppText>
          )}
        </Section>

        {/* Delivery speed — driven by the shipping quote */}
        <Section title="Delivery speed">
          {shipping.state === 'loading' && shipping.options.length === 0 ? (
            <RowLoading />
          ) : shipping.state === 'error' ? (
            <AppText textVariant="bodyXs" colorName="gray400">
              {shipping.error ?? 'Could not load shipping options.'}
            </AppText>
          ) : shipping.options.length === 0 ? (
            <AppText textVariant="bodyXs" colorName="gray400">
              No shipping options for this address.
            </AppText>
          ) : (
            <AppView gap="sm">
              {shipping.options.map((opt) => {
                const selected = opt.key === selectedShippingKey;
                return (
                  <AppPressableView
                    key={opt.key}
                    onPress={() => {
                      triggerHaptic('selection');
                      setSelectedShippingKey(opt.key);
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
                    <AppView row align="center" gap="md" px="md" py="md">
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
          )}
        </Section>

        {/* Payment */}
        <Section
          title="Payment"
          onChange={
            paymentMethods.items.length > 1
              ? () => toast.info('Payment picker', { description: 'Multi-card picker coming next.' })
              : undefined
          }
        >
          {paymentMethods.state === 'loading' ? (
            <RowLoading />
          ) : selectedPayment ? (
            <AppView row align="center" gap="md">
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
                  {selectedPayment.brand} •••• {selectedPayment.last4}
                </AppText>
                <AppText textVariant="bodyXs" colorName="gray400">
                  Exp {selectedPayment.exp}
                </AppText>
              </AppView>
            </AppView>
          ) : (
            <AppText textVariant="bodyXs" colorName="gray400">
              No saved payment methods. Add one in Profile → Payment.
            </AppText>
          )}
        </Section>

        {/* Items review */}
        <Section title={`Order items · ${itemCount}`}>
          <AppView gap="sm">
            {items.map((item) => (
              <AppView key={item.id} row align="center" gap="md">
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
            px="md"
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
          px="lg"
          py="lg"
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
        <AppView row align="center" justify="space-between" px="lg" pt="sm" pb="md">
          <Pressable
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close checkout"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={({ pressed }) => ({
              width: 36,
              height: 36,
              borderRadius: 36,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <X size={18} strokeWidth={2.2} color={tokens.text} />
          </Pressable>
          <AppText textVariant="bodySm" weight="semibold">
            Checkout
          </AppText>
          <AppView style={{ width: 36 }} />
        </AppView>
      </AppBlurView>

      {/* Sticky bottom CTA */}
      <AppView
        px="lg"
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
        <AppView row align="center" justify="space-between" gap="md">
          <AppView gap={2} style={{ flex: 1 }}>
            <AppText textVariant="bodyXs" colorName="gray400">
              Total
            </AppText>
            <AppText textVariant="h4" family="heading" weight="bold">
              {formatCurrency(grandTotal)}
            </AppText>
          </AppView>
          <AppPressableView
            onPress={handlePlaceOrder}
            disabled={!canPlaceOrder}
            androidRipple
            accessibilityLabel="Place order"
            style={{
              borderRadius: 36,
              paddingHorizontal: 20,
              paddingVertical: 14,
              backgroundColor: tokens.brandBg,
              opacity: canPlaceOrder ? 1 : 0.5,
              minWidth: 160,
            }}
          >
            <AppView row align="center" justify="center" gap="sm">
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

function RowLoading() {
  const { tokens } = useThemeContext();
  return (
    <AppView row align="center" gap={10}>
      <ActivityIndicator color={tokens.gray400} size="small" />
      <AppText textVariant="bodyXs" colorName="gray400">
        Loading…
      </AppText>
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
      px="lg"
      py="lg"
      gap="md"
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
            <AppView row align="center" gap="xs">
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
  Icon,
  onPress,
}: {
  label: string;
  Icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  onPress: () => void;
}) {
  const { tokens } = useThemeContext();
  return (
    <Pressable
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        flex: 1,
        borderRadius: 14,
        paddingVertical: 14,
        backgroundColor: tokens.text,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Icon size={15} strokeWidth={2.2} color={tokens.background} />
      <AppText weight="bold" style={{ color: tokens.background, fontSize: 13 }}>
        {label}
      </AppText>
    </Pressable>
  );
}

