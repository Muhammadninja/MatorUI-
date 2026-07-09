import { AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';

/** Footer spinner shown while the next page is loading (pagination). */
export default function FooterSpinner() {
  const { tokens } = useThemeContext();
  return (
    <AppView center py={20}>
      <WheelLoader size={22} color={tokens.gray400} />
    </AppView>
  );
}
