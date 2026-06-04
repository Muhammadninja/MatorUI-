import { AppButton } from '@/components/shared/app-button';
import { TextEntryField } from '@/components/shared/form-field-primitives';

export type AppTextFieldProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  value?: string;
  onChangeText?: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  rightAction?: 'clear';
  onRightIconPress?: () => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  secureTextEntry?: boolean;
  style?: React.ComponentProps<typeof TextEntryField>['style'];
  leftAdornment?: React.ReactNode;
  rightAdornment?: React.ReactNode;
  containerStyle?: React.ComponentProps<typeof TextEntryField>['containerStyle'];
  containerRounded?: number;
  containerPx?: number;
  containerPy?: number;
  containerColorName?: React.ComponentProps<typeof TextEntryField>['containerColorName'];
  containerBorderName?: React.ComponentProps<typeof TextEntryField>['containerBorderName'];
};

export function AppTextField({
  onRightIconPress,
  rightAdornment,
  value,
  ...props
}: AppTextFieldProps) {
  return (
    <TextEntryField
      value={value}
      rightAdornment={
        rightAdornment ??
        (onRightIconPress && value ? (
          <AppButton
            title="Clear"
            size="xs"
            variant="ghost"
            kind="text"
            onPress={onRightIconPress}
          />
        ) : null)
      }
      {...props}
    />
  );
}

export default AppTextField;
