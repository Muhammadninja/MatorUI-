import { TextEntryField } from '@/components/shared/form-field-primitives';

export type AppPhoneTextFieldProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  value?: string;
  onChangeText?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
};

export function AppPhoneTextField(props: AppPhoneTextFieldProps) {
  return <TextEntryField keyboardType="phone-pad" {...props} />;
}

export default AppPhoneTextField;
