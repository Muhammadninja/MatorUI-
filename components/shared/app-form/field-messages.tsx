import React from 'react';

import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';

export type FieldMessagesProps = {
  helperText?: string;
  errorText?: string;
};

/** Renders helper or error text consistently below a field. Error text takes precedence. */
export function FieldMessages({ helperText, errorText }: FieldMessagesProps) {
  if (!helperText && !errorText) return null;
  return (
    <AppView>
      {errorText ? (
        <AppText textVariant="bodyXs" colorName={'error' as any}>
          {errorText}
        </AppText>
      ) : helperText ? (
        <AppText textVariant="bodyXs" muted>
          {helperText}
        </AppText>
      ) : null}
    </AppView>
  );
}

export default FieldMessages;
