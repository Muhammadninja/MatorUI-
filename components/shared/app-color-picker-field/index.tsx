import { ChoiceField, type FieldOption } from '@/components/shared/form-field-primitives';

export type AppColorPickerFieldProps = {
  label?: string;
  helperText?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  value?: Array<string | number>;
  onChange?: (value: Array<string | number>) => void;
  options?: FieldOption[];
};

export default function AppColorPickerField({
  error,
  options = [],
  value,
  onChange,
  ...props
}: AppColorPickerFieldProps) {
  return (
    <ChoiceField
      errorText={error}
      options={options}
      value={value}
      onChange={(next) => onChange?.(next as Array<string | number>)}
      multiple
      {...props}
    />
  );
}
