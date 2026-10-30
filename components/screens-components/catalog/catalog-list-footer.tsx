import { useTranslation } from 'react-i18next';

import FooterSpinner from '@/components/screens-components/search/search-results/footer-spinner';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type CatalogListFooterProps = {
  /** The next page is in flight. */
  loading: boolean;
  /** The last next-page request failed. */
  failed: boolean;
  onRetry: () => void;
};

/**
 * The foot of a catalogue list that loads page by page: the spinner while the
 * next page is on its way, and when it failed, why plus a retry — the rows
 * already loaded stay where they are either way. A retry in flight shows the
 * spinner again.
 */
export default function CatalogListFooter({ loading, failed, onRetry }: CatalogListFooterProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  if (loading) return <FooterSpinner />;
  if (!failed) return null;
  return (
    <AppView align="center" gap={10} px={16} py={20}>
      <AppText
        family="default"
        style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center' }}
      >
        {t('catalog.loadPartsError')}
      </AppText>
      <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={onRetry} />
    </AppView>
  );
}
