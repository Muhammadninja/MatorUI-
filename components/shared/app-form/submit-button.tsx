import React from 'react';
import { useFormContext, type FieldValues } from 'react-hook-form';

import { AppButton, type AppButtonProps } from '@/components/shared/app-button';

type BaseProps = Omit<AppButtonProps, 'onPress' | 'title' | 'disabled'> & {
  title?: string;
  disabled?: boolean;
};

type SubmitVariant = { submit: () => void; onSubmit?: never };
type OnSubmitVariant<TValues extends FieldValues> = {
  submit?: never;
  onSubmit: (values: TValues) => void | Promise<void>;
};

export type AppFormSubmitButtonProps<TValues extends FieldValues> = BaseProps &
  (SubmitVariant | OnSubmitVariant<TValues>);

// Button that triggers RHF submit. Use either `submit` from AppForm footer context,
// or provide `onSubmit` to wire handleSubmit automatically.
export function AppFormSubmitButton<TValues extends FieldValues>(
  props: AppFormSubmitButtonProps<TValues>,
) {
  const { handleSubmit, formState } = useFormContext<TValues>();
  const { title = 'Submit', disabled, ...rest } = props as BaseProps;

  const onPress =
    'submit' in props && props.submit
      ? props.submit
      : 'onSubmit' in props && props.onSubmit
        ? () => handleSubmit(props.onSubmit as any)()
        : undefined;

  return (
    <AppButton
      title={title}
      onPress={onPress}
      disabled={disabled ?? formState.isSubmitting}
      {...rest}
    />
  );
}
