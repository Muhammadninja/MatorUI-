import { useTranslation } from 'react-i18next';

import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { FieldShell, ValuePreview } from '@/components/shared/form-field-primitives';

type BaseImageFieldProps<TValue> = {
  label?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
  value?: TValue;
  onChange?: (value: TValue) => void;
};

export type AppImagePairFieldProps = BaseImageFieldProps<{
  front: string | null;
  back: string | null;
}> & {
  frontErrorText?: string;
  backErrorText?: string;
};

export type AppImageFieldProps = BaseImageFieldProps<string | null>;
export type AppImageMultipleFieldProps = BaseImageFieldProps<string[]>;
export type AppInsuranceImagesFieldProps = BaseImageFieldProps<string[]>;

function ResetButton<TValue>({
  disabled,
  emptyValue,
  onChange,
}: {
  disabled?: boolean;
  emptyValue: TValue;
  onChange?: (value: TValue) => void;
}) {
  const { t } = useTranslation();
  return (
    <AppButton
      title={t('common.clear')}
      size="xs"
      variant="ghost"
      kind="text"
      disabled={disabled}
      onPress={() => onChange?.(emptyValue)}
    />
  );
}

export default function AppImagePairField({
  label,
  helperText,
  errorText,
  frontErrorText,
  backErrorText,
  required,
  disabled,
  value,
  onChange,
}: AppImagePairFieldProps) {
  const { t } = useTranslation();
  const current = value ?? { front: null, back: null };

  return (
    <FieldShell label={label} required={required} helperText={helperText} errorText={errorText}>
      <AppView gap={10}>
        <ValuePreview
          emptyLabel={t('fields.noImagesSelected')}
          lines={[
            current.front ? `Front: ${current.front}` : '',
            current.back ? `Back: ${current.back}` : '',
            frontErrorText ? `Front error: ${frontErrorText}` : '',
            backErrorText ? `Back error: ${backErrorText}` : '',
          ]}
        />
        <ResetButton
          disabled={disabled}
          emptyValue={{ front: null, back: null }}
          onChange={onChange}
        />
      </AppView>
    </FieldShell>
  );
}

export function AppImageField({
  label,
  helperText,
  errorText,
  required,
  disabled,
  value,
  onChange,
}: AppImageFieldProps) {
  const { t } = useTranslation();
  return (
    <FieldShell label={label} required={required} helperText={helperText} errorText={errorText}>
      <AppView gap={10}>
        <AppText textVariant="bodyXs" muted>
          {value || t('fields.noImageSelected')}
        </AppText>
        <ResetButton disabled={disabled} emptyValue={null} onChange={onChange} />
      </AppView>
    </FieldShell>
  );
}

export function AppImageMultipleField({
  label,
  helperText,
  errorText,
  required,
  disabled,
  value = [],
  onChange,
}: AppImageMultipleFieldProps) {
  const { t } = useTranslation();
  return (
    <FieldShell label={label} required={required} helperText={helperText} errorText={errorText}>
      <AppView gap={10}>
        <ValuePreview emptyLabel={t('fields.noImagesSelected')} lines={value} />
        <ResetButton disabled={disabled} emptyValue={[]} onChange={onChange} />
      </AppView>
    </FieldShell>
  );
}

export function AppInsuranceImagesField(props: AppInsuranceImagesFieldProps) {
  return <AppImageMultipleField {...props} />;
}
