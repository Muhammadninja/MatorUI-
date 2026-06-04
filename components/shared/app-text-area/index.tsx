import { TextEntryField } from '@/components/shared/form-field-primitives';

export type AppTextAreaProps = {
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

export function AppTextArea(props: AppTextAreaProps) {
  return <TextEntryField multiline numberOfLines={5} {...props} />;
}

export default AppTextArea;
