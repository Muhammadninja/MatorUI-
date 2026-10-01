import { useTranslation } from 'react-i18next';

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

/** Ring (tap target) and the colour disc inside it. Eight rings + gaps fit one
 *  row on a 360dp screen, which is what makes this read as a selector rather
 *  than a palette. */
const RING = 38;
const DISC = 28;

/**
 * Vehicle colour selector — one row of eight real car colours, yielding the
 * hex the backend stores as `color_hex`.
 *
 * Selection is a ring AROUND the swatch, not a tick on top of it: the colour is
 * the thing being chosen, so covering it to say "chosen" is backwards (and the
 * tick needed a contrast-matched icon per swatch to stay legible).
 *
 * The selected colour is named beside the label, so the control explains
 * itself without a tooltip.
 */
export function VehicleColorPicker({ value, onChange, label }: VehicleColorPickerProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const selected = normalizeHex(value);
  const current = VEHICLE_COLOR_SWATCHES.find((s) => normalizeHex(s.hex) === selected);

  return (
    <AppView gap={10}>
      <AppView row align="center" justify="space-between" gap={12}>
        <AppText
          family="accent"
          weight="semibold"
          colorName="textMuted"
          style={{ fontSize: 11, letterSpacing: 0.7 }}
          transform="uppercase"
        >
          {label ?? t('vehicleDetail.color')}
        </AppText>
        {current ? (
          <AppText family="accent" weight="semibold" style={{ fontSize: 13, color: tokens.text }}>
            {t(current.labelKey)}
          </AppText>
        ) : null}
      </AppView>

      <AppView row align="center" justify="space-between">
        {VEHICLE_COLOR_SWATCHES.map((s) => {
          const isSelected = normalizeHex(s.hex) === selected;
          return (
            <AppPressableView
              key={s.hex}
              center
              // REQUIRED, not decorative: AppPressableView puts `style` on its
              // outer wrapper and only stretches the inner Pressable when this
              // is set. Without it the Pressable sizes to its children — and an
              // unselected swatch has none — so the touch target collapsed to
              // 0×0 and the swatches simply did not respond to taps.
              fillContainer
              androidRipple={false}
              pressedOpacity={0.7}
              onPress={() => onChange(s.hex)}
              accessibilityRole="button"
              accessibilityLabel={t(s.labelKey)}
              accessibilityState={{ selected: isSelected }}
              style={{
                width: RING,
                height: RING,
                borderRadius: 999,
                borderWidth: isSelected ? 2 : 0,
                borderColor: tokens.text,
              }}
            >
              <AppView
                style={{
                  width: DISC,
                  height: DISC,
                  borderRadius: 999,
                  backgroundColor: s.hex,
                  // Hairline so white-on-white still reads as a disc.
                  borderWidth: 1,
                  borderColor: tokens.border,
                }}
              />
            </AppPressableView>
          );
        })}
      </AppView>
    </AppView>
  );
}

export default VehicleColorPicker;
