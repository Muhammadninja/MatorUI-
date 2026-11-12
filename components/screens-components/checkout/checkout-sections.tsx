import { AlertCircle, Check, MapPin } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import type { PaymentOption } from '@/constants/payment-options';
import { useThemeContext } from '@/contexts/theme.context';
import {
  formatAddressLine,
  paymentFailureKey,
  paymentFailureTitleKey,
  quoteErrorAction,
  quoteErrorKey,
  type CheckoutDelivery,
  type CourierOffer,
  type DeliveryMethod,
  type PaymentFailureReason,
} from '@/services/checkout-presentation';
import { formatOrderNo, type Address } from '@/services/orders-service';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

export function LinkAction({ label, onPress, color }: { label: string; onPress: () => void; color: string }) {
  return (
    <AppPressableView onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
      <AppText family="accent" weight="bold" style={{ fontSize: 13, color }}>{label}</AppText>
    </AppPressableView>
  );
}

export function SectionLabel({ tokens, children }: { tokens: Tokens; children: string }) {
  return (
    <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.textMuted, textTransform: 'uppercase', letterSpacing: 0.7 }}>
      {children}
    </AppText>
  );
}

export function SummaryRow({
  label,
  value,
  tokens,
  testID,
}: {
  label: string;
  value: string;
  tokens: Tokens;
  testID?: string;
}) {
  return (
    <AppView row justify="space-between" testID={testID}>
      <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>{label}</AppText>
      <AppText family="accent" weight="semibold" style={{ fontSize: 14, color: tokens.text }}>{value}</AppText>
    </AppView>
  );
}

/** Shown in place of a figure that is not known yet. Never zero. */
export const NO_PRICE_YET = '—';

// ── What an order charges ──────────────────────────────────────────────
// Each part on its own line, as the backend states it: the parts, a discount, Mator's
// service fee and delivery. The fee has no line when there is none, as a discount has
// none; a fee not known yet reads as such rather than as zero.

export type ChargeFigures = {
  subtotal: number;
  discount: number;
  /** Null while the server has not said. */
  serviceFee: number | null;
  /** Null while no price is known. */
  delivery: number | null;
};

export function OrderChargeRows({
  tokens,
  charges,
  formatCurrency,
}: {
  tokens: Tokens;
  charges: ChargeFigures;
  formatCurrency: (amount: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <>
      <SummaryRow label={t('checkout.subtotal')} value={formatCurrency(charges.subtotal)} tokens={tokens} />
      {charges.discount > 0 ? (
        <SummaryRow label={t('checkout.discount')} value={`−${formatCurrency(charges.discount)}`} tokens={tokens} />
      ) : null}
      {charges.serviceFee !== 0 ? (
        <SummaryRow
          testID="order-service-fee"
          label={t('checkout.serviceFee')}
          value={charges.serviceFee === null ? NO_PRICE_YET : formatCurrency(charges.serviceFee)}
          tokens={tokens}
        />
      ) : null}
      <SummaryRow
        label={t('checkout.deliveryPriceLabel')}
        value={
          charges.delivery === null
            ? NO_PRICE_YET
            : charges.delivery > 0
              ? formatCurrency(charges.delivery)
              : t('checkout.free')
        }
        tokens={tokens}
      />
    </>
  );
}

// ── Delivery address section ───────────────────────────────────────────
// Three shapes: a chosen address (with change/skip), the skipped state
// (the buyer collects), or the empty prompt (add / skip).

export function DeliverySection({
  tokens,
  addr,
  skipped,
  canChange,
  onChange,
  onAdd,
  onSkip,
}: {
  tokens: Tokens;
  addr: Address | null;
  skipped: boolean;
  canChange: boolean;
  onChange: () => void;
  onAdd: () => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const addressLine = addr ? formatAddressLine(addr) : '';
  return (
    <AppView rounded={16} p={16} colorName="card" borderWidth={1} borderName="border" gap={10}>
      <AppView row align="center" justify="space-between">
        <SectionLabel tokens={tokens}>{t('checkout.deliveryAddress')}</SectionLabel>
        {addr && canChange ? (
          <AppPressableView onPress={onChange} accessibilityRole="button" accessibilityLabel={t('checkout.changeAddress')}>
            <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.brandText }}>{t('checkout.change')}</AppText>
          </AppPressableView>
        ) : null}
      </AppView>

      {addr ? (
        <>
          <AppView row align="center" gap={10}>
            <MapPin size={18} strokeWidth={2} color={tokens.text} />
            <AppView flex={1}>
              <AppText family="default" weight="semibold" style={{ fontSize: 15, color: tokens.text }}>{addr.label}</AppText>
              {addressLine ? (
                <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted, marginTop: 2 }}>
                  {addressLine}
                </AppText>
              ) : null}
              {addr.landmark ? (
                <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted, marginTop: 2 }}>
                  {addr.landmark}
                </AppText>
              ) : null}
            </AppView>
          </AppView>
          <AppView row gap={18} style={{ marginTop: 2 }}>
            <LinkAction label={t('checkout.addNew')} onPress={onAdd} color={tokens.brandText} />
            <LinkAction label={t('checkout.skipForNow')} onPress={onSkip} color={tokens.textMuted} />
          </AppView>
        </>
      ) : skipped ? (
        <>
          <AppView row align="center" gap={10}>
            <MapPin size={18} strokeWidth={2} color={tokens.text} />
            <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, flex: 1 }}>
              {t('checkout.noAddressPickup')}
            </AppText>
          </AppView>
          <LinkAction label={t('checkout.addAnAddress')} onPress={onAdd} color={tokens.brandText} />
        </>
      ) : (
        <>
          <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted }}>
            {t('checkout.addAddressOrPickup')}
          </AppText>
          <AppView row gap={10}>
            <AppButton title={t('checkout.addAddress')} kind="secondary" size="sm" onPress={onAdd} />
            {/* variant="ghost" → transparent bg + `tokens.text` label. Without it
                the default solid text-kind button is white-on-white (invisible)
                in dark mode. */}
            <AppButton title={t('checkout.skip')} kind="text" variant="ghost" size="sm" onPress={onSkip} />
          </AppView>
        </>
      )}
    </AppView>
  );
}

