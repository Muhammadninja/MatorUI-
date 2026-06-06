import { Plus } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/utils/haptics';

export default function CartListsSection() {
  const { tokens } = useThemeContext();
  const toast = useToast();

  const handleNewList = () => {
    triggerHaptic('selection');
    toast.info('Coming soon', { description: 'Saved lists will sync once backend lands.' });
  };

  return (
    <AppView gap={10}>
      <AppView row align="center" justify="space-between">
        <AppText textVariant="bodySm" weight="semibold">
          Saved lists
        </AppText>
        <AppPressableView androidRipple={false} onPress={handleNewList}>
          <AppView row align="center" gap={6}>
            <Plus size={16} strokeWidth={2.4} color={tokens.gray400} />
            <AppText textVariant="bodySm" colorName="gray400" weight="medium">
              New
            </AppText>
          </AppView>
        </AppPressableView>
      </AppView>

      <AppText textVariant="bodyXs" colorName="gray400">
        No saved lists yet. Group parts by build, vehicle, or season.
      </AppText>
    </AppView>
  );
}
