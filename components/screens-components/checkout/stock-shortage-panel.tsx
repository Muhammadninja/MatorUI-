import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import type { useThemeContext } from '@/contexts/theme.context';
import {
  type ShortageAlternative,
  type StockShortageLine,
  alternativeQuantity,
  shortageCauseKey,
} from '@/services/stock-shortage';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

/**
 * Why the order could not be placed, part by part, and the same part at other sellers.
 * An alternative is another seller's own listing at its own price: it never stands in for
 * the original by itself. The buyer picks it, and the cart line is replaced only then.
 */
export function StockShortagePanel({
  lines,
  titles,
  tokens,
  formatCurrency,
  onChoose,
}: {
  lines: StockShortageLine[];
  /** The cart's titles by part id, so a line reads as the buyer's own. */
  titles: Record<string, string>;
  tokens: Tokens;
  formatCurrency: (amount: number) => string;
  onChoose: (line: StockShortageLine, alternative: ShortageAlternative) => void;
}) {
  const { t } = useTranslation();
  return (
    <AppView testID="checkout-stock-shortage" gap={12}>
      {lines.map((line) => (
        <AppView key={line.partId} gap={6}>
          <AppText family="accent" weight="bold" style={{ fontSize: 13.5, color: tokens.text }}>
            {titles[line.partId] ?? line.partId}
          </AppText>
          <AppText family="default" style={{ fontSize: 12.5, color: tokens.error }}>
            {t('checkout.stockShortQuantity', {
              requested: line.requestedQuantity,
              available: line.availableQuantity,
            })}
          </AppText>
          <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
            {t(shortageCauseKey(line.cause))}
          </AppText>
          {line.alternatives.length > 0 ? (
            <AppView gap={8}>
              <AppText family="default" style={{ fontSize: 12.5, color: tokens.text }}>
                {t('checkout.stockAlternativesTitle')}
              </AppText>
              {line.alternatives.map((alt) => (
                <AppView
                  key={alt.partId}
                  testID={`stock-alternative-${alt.partId}`}
                  row
                  align="center"
                  gap={8}
                  style={{ borderWidth: 1, borderColor: tokens.divider, borderRadius: 10, padding: 10 }}
                >
                  <AppView flex={1} gap={2}>
                    <AppText family="default" weight="bold" style={{ fontSize: 13, color: tokens.text }}>
                      {alt.sellerName}
                    </AppText>
                    <AppText family="default" style={{ fontSize: 12, color: tokens.textMuted }}>
                      {formatCurrency(alt.priceUzs)} ·{' '}
                      {alt.availableQuantity === null
                        ? t('checkout.stockAlternativeInStock')
                        : t('checkout.stockAlternativeAvailable', { count: alt.availableQuantity })}
                    </AppText>
                    {!alt.coversRequested ? (
                      <AppText family="default" style={{ fontSize: 12, color: tokens.error }}>
                        {t('checkout.stockAlternativePartial', {
                          count: alternativeQuantity(line, alt),
                        })}
                      </AppText>
                    ) : null}
                  </AppView>
                  <AppButton
                    title={t('checkout.stockAlternativeChoose')}
                    size="sm"
                    variant="outline"
                    onPress={() => onChoose(line, alt)}
                  />
                </AppView>
              ))}
            </AppView>
          ) : null}
          {line.sourcingRequested ? (
            <AppText family="default" style={{ fontSize: 12, color: tokens.textMuted }}>
              {t('checkout.stockSourcingRequested')}
            </AppText>
          ) : null}
        </AppView>
      ))}
    </AppView>
  );
}
