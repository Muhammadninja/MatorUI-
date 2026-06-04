import { TextEntryField } from '@/components/shared/form-field-primitives';

export type AppPriceInputProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  value?: string | number;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

export function AppPriceInput({
  value,
  onChange,
  placeholder = '0',
  ...props
}: AppPriceInputProps) {
  return (
    <TextEntryField
      keyboardType="decimal-pad"
      placeholder={placeholder}
      value={value == null ? '' : String(value)}
      onChangeText={onChange}
      {...props}
    />
  );
}

export default AppPriceInput;
