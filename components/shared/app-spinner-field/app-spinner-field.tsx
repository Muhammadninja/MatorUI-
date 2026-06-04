import { ChoiceField, type FieldOption } from '@/components/shared/form-field-primitives';

export type AppSpinnerFieldProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
  value?: string | number;
  onChange?: (value: string | number) => void;
  options?: FieldOption[];
};

export default function AppSpinnerField({ options = [], ...props }: AppSpinnerFieldProps) {
  return (
    <ChoiceField
      label={props.label}
      helperText={props.helperText}
      errorText={props.errorText}
      required={props.required}
      disabled={props.disabled}
      value={props.value}
      options={options}
      onChange={(next) => props.onChange?.(next as string | number)}
    />
  );
}
