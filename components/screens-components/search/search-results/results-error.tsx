import { AlertCircle } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type ResultsErrorProps = {
  error: string | null;
};

/** Error state: shown when the search request fails. */
export default function ResultsError({ error }: ResultsErrorProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  return (
    <AppView gap={14} px={16} pt={40} align="center">
      <AlertCircle size={48} strokeWidth={2} color={tokens.error} />
      <AppView gap={4} align="center">
        <AppText textVariant="bodySemibold" weight="semibold" align="center">
          {t('search.searchFailed')}
        </AppText>
        <AppText textVariant="bodySm" colorName="textMuted" style={{ textAlign: 'center' }}>
          {error ?? t('search.genericError')}
        </AppText>
      </AppView>
    </AppView>
  );
}
