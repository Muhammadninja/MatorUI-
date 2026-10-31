import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import type { CartTotals, PromoCode } from '@/contexts/cart.context';
import { useThemeContext } from '@/contexts/theme.context';

export type CartSummaryProps = {
  totals: CartTotals;
  appliedPromo: PromoCode | null;
  formatCurrency: (amount: number) => string;
};

export default function CartSummary({ totals, appliedPromo, formatCurrency }: CartSummaryProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const shippingLabel = totals.shipping > 0 ? formatCurrency(totals.shipping) : t('cart.free');
  const showDiscount = totals.discount > 0;

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
        {t('cart.orderSummary')}
      </AppText>

      <AppView gap={6}>
        <SummaryRow label={t('cart.subtotal')} value={formatCurrency(totals.subtotal)} />
        {showDiscount ? (
          <SummaryRow
            label={appliedPromo ? t('cart.discountWithCode', { code: appliedPromo.code }) : t('cart.discount')}
            value={`- ${formatCurrency(totals.discount)}`}
            accentColor={tokens.success}
          />
        ) : null}
        <SummaryRow label={t('cart.shipping')} value={shippingLabel} />
        <SummaryRow label={t('cart.serviceFee')} value={formatCurrency(totals.serviceFee)} />
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
