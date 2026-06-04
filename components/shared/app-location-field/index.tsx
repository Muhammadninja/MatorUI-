import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { FieldShell, TextEntryField } from '@/components/shared/form-field-primitives';

export type AppLocationFieldProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  value?: string;
  coordinates?: { latitude: number; longitude: number } | null;
  onChange?: (address: string, coords?: { latitude: number; longitude: number } | null) => void;
  disabled?: boolean;
};

export function AppLocationField({
  label,
  placeholder,
  helperText,
  errorText,
  required,
  value,
  coordinates,
  onChange,
  disabled,
}: AppLocationFieldProps) {
  return (
    <FieldShell label={label} required={required} helperText={helperText} errorText={errorText}>
      <AppView gap={8}>
        <TextEntryField
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onChangeText={(next) => onChange?.(next, coordinates ?? null)}
        />
        {coordinates ? (
          <AppText textVariant="bodyXs" muted>
            {coordinates.latitude}, {coordinates.longitude}
          </AppText>
        ) : null}
        {!!value ? (
          <AppButton
            title="Clear location"
            size="xs"
            variant="ghost"
            kind="text"
            disabled={disabled}
            onPress={() => onChange?.('', null)}
          />
        ) : null}
      </AppView>
    </FieldShell>
  );
}

export default AppLocationField;
