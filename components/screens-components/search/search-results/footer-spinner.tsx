import { ActivityIndicator } from 'react-native';

import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

/** Footer spinner shown while the next page is loading (pagination). */
export default function FooterSpinner() {
  const { tokens } = useThemeContext();
  return (
    <AppView center py={20}>
      <ActivityIndicator size="small" color={tokens.gray400} />
    </AppView>
  );
}
