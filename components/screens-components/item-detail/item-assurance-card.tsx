import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { STANDARD_DELIVERY_UZS } from '@/services/cart-math';
import type { CatalogItem } from '@/services/catalog-service';

/** BCP-47 tag per app language, for the arrival-date formatting. */
const DATE_LOCALES: Record<string, string> = { en: 'en-US', ru: 'ru-RU', uz: 'uz-UZ' };

/** "Mon, 6 Oct" — or null when the runtime's ICU can't do this locale. */
function formatDay(date: Date, locale: string): string | null {
  try {
    const s = date.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
    return s && !/Invalid/i.test(s) ? s : null;
  } catch {
    return null;
  }
}

function addDays(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

export type ItemAssuranceCardProps = {
  item: CatalogItem;
  formatCurrency: (amount: number) => string;
};

/**
 * The reassurance block — written as plain sentences, not a labelled table.
 * When it lands leads, in the same voice a counter clerk would use; shipping
 * and payment follow as quiet supporting copy.
 *
 * It is deliberately UNBOXED. It used to sit in a tinted card, directly under
 * the tinted fit verdict and directly above the grey spec table — three
 * rounded blocks in three tints with nothing ranking them. The page now spends
 * its one coloured card on the fit verdict (the actual decision) and sets
 * everything else as type separated by hairlines.
 *
 * Every line is derived, never promised: the arrival window is the backend's
 * `delivery_eta_days_{min,max}` turned into real dates, the shipping line
 * states the SAME flat courier fee the backend actually charges
 * (`STANDARD_DELIVERY_UZS`, mirroring `orders.service.ts`), and the payment
 * line lists the three methods checkout actually offers. Lines with no data
 * behind them don't render.
 *
 * The seller's storefront name is deliberately NOT here. Mator is the shop the
 * customer is buying from; naming the dealer behind the listing ("Sold by
 * Drivers Village") answers a question nobody asked and invites comparison
 * shopping off-platform. The seller's TRUST flags still show — MATOR Certified
 * and lowest-price are claims about the listing, not an introduction to
 * someone else's storefront.
 */
export function ItemAssuranceCard({ item, formatCurrency }: ItemAssuranceCardProps) {
  const { t, i18n } = useTranslation();
  const { tokens } = useThemeContext();

  const min = item.deliveryEtaMinDays;
  const max = item.deliveryEtaMaxDays;
  const locale = DATE_LOCALES[i18n.language] ?? 'en-US';

  // Prefer concrete dates ("Mon, 6 Oct – Wed, 8 Oct") — a date reassures far
  // better than "3–5 days" — and fall back to the day count if ICU can't
  // format this locale.
  let when: string | null = null;
  if (min != null || max != null) {
    const from = formatDay(addDays(min ?? max ?? 0), locale);
    const to = max != null && max !== min ? formatDay(addDays(max), locale) : null;
    if (from && to) when = t('itemDetail.arrivesRange', { from, to });
    else if (from) when = from;
    else if (min != null && max != null && max !== min)
      when = t('itemDetail.deliveryRange', { min, max });
    else when = t('itemDetail.deliveryDays', { days: min ?? max });
  }

  const shippingLine = t('itemDetail.deliveryFeeLine', {
    amount: formatCurrency(STANDARD_DELIVERY_UZS),
  });

  return (
    <AppView gap={7}>
      {when ? (
        <AppText family="accent" weight="semibold" style={{ fontSize: 14.5, color: tokens.text }}>
          {t('itemDetail.arrivesLead')}{' '}
          <AppText family="accent" weight="bold" style={{ color: tokens.success }}>
            {when}
          </AppText>
        </AppText>
      ) : null}

      <AppText family="default" style={{ fontSize: 13, lineHeight: 18, color: tokens.textMuted }}>
        {shippingLine}
      </AppText>

      <AppText family="default" style={{ fontSize: 12.5, lineHeight: 17, color: tokens.textMuted }}>
        {t('itemDetail.paymentLine')}
      </AppText>
    </AppView>
  );
}

export default ItemAssuranceCard;