// ── Payment row (selectable) ───────────────────────────────────────────

/** A payment method's mark: its provider logo when it has one, else its icon,
 *  centred in a fixed-width column so the labels beside it line up. */
export function PaymentOptionMark({
  option,
  width,
  iconSize,
  color,
}: {
  option: PaymentOption;
  width: number;
  iconSize: number;
  color: string;
}) {
  const Icon = option.icon;
  return (
    <AppView center style={{ width, flexShrink: 0 }}>
      {option.logo ? (
        <Image
          testID={`payment-logo-${option.id}`}
          source={option.logo.source}
          accessibilityIgnoresInvertColors
          resizeMode="contain"
          style={{ width, height: width / option.logo.aspectRatio }}
        />
      ) : (
        <Icon size={iconSize} strokeWidth={2} color={color} />
      )}
    </AppView>
  );
}

/** The round mark a selectable row shows: filled with a tick when chosen. */
function RadioMark({ tokens, selected }: { tokens: Tokens; selected: boolean }) {
  return (
    <AppView
      center
      rounded={999}
      style={{
        width: 22,
        height: 22,
        borderWidth: selected ? 0 : 1.5,
        borderColor: tokens.border,
        backgroundColor: selected ? tokens.brand : 'transparent',
      }}
    >
      {selected ? <Check size={14} strokeWidth={3} color={tokens.onBrand} /> : null}
    </AppView>
  );
}

export function PaymentRow({
  option,
  selected,
  onPress,
  tokens,
}: {
  option: PaymentOption;
  selected: boolean;
  onPress: () => void;
  tokens: Tokens;
}) {
  const { t } = useTranslation();
  return (
    <AppPressableView
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={t(option.labelKey)}
      rounded={16}
      p={14}
      colorName="card"
      borderWidth={1}
      borderName={selected ? undefined : 'border'}
      style={selected ? { borderWidth: 1.5, borderColor: tokens.brand } : undefined}
    >
      <AppView row align="center" gap={12}>
        <PaymentOptionMark option={option} width={48} iconSize={20} color={tokens.text} />
        <AppView flex={1}>
          {/* A provider logo already names the method; the label stays for screen readers. */}
          {option.logo ? null : (
            <AppText family="default" weight="semibold" style={{ fontSize: 15, color: tokens.text }}>{t(option.labelKey)}</AppText>
          )}
          <AppText family="default" style={{ fontSize: 12, color: tokens.textMuted, marginTop: option.logo ? 0 : 1 }}>{t(option.descriptionKey)}</AppText>
        </AppView>
        <RadioMark tokens={tokens} selected={selected} />
      </AppView>
    </AppPressableView>
  );
}

// ── Delivery options card ──────────────────────────────────────────────
// The buyer's choice between pickup and Mator's courier, side by side: pickup is free, and
// the courier shows the backend's price for the chosen address, that it is being worked out,
// or why there is none and what can be done about it. Pickup stays choosable whatever
// happened to the courier.

function DeliveryOptionRow({
  tokens,
  testID,
  title,
  value,
  valueTestID,
  selected,
  onPress,
}: {
  tokens: Tokens;
  testID: string;
  title: string;
  /** The price as shown, or null while there is none to show. */
  value: string | null;
  valueTestID?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <AppPressableView
      testID={testID}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={value && value !== NO_PRICE_YET ? `${title}, ${value}` : title}
      rounded={12}
      p={12}
      borderWidth={1}
      borderName={selected ? undefined : 'border'}
      style={selected ? { borderWidth: 1.5, borderColor: tokens.brand } : undefined}
    >
      <AppView row align="center" gap={12}>
        <AppText family="default" weight="semibold" style={{ fontSize: 15, color: tokens.text, flex: 1 }}>
          {title}
        </AppText>
        {value !== null ? (
          <AppText testID={valueTestID} family="accent" weight="semibold" style={{ fontSize: 14, color: tokens.text }}>
            {value}
          </AppText>
        ) : null}
        <RadioMark tokens={tokens} selected={selected} />
      </AppView>
    </AppPressableView>
  );
}

