import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react-native';

import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { VEHICLE_COLOR_SWATCHES, normalizeHex } from '@/utils/vehicle-color';

export type VehicleColorPickerProps = {
  /** Selected color as a hex string (`#2456C8`). */
  value?: string;
  onChange: (hex: string) => void;
  /** Section label; defaults to the translated "Color". */
  label?: string;
};

/**
 * Automotive colour picker — a wrapped grid of real car-colour swatches that
 * yields a hex value (the backend's `color_hex`). Replaces the old 4-value
 * enum chips; the selected swatch gets a brand ring and a contrast-checked
 * tick. All colours come from `VEHICLE_COLOR_SWATCHES` so this component
 * holds no colour literals (keeps `lint:tokens` clean).
 */
export function VehicleColorPicker({ value, onChange, label }: VehicleColorPickerProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const selected = normalizeHex(value);

  return (
    <AppView gap={10}>
      <AppText
        family="accent"
        weight="semibold"
        colorName="textMuted"
        style={{ fontSize: 11, letterSpacing: 0.7 }}
        transform="uppercase"
      >
        {label ?? t('vehicleDetail.color')}
      </AppText>
      <AppView row style={{ flexWrap: 'wrap', gap: 12 }}>
        {VEHICLE_COLOR_SWATCHES.map((s) => {
          const isSelected = normalizeHex(s.hex) === selected;
          return (
            <AppPressableView
              key={s.hex}
              center
              androidRipple={false}
              onPress={() => onChange(s.hex)}
              accessibilityRole="button"
              accessibilityLabel={s.name}
              accessibilityState={{ selected: isSelected }}
              hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              style={{
                width: 42,
                height: 42,
                borderRadius: 999,
                backgroundColor: s.hex,
                borderWidth: isSelected ? 2.5 : 1,
                borderColor: isSelected ? tokens.brand : tokens.border,
              }}
            >
              {isSelected ? <Check size={18} strokeWidth={3} color={s.onHex} /> : null}
            </AppPressableView>
          );
        })}
      </AppView>
    </AppView>
  );
}

export default VehicleColorPicker;
