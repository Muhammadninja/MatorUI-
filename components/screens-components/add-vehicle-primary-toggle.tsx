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
  title = 'Set as primary',
  hint = 'Filter parts by this vehicle by default.',
}: AddVehiclePrimaryToggleProps) {
  const { tokens } = useThemeContext();

  return (
    <AppView
      rounded={20}
      colorName="card"
      borderName="border"
      borderWidth={1}
    >
      <AppView row align="center" justify="space-between" gap={12} p={16}>
        <AppView flex={1} gap={2}>
          <AppText textVariant="bodySemibold" colorName="text" numberOfLines={1}>
            {title}
          </AppText>
          <AppText textVariant="bodyXs" colorName="gray400">
            {hint}
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
