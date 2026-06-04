import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { FieldShell, type FieldOption } from '@/components/shared/form-field-primitives';

export type AppSelectableCardFieldProps = {
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
  value?: string | number;
  onChange?: (value: string | number) => void;
  options?: FieldOption[];
};

export function AppSelectableCardField({
  label,
  helperText,
  errorText,
  required,
  disabled,
  value,
  onChange,
  options = [],
}: AppSelectableCardFieldProps) {
  return (
    <FieldShell label={label} required={required} helperText={helperText} errorText={errorText}>
      <AppView gap={10}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <AppPressableView
              key={String(option.value)}
              rounded={18}
              p={14}
              borderWidth={1}
              borderName={selected ? 'secondary' : 'border'}
              colorName={selected ? 'card' : 'background'}
              disabled={disabled}
              onPress={() => onChange?.(option.value)}
            >
              <AppText textVariant="bodySemibold">{option.label}</AppText>
              {option.description ? (
                <AppText textVariant="bodyXs" muted>
                  {option.description}
                </AppText>
              ) : null}
            </AppPressableView>
          );
        })}
      </AppView>
    </FieldShell>
  );
}

export default AppSelectableCardField;
