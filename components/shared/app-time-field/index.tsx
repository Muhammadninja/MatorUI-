import { TextEntryField } from '@/components/shared/form-field-primitives';

export type AppTimeFieldProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

export function AppTimeField({ onChange, ...props }: AppTimeFieldProps) {
  return <TextEntryField placeholder="HH:MM" onChangeText={onChange} {...props} />;
}

export default AppTimeField;
