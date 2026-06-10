import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

import Ribbon from './ribbon';
import type { PriceSignal } from './signal';

export type { PriceSignal } from './signal';

export default function PriceBlock({
  priceLabel,
  price,
  signal,
}: {
  priceLabel: string;
  price: string;
  /** Optional ribbon shown at the flex-end of the price line. */
  signal?: PriceSignal | null;
}) {
  const { tokens } = useThemeContext();
  return (
    <AppView gap={2}>
      <AppText textVariant="bodyXs" style={{ color: tokens.gray400, fontSize: 12 }}>
        {priceLabel}
      </AppText>
      {/* Price + ribbon: flex-wrap so the ribbon drops to its own row
       *  when the price string is too long to share the line (e.g.
       *  "UZS 100,000,000"). Price never shrinks/truncates — it's the
       *  functional number; the ribbon is decorative and can wrap. */}
      <AppView row align="flex-end" style={{ gap: 8, flexWrap: 'wrap' }}>
        <AppText
          family="heading"
          weight="bold"
          numberOfLines={1}
          style={{ fontSize: 18, lineHeight: 24, color: tokens.info }}
        >
          {price}
        </AppText>
        {signal ? (
          <Ribbon
            label={signal.label}
            icons={signal.icons}
            composite={signal.composite}
          />
        ) : null}
      </AppView>
    </AppView>
  );
}
