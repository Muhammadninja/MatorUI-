import type { ComponentProps } from 'react';

import { AppButton } from '@/components/shared/app-button';
import { TextEntryField } from '@/components/shared/form-field-primitives';

export type AppTextFieldProps = ComponentProps<typeof TextEntryField> & {
  rightAction?: 'clear';
  onRightIconPress?: () => void;
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
