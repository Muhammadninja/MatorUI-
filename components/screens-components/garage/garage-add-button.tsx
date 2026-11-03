import { useTranslation } from 'react-i18next';
import { Plus } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type GarageAddButtonProps = {
  onPress: () => void;
};

/**
 * Full-width add button: pale teal fill and a solid teal border, with a graphite
 * label because teal text on the pale panel falls short of 4.5:1.
 */
export function GarageAddButton({ onPress }: GarageAddButtonProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  return (
    <AppPressableView
      row
      center
      gap={8}
      rounded={12}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('garage.addVehicle')}
      accessibilityHint={t('garage.addVehicleHint')}
      style={{
        minHeight: 48,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: tokens.brand,
        backgroundColor: tokens.brandSoft,
      }}
    >
      <Plus size={20} strokeWidth={2.2} color={tokens.brand} />
      <AppText textVariant="button" weight="semibold" colorName="text" style={{ flexShrink: 1 }}>
        {t('garage.addVehicle')}
      </AppText>
    </AppPressableView>
  );
}

export default GarageAddButton;
