import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { LayoutChangeEvent } from 'react-native';

import { AppOemPill } from '@/components/shared/app-oem-pill';
import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { noBreakDigits } from '@/utils/format-price';

export type ItemDetailHeaderProps = {
  /** Safe-area top inset — the header pads itself out below the status bar. */
  topInset: number;
  onBack: () => void;
  /** Reports the header's real rendered height, so the page can reserve
   *  exactly enough room above the gallery. */
  onLayout?: (event: LayoutChangeEvent) => void;
};

/**
 * Static page header: just the back button. The title lives under the
 * gallery instead (see `ItemIdentity`) — a long title sitting beside the
 * icon here either got clipped or wrapped the whole bar tall, so it's been
 * moved to where it has the full width to itself. It's visible from the
 * first frame rather than fading in once the photos scroll away, so the
 * gallery no longer needs to run under the status bar to look full-bleed —
 * it now starts a clean gap below this bar instead.
 */
export function ItemDetailHeader({ topInset, onBack, onLayout }: ItemDetailHeaderProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView
      onLayout={onLayout}
      colorName="background"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        paddingTop: topInset + 10,
        paddingBottom: 14,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: tokens.divider,
      }}
    >
      <AppPressableView
        onPress={onBack}
        androidRipple={false}
        pressedOpacity={0.7}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        accessibilityRole="button"
        accessibilityLabel={t('itemDetail.back')}
        style={{ alignSelf: 'flex-start' }}
      >
        <ArrowLeft size={22} strokeWidth={2.3} color={tokens.text} />
      </AppPressableView>
    </AppView>
  );
}

export type ItemIdentityProps = {
  title: string;
  oem?: string;
  gm?: string;
};

/** Title → part-number chips, under the gallery (full width, free to wrap). */
export function ItemIdentity({ title, oem, gm }: ItemIdentityProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView gap={9}>
      <AppText
        family="heading"
        weight="bold"
        style={{ fontSize: 24, lineHeight: 30, color: tokens.text }}
      >
        {title}
      </AppText>

      {oem || gm ? <AppOemPill oem={oem} gm={gm} /> : null}
    </AppView>
  );
}

export type ItemPriceRowProps = {
  /** Pre-formatted charged price — already the sale price when one applies. */
  price: string;
  /** Pre-discount price in UZS to strike through; 0 hides it. */
  wasUzs: number;
  /** The backend's own formatting of that price, when it applied the sale
   *  itself. Preferred over reformatting `wasUzs` so the server and the client
   *  never print the same number two ways. */
  wasLabel?: string;
  /** Discount percent; 0 hides the pill. */
  savePct: number;
  /** Name of the campaign behind the discount ("Осенняя распродажа"), when the
   *  backend resolved one. Omitted for a client-matched sale. */
  saleTitle?: string;
  /** Pre-formatted amount saved per unit; null when nothing is discounted. */
  savingsLabel: string | null;
};

/**
 * Price line: the charged price, the struck-through "was", and the discount
 * pill. All three come from the resolved sale (backend-applied when present,
 * `/v1/sales` matcher otherwise) — the same resolution the listing card uses,
 * so card and detail never disagree.
 */
export function ItemPriceRow({
  price,
  wasUzs,
  wasLabel,
  savePct,
  saleTitle,
  savingsLabel,
}: ItemPriceRowProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppView gap={5}>
      <AppView row align="flex-end" wrap columnGap={10} rowGap={6}>
        <AppPrice value={price} size={28} color={tokens.text} />
        {wasUzs > 0 ? (
          <AppText
            family="default"
            style={{
              fontSize: 14,
              color: tokens.textMuted,
              textDecorationLine: 'line-through',
              marginBottom: 4,
            }}
          >
            {`${noBreakDigits(wasUzs.toLocaleString('ru-RU'))} ${t('common.currency')}`}
          </AppText>
        ) : null}
        {savePct > 0 ? (
          <AppView
            rounded={8}
            px={8}
            py={3}
            style={{ marginBottom: 4, backgroundColor: tokens.errorSoft }}
          >
            <AppText family="accent" weight="bold" style={{ fontSize: 12, color: tokens.error }}>
              {t('itemDetail.discountPercent', { percent: savePct })}
            </AppText>
          </AppView>
        ) : null}
      </AppView>
      {savingsLabel ? (
        <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.success }}>
          {t('itemDetail.youSave', { amount: savingsLabel })}
        </AppText>
      ) : null}
      {/* Which campaign the discount comes from — the backend names it, and a
       *  named sale reads as a real offer rather than an arbitrary markdown. */}
      {saleTitle ? (
        <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
          {saleTitle}
        </AppText>
      ) : null}
    </AppView>
  );
}
