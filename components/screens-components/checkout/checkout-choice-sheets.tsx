import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';

import {
  CheckoutSheet,
  OrderItemRows,
} from '@/components/screens-components/checkout/checkout-review';
import {
  DeliveryOptionsCard,
  DeliverySection,
  PaymentRow,
  SummaryRow,
} from '@/components/screens-components/checkout/checkout-sections';
import { PickupPoints } from '@/components/screens-components/checkout/pickup-points';
import { PAYMENT_OPTIONS } from '@/constants/payment-options';
import { useThemeContext } from '@/contexts/theme.context';
import type { CartItem } from '@/contexts/cart.context';
import type { usePickupPoints } from '@/hooks/use-pickup-points';
import { parsePrice } from '@/services/cart-math';
import {
  formatAddressLine,
  quoteErrorKey,
  type CheckoutDelivery,
  type CourierOffer,
  type DeliveryMethod,
} from '@/services/checkout-presentation';
import type { Address, PaymentType } from '@/services/orders-service';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];
type Pickup = ReturnType<typeof usePickupPoints>;

export type CheckoutSheetName = 'delivery' | 'address' | 'payment' | 'items';

type ReviewText = {
  value: string;
  detail?: string | null;
  missing?: boolean;
  error?: boolean;
};

/**
 * What the Доставка and Адрес rows say, from the checkout's own state. A courier needs an
 * address first; pickup shows where the order is collected instead of an address.
 */
export function reviewSummaries({
  t,
  formatCurrency,
  addr,
  addressSkipped,
  delivery,
  courier,
  pickup,
  onOpen,
}: {
  t: TFunction;
  formatCurrency: (amount: number) => string;
  addr: Address | null;
  addressSkipped: boolean;
  delivery: CheckoutDelivery;
  courier: CourierOffer | null;
  pickup: Pickup;
  onOpen: (sheet: CheckoutSheetName) => void;
}): {
  deliveryReview: ReviewText;
  addressReview: ReviewText & { label: string; onPress: () => void };
} {
  const pickupChosen = delivery.method === 'pickup';
  const deliveryReview: ReviewText =
    !addr && !addressSkipped
      ? { value: t('checkout.reviewChooseAddress'), missing: true }
      : pickupChosen
        ? { value: t('checkout.pickup'), detail: t('checkout.free') }
        : courier?.state === 'priced'
          ? {
              value: t('checkout.courierMator'),
              detail: courier.price > 0 ? formatCurrency(courier.price) : t('checkout.free'),
            }
          : courier?.state === 'refused'
            ? { value: t('checkout.courierMator'), detail: t(quoteErrorKey(courier.code)), error: true }
            : { value: t('checkout.courierMator'), detail: t('checkout.deliveryCalculating') };

  if (!pickupChosen) {
    return {
      deliveryReview,
      addressReview: {
        label: t('checkout.reviewAddress'),
        value: addr ? addr.label : t('checkout.reviewChooseAddress'),
        detail: addr ? formatAddressLine(addr) || null : null,
        missing: !addr,
        onPress: () => onOpen('address'),
      },
    };
  }

  const first = pickup.points[0];
  const ready = pickup.state === 'success' && first;
  const more = pickup.points.length > 1 ? t('checkout.reviewPickupMore', { count: pickup.points.length - 1 }) : null;
  return {
    deliveryReview,
    addressReview: {
      label: t('checkout.reviewPickupPoint'),
      value: ready
        ? first.dealerName ?? first.address ?? t('checkout.reviewPickupPoint')
        : pickup.state === 'error'
          ? t('checkout.pickupPointsError')
          : t('checkout.pickupPointsLoading'),
      detail: ready ? [first.dealerName ? first.address : null, more].filter(Boolean).join(' · ') || null : null,
      error: pickup.state === 'error',
      // Where to collect is shown with the pickup choice itself.
      onPress: () => onOpen('delivery'),
    },
  };
}

/**
 * The checkout's choice sheets: delivery (with the pickup points), address, payment and the
 * order's lines. Each holds the existing choice components, so eligibility, pricing and
 * validation are exactly what they were; only one is open at a time.
 */
export function CheckoutChoiceSheets({
  open,
  onClose,
  tokens,
  addr,
  addressSkipped,
  canChangeAddress,
  onCycleAddress,
  onAddAddress,
  onEditAddress,
  onSkipAddress,
  delivery,
  courier,
  onChooseMethod,
  onRetryQuote,
  pickup,
  paymentType,
  onChoosePayment,
  items,
  productsSubtotal,
  formatCurrency,
}: {
  open: CheckoutSheetName | null;
  onClose: () => void;
  tokens: Tokens;
  addr: Address | null;
  addressSkipped: boolean;
  canChangeAddress: boolean;
  onCycleAddress: () => void;
  onAddAddress: () => void;
  onEditAddress: () => void;
  onSkipAddress: () => void;
  delivery: CheckoutDelivery;
  courier: CourierOffer | null;
  onChooseMethod: (method: DeliveryMethod) => void;
  onRetryQuote: () => void;
  pickup: Pickup;
  paymentType: PaymentType;
  onChoosePayment: (type: PaymentType) => void;
  items: CartItem[];
  productsSubtotal: number;
  formatCurrency: (amount: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <CheckoutSheet testID="checkout-sheet-delivery" visible={open === 'delivery'} onClose={onClose} title={t('checkout.shipping')}>
        {addr || addressSkipped ? (
          <DeliveryOptionsCard
            bare
            tokens={tokens}
            delivery={delivery}
            courier={courier}
            onChooseMethod={onChooseMethod}
            onRetry={onRetryQuote}
            onEditAddress={onEditAddress}
            formatCurrency={formatCurrency}
            pickupDetails={
              <PickupPoints tokens={tokens} state={pickup.state} points={pickup.points} onRetry={pickup.refresh} />
            }
          />
        ) : null}
      </CheckoutSheet>

      <CheckoutSheet testID="checkout-sheet-address" visible={open === 'address'} onClose={onClose} title={t('checkout.deliveryAddress')}>
        {/* Skipping the address means collecting the order. */}
        <DeliverySection
          bare
          tokens={tokens}
          addr={addr}
          skipped={addressSkipped}
          canChange={canChangeAddress}
          onChange={onCycleAddress}
          onAdd={onAddAddress}
          onSkip={onSkipAddress}
        />
      </CheckoutSheet>

      <CheckoutSheet testID="checkout-sheet-payment" visible={open === 'payment'} onClose={onClose} title={t('checkout.payment')}>
        {PAYMENT_OPTIONS.map((opt) => (
          <PaymentRow
            key={opt.id}
            option={opt}
            selected={paymentType === opt.id}
            onPress={() => onChoosePayment(opt.id)}
            tokens={tokens}
          />
        ))}
      </CheckoutSheet>

      <CheckoutSheet
        testID="checkout-sheet-items"
        visible={open === 'items'}
        onClose={onClose}
        title={t('checkout.reviewItems')}
        heightFraction={0.85}
        footer={
          <SummaryRow
            testID="checkout-items-subtotal"
            label={t('checkout.subtotal')}
            value={formatCurrency(productsSubtotal)}
            tokens={tokens}
          />
        }
      >
        <OrderItemRows
          tokens={tokens}
          lines={items.map((item) => ({
            id: item.id,
            title: item.title,
            quantity: item.quantity,
            total: formatCurrency(parsePrice(item.price) * item.quantity),
          }))}
        />
      </CheckoutSheet>
    </>
  );
}
