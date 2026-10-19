import { AppPrice } from '@/components/shared/app-price';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

import { SEARCH_FONT } from './fonts';

export type { PriceSignal } from './signal';

/** The row's own faces, so the price reads as part of the result card. */
const PRICE_FONT = { amount: SEARCH_FONT.bold, affix: SEARCH_FONT.semibold };

/** Strip currency words, spaces and punctuation so "UZS 38 661" and
 *  "UZS 38 661" compare equal regardless of the separator the backend used. */
function samePrice(a: string, b: string): boolean {
  const key = (v: string) => v.replace(/[\s\u00A0.,']/g, '').toLowerCase();
  return key(a) === key(b);
}

export default function PriceBlock({ priceLabel, price }: { priceLabel: string; price: string }) {
  const { tokens } = useThemeContext();
  // `priceLabel` is a lead-in ("Starting at"), but the search envelope defaults
  // it to the price itself — which rendered the same number twice, once gray
  // and once large. Show it only when it actually says something different.
  const lead = priceLabel && !samePrice(priceLabel, price) ? priceLabel : null;
  return (
    <AppView gap={2}>
      {lead ? (
        <AppText
          textVariant="bodyXs"
          style={{ color: tokens.gray400, fontFamily: SEARCH_FONT.regular, fontSize: 12 }}
        >
          {lead}
        </AppText>
      ) : null}
      {/* The price has the line to itself now that the signal tag moved up
       *  beside the title — it is the row's headline number, in theme text
       *  color (white in dark mode) rather than link blue. */}
      <AppView row align="flex-end" style={{ gap: 8, flexWrap: 'wrap' }}>
        <AppPrice value={price} size={24} color={tokens.text} fontFamily={PRICE_FONT} />
      </AppView>
    </AppView>
  );
}