export function DeliveryOptionsCard({
  tokens,
  delivery,
  courier,
  onChooseMethod,
  onRetry,
  onEditAddress,
  formatCurrency,
  pickupDetails,
}: {
  tokens: Tokens;
  /** What the order would be placed with. */
  delivery: CheckoutDelivery;
  /** What the backend says about the courier, or null with no address: then only pickup. */
  courier: CourierOffer | null;
  onChooseMethod: (method: DeliveryMethod) => void;
  onRetry: () => void;
  onEditAddress: () => void;
  formatCurrency: (amount: number) => string;
  /** Where the order is collected, shown under pickup while pickup is chosen. */
  pickupDetails?: ReactNode;
}) {
  const { t } = useTranslation();
  const pickupChosen = delivery.method === 'pickup';
  const courierPrice =
    courier?.state === 'priced'
      ? courier.price > 0
        ? formatCurrency(courier.price)
        : t('checkout.free')
      : courier?.state === 'refused'
        ? NO_PRICE_YET
        : null;
  const action = courier?.state === 'refused' ? quoteErrorAction(courier.code) : null;
  return (
    <AppView testID="checkout-delivery-card" rounded={16} p={16} colorName="card" borderWidth={1} borderName="border" gap={10}>
      <SectionLabel tokens={tokens}>{t('checkout.shipping')}</SectionLabel>

      <DeliveryOptionRow
        tokens={tokens}
        testID="checkout-delivery-pickup"
        title={t('checkout.pickup')}
        value={t('checkout.free')}
        valueTestID={pickupChosen ? 'checkout-delivery-price' : undefined}
        selected={pickupChosen}
        onPress={() => onChooseMethod('pickup')}
      />
      {pickupChosen ? pickupDetails : null}

      {courier ? (
        <AppView testID="checkout-delivery-courier" gap={8}>
          <DeliveryOptionRow
            tokens={tokens}
            testID="checkout-delivery-courier-option"
            title={t('checkout.courierMator')}
            value={courierPrice}
            valueTestID={!pickupChosen && courier.state === 'priced' ? 'checkout-delivery-price' : undefined}
            selected={!pickupChosen}
            onPress={() => onChooseMethod('courier')}
          />
          {courier.state === 'loading' ? (
            <AppView row align="center" gap={8}>
              <WheelLoader size={18} color={tokens.text} />
              <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, flex: 1 }}>
                {t('checkout.deliveryCalculating')}
              </AppText>
            </AppView>
          ) : courier.state === 'refused' ? (
            <AppView gap={8}>
              <AppView row align="center" gap={8}>
                <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
                <AppText family="default" style={{ fontSize: 13, color: tokens.error, flex: 1 }}>
                  {t(quoteErrorKey(courier.code))}
                </AppText>
              </AppView>
              {action === 'edit_address' ? (
                <LinkAction label={t('checkout.chooseExactAddress')} onPress={onEditAddress} color={tokens.text} />
              ) : action === 'retry' ? (
                <LinkAction label={t('common.retry')} onPress={onRetry} color={tokens.text} />
              ) : null}
            </AppView>
          ) : null}
        </AppView>
      ) : null}
    </AppView>
  );
}

// ── Unpaid order ───────────────────────────────────────────────────────
// Takes the place of the address, payment and delivery choices: those were made when the
// order was placed, and this pays that order. Choosing differently means a new order.

export function PaymentRetryCard({
  tokens,
  orderId,
  failure,
  onViewOrder,
  onStartOver,
}: {
  tokens: Tokens;
  orderId: string;
  failure: PaymentFailureReason | null;
  onViewOrder: () => void;
  onStartOver: () => void;
}) {
  const { t } = useTranslation();
  const reason = failure ?? 'unpaid';
  return (
    <AppView testID="checkout-payment-failed" rounded={16} p={16} colorName="card" borderWidth={1} borderName="border" gap={10}>
      <AppView row align="center" gap={8}>
        <AlertCircle size={18} strokeWidth={2} color={tokens.error} />
        <AppText family="heading" weight="bold" style={{ fontSize: 16, color: tokens.text, flex: 1 }}>
          {t(paymentFailureTitleKey(reason))}
        </AppText>
      </AppView>
      <AppText family="default" style={{ fontSize: 13.5, color: tokens.text }}>
        {t(paymentFailureKey(reason))}
      </AppText>
      <AppText family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
        {t('checkout.unpaidOrderNumber', { number: formatOrderNo(orderId) })}
      </AppText>
      <AppView row gap={18} style={{ marginTop: 2 }}>
        <LinkAction label={t('checkout.viewOrder')} onPress={onViewOrder} color={tokens.text} />
        <LinkAction label={t('checkout.startNewOrder')} onPress={onStartOver} color={tokens.text} />
      </AppView>
      <AppText family="default" style={{ fontSize: 12, color: tokens.textMuted }}>
        {t('checkout.unpaidOrderExpires')}
      </AppText>
    </AppView>
  );
}
