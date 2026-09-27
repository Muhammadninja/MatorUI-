import { useTranslation } from 'react-i18next';
import { Switch } from 'react-native';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export type AddVehiclePrimaryToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  title?: string;
  hint?: string;
};

export function AddVehiclePrimaryToggle({
  value,
  onChange,
  title,
  hint,
}: AddVehiclePrimaryToggleProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const resolvedTitle = title ?? t('addVehicle.setPrimaryTitle');
  const resolvedHint = hint ?? t('addVehicle.setPrimaryHint');

  return (
    <AppView
      rounded={20}
      colorName="card"
      borderName="border"
      borderWidth={1}
    >
      <AppView row align="center" justify="space-between" gap="md" p="lg">
        <AppView flex={1} gap={2}>
          <AppText textVariant="bodySemibold" colorName="text">
            {resolvedTitle}
          </AppText>
          <AppText textVariant="bodyXs" colorName="gray400">
            {resolvedHint}
          </AppText>
        </AppView>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: tokens.switchTrackOff, true: tokens.switchTrackOn }}
          thumbColor={value ? tokens.switchThumbOn : tokens.white}
          ios_backgroundColor={tokens.switchTrackOff}
        />
      </AppView>
    </AppView>
  );
}

export default AddVehiclePrimaryToggle;
