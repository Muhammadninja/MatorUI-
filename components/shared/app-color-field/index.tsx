import { ChoiceField, type FieldOption } from '@/components/shared/form-field-primitives';

export type AppColorFieldProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  value?: string | number;
  onChange?: (value: string | number) => void;
  options?: FieldOption[];
};

export function AppColorField({ options = [], ...props }: AppColorFieldProps) {
  return (
    <ChoiceField
      label={props.label}
      helperText={props.helperText}
      errorText={props.errorText}
      disabled={props.disabled}
      value={props.value}
      options={options}
      onChange={(next) => props.onChange?.(next as string | number)}
    />
  );
}

export default AppColorField;
