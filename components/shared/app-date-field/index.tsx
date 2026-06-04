import { TextEntryField } from '@/components/shared/form-field-primitives';

export type AppDateFieldProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
};

export default function AppDateField({ onChange, ...props }: AppDateFieldProps) {
  return <TextEntryField placeholder="YYYY-MM-DD" onChangeText={onChange} {...props} />;
}
