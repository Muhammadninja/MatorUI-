import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type GarageAddButtonProps = {
  onPress: () => void;
};

/**
 * The one stroked element on the screen: a full-width dashed ghost button
 * to add a further vehicle. Muted throughout so it recedes below the
 * active hero and switcher.
 */
export function GarageAddButton({ onPress }: GarageAddButtonProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppPressableView
      row
      center
      gap={8}
      rounded={16}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('garage.addAnotherVehicle')}
      accessibilityHint={t('garage.addVehicleHint')}
      style={{
        paddingVertical: 15,
        borderWidth: 1,
        borderColor: tokens.border,
        borderStyle: 'dashed',
        backgroundColor: 'transparent',
      }}
    >
      <Plus size={18} strokeWidth={2.2} color={tokens.textMuted} />
      <AppText family="accent" weight="semibold" colorName="textMuted" style={{ fontSize: 14 }}>
        {t('garage.addAnotherVehicle')}
      </AppText>
    </AppPressableView>
  );
}

export default GarageAddButton;
