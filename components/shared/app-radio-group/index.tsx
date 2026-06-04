import { ChoiceField, type FieldOption } from '@/components/shared/form-field-primitives';

export type AppRadioGroupProps = {
  label?: string;
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  options?: FieldOption[];
};

export function AppRadioGroup({ options = [], ...props }: AppRadioGroupProps) {
  return (
    <ChoiceField
      label={props.label}
      helperText={props.helperText}
      errorText={props.errorText}
      disabled={props.disabled}
      value={props.value}
      options={options}
      onChange={(next) => props.onChange?.(String(next))}
    />
  );
}

export default AppRadioGroup;
