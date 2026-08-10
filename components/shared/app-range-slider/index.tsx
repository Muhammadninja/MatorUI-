import { useTranslation } from 'react-i18next';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { FieldShell, TextEntryField } from '@/components/shared/form-field-primitives';

export type AppRangeSliderProps = {
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  value?: [number, number];
  onChange?: (value: [number, number]) => void;
  onChangeEnd?: (value: [number, number]) => void;
};

export function AppRangeSlider({
  label,
  helperText,
  errorText,
  required,
  disabled,
  min = 0,
  max = 100,
  value = [min, max],
  onChange,
  onChangeEnd,
}: AppRangeSliderProps) {
  const { t } = useTranslation();
  const [start, end] = value;

  return (
    <FieldShell label={label} required={required} helperText={helperText} errorText={errorText}>
      <AppView gap={8}>
        <AppView row gap={8}>
          <AppView flex={1}>
            <TextEntryField
              label={t('common.from')}
              value={String(start)}
              keyboardType="number-pad"
              disabled={disabled}
              onChangeText={(next) => onChange?.([Number(next || 0), end])}
              onBlur={() => onChangeEnd?.([start, end])}
            />
          </AppView>
          <AppView flex={1}>
            <TextEntryField
              label={t('common.to')}
              value={String(end)}
              keyboardType="number-pad"
              disabled={disabled}
              onChangeText={(next) => onChange?.([start, Number(next || 0)])}
              onBlur={() => onChangeEnd?.([start, end])}
            />
          </AppView>
        </AppView>
        <AppText textVariant="bodyXs" muted>
          {t('fields.allowedRange', { min, max })}
        </AppText>
      </AppView>
    </FieldShell>
  );
}

export default AppRangeSlider;
