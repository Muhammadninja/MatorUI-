import React from 'react';
import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import type { VehicleColor } from '@/services/garage-service';

function buildColorOptions(
  t: (key: string) => string,
): { value: VehicleColor; label: string }[] {
  return [
    { value: 'midnight', label: t('addVehicle.colorMidnight') },
    { value: 'graphite', label: t('addVehicle.colorGraphite') },
    { value: 'pearl', label: t('addVehicle.colorPearl') },
    { value: 'matte', label: t('addVehicle.colorMatte') },
  ];
}

export type AddVehicleColorPickerProps = {
  value: VehicleColor;
  onChange: (color: VehicleColor) => void;
};

export function AddVehicleColorPicker({ value, onChange }: AddVehicleColorPickerProps) {
  const { t } = useTranslation();
  const colorOptions = React.useMemo(() => buildColorOptions(t), [t]);
  return (
    <AppView gap={10}>
      <AppText
        textVariant="caption"
        family="accent"
        colorName="gray400"
        transform="uppercase"
      >
        {t('addVehicle.colorLabel')}
      </AppText>
      <AppView row wrap gap="sm">
        {colorOptions.map((opt) => {
          const selected = opt.value === value;
          return (
            <AppPressableView
              key={opt.value}
              rounded={999}
              colorName={selected ? 'secondary' : 'card'}
              borderName={selected ? undefined : 'border'}
              borderWidth={selected ? 0 : 1}
              androidRipple
              onPress={() => onChange(opt.value)}
              accessibilityLabel={t('addVehicle.colorOption', { color: opt.label })}
            >
              <AppView px={14} py="sm">
                <AppText
                  textVariant="buttonSm"
                  family="accent"
                  colorName={selected ? 'onSecondary' : 'text'}
                >
                  {opt.label}
                </AppText>
              </AppView>
            </AppPressableView>
          );
        })}
      </AppView>
    </AppView>
  );
}

export default AddVehicleColorPicker;
