import { ChoiceField, type FieldOption } from '@/components/shared/form-field-primitives';
import type { ColorName } from '@/themes';

export type AppSelectSheetFieldProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
  value?: string | number;
  onChange?: (value: string | number) => void;
  options?: FieldOption[];
  modalTitle?: string;
  snapMax?: number;
  minHeight?: number;
  inactiveTextColorName?: ColorName;
};

export default function AppSelectSheetField({ options = [], ...props }: AppSelectSheetFieldProps) {
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
