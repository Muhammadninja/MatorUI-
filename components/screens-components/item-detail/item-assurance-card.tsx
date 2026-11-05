import { Truck } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
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
};

/**
 * The reassurance block — written as plain sentences, not a labelled table.
 * When it lands leads, in the same voice a counter clerk would use; shipping
 * and payment follow as quiet supporting copy.
 *
 * It sits in the handoff's pale teal delivery panel, with graphite type.
 *
 * Every line is derived, never promised: the arrival window is the backend's
 * `delivery_eta_days_{min,max}` turned into real dates, the shipping line says
 * only that delivery is priced at checkout (the price depends on the buyer's
 * address, which this screen does not know), and the payment line lists the three
 * methods checkout actually offers. Lines with no data behind them don't render.
 *
 * The seller's storefront name is deliberately NOT here. Mator is the shop the
 * customer is buying from; naming the dealer behind the listing ("Sold by
 * Drivers Village") answers a question nobody asked and invites comparison
 * shopping off-platform. The seller's TRUST flags still show — MATOR Certified
 * and lowest-price are claims about the listing, not an introduction to
 * someone else's storefront.
 */
export function ItemAssuranceCard({ item }: ItemAssuranceCardProps) {
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

  return (
    <AppView row gap={12} rounded={16} p={16} style={{ backgroundColor: tokens.brandSoft }}>
      <Truck size={20} strokeWidth={2.2} color={tokens.brand} />
      <AppView flex={1} gap={4}>
        {when ? (
          <AppText
            family="accent"
            weight="semibold"
            style={{ fontSize: 14, lineHeight: 20, color: tokens.text }}
          >
            {t('itemDetail.arrivesLead')}{' '}
            <AppText family="accent" weight="bold" style={{ color: tokens.text }}>
              {when}
            </AppText>
          </AppText>
        ) : null}

        <AppText family="default" style={{ fontSize: 14, lineHeight: 20, color: tokens.text }}>
          {t('itemDetail.deliveryCostAtCheckout')}
        </AppText>

        <AppText family="default" style={{ fontSize: 14, lineHeight: 20, color: tokens.text }}>
          {t('itemDetail.paymentLine')}
        </AppText>
      </AppView>
    </AppView>
  );
}

export default ItemAssuranceCard;
