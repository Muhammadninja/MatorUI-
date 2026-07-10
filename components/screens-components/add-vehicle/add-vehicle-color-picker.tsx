import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import type { VehicleColor } from '@/services/garage-service';

const COLOR_OPTIONS: { value: VehicleColor; label: string }[] = [
  { value: 'midnight', label: 'Midnight' },
  { value: 'graphite', label: 'Graphite' },
  { value: 'pearl', label: 'Pearl' },
  { value: 'matte', label: 'Matte' },
];

export type AddVehicleColorPickerProps = {
  value: VehicleColor;
  onChange: (color: VehicleColor) => void;
};

export function AddVehicleColorPicker({ value, onChange }: AddVehicleColorPickerProps) {
  return (
    <AppView gap={10}>
      <AppText
        textVariant="caption"
        family="accent"
        colorName="gray400"
        transform="uppercase"
      >
        Color
      </AppText>
      <AppView row wrap gap="sm">
        {COLOR_OPTIONS.map((opt) => {
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
              accessibilityLabel={`Color ${opt.label}`}
            >
              <AppView px={14} py="sm">
                <AppText
                  textVariant="buttonSm"
                  family="accent"
                  colorName={selected ? 'onSecondary' : 'text'}
                  numberOfLines={1}
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
