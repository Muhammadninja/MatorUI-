import React from 'react';
import {
  TextInput,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
} from 'react-native';

import { AppButton } from '@/components/shared/app-button';
import { AppChip } from '@/components/shared/app-chip';
import { FieldMessages } from '@/components/shared/app-form/field-messages';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import type { ColorName } from '@/themes';

export type FieldOption = {
  label: string;
  value: string | number;
  description?: string;
};

export type BaseFieldProps = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  disabled?: boolean;
};

export function FieldLabel({
  label,
  required,
  colorName = 'text',
}: {
  label?: string;
  required?: boolean;
  colorName?: ColorName;
}) {
  if (!label) return null;

  return (
    <AppView row align="center" gap={4}>
      <AppText textVariant="bodySemibold" colorName={colorName}>
        {label}
      </AppText>
      {required ? (
        <AppText textVariant="bodyXs" colorName={'error' as any}>
          *
        </AppText>
      ) : null}
    </AppView>
  );
}

export function FieldShell({
  label,
  required,
  helperText,
  errorText,
  children,
  labelColorName,
}: BaseFieldProps & {
  children: React.ReactNode;
  labelColorName?: ColorName;
}) {
  return (
    <AppView gap={8}>
      <FieldLabel label={label} required={required} colorName={labelColorName} />
      {children}
      <FieldMessages helperText={helperText} errorText={errorText} />
    </AppView>
  );
}

export function TextEntryField({
  label,
  helperText,
  errorText,
  required,
  disabled,
  value,
  onChangeText,
  onBlur,
  placeholder,
  multiline,
  numberOfLines,
  keyboardType,
  style,
  leftAdornment,
  rightAdornment,
  containerStyle,
  containerRounded = 16,
  containerPx = 14,
  containerPy = 12,
  containerColorName = 'card',
  containerBorderName,
  ...rest
}: BaseFieldProps &
  Pick<
    TextInputProps,
    | 'onBlur'
    | 'onFocus'
    | 'autoCapitalize'
    | 'autoCorrect'
    | 'secureTextEntry'
    | 'accessibilityLabel'
    | 'testID'
    | 'maxLength'
    | 'autoFocus'
    | 'textContentType'
  > & {
    value?: string;
    onChangeText?: (value: string) => void;
    multiline?: boolean;
    numberOfLines?: number;
    keyboardType?: KeyboardTypeOptions;
    style?: StyleProp<TextStyle>;
    leftAdornment?: React.ReactNode;
    rightAdornment?: React.ReactNode;
    containerStyle?: React.ComponentProps<typeof AppView>['style'];
    containerRounded?: number;
    containerPx?: number;
    containerPy?: number;
    containerColorName?: ColorName;
    containerBorderName?: ColorName;
  }) {
  const { tokens } = useThemeContext();

  return (
    <FieldShell label={label} required={required} helperText={helperText} errorText={errorText}>
      <AppView
        row
        align={multiline ? 'flex-start' : 'center'}
        gap={8}
        px={containerPx}
        py={containerPy}
        rounded={containerRounded}
        colorName={containerColorName}
        borderWidth={1}
        borderName={errorText ? ('error' as any) : (containerBorderName ?? 'border')}
        style={[disabled ? { opacity: 0.6 } : undefined, containerStyle]}
      >
        {leftAdornment}
        <TextInput
          value={value ?? ''}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={tokens.gray400}
          editable={!disabled}
          multiline={multiline}
          numberOfLines={numberOfLines}
          keyboardType={keyboardType}
          style={[
            {
              flex: 1,
              minHeight: multiline ? 100 : undefined,
              color: tokens.text,
              fontSize: 16,
              padding: 0,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            style,
          ]}
          {...rest}
        />
        {rightAdornment}
      </AppView>
    </FieldShell>
  );
}

export function ChoiceField({
  label,
  helperText,
  errorText,
  required,
  disabled,
  options,
  value,
  onChange,
  multiple,
  selectedKind = 'primary',
}: BaseFieldProps & {
  options: FieldOption[];
  value?: string | number | Array<string | number> | null;
  onChange?: (value: string | number | Array<string | number>) => void;
  multiple?: boolean;
  selectedKind?: 'primary' | 'secondary';
}) {
  const current = multiple
    ? Array.isArray(value)
      ? value
      : []
    : [value as string | number | undefined];

  return (
    <FieldShell label={label} required={required} helperText={helperText} errorText={errorText}>
      <AppView row wrap gap={8}>
        {options.map((option) => {
          const isSelected = current.includes(option.value);
          return (
            <AppChip
              key={String(option.value)}
              label={option.label}
              kind={selectedKind}
              variant={isSelected ? 'solid' : 'outline'}
              selected={isSelected}
              disabled={disabled}
              onPress={() => {
                if (disabled) return;
                if (multiple) {
                  const next = isSelected
                    ? current.filter((item) => item !== option.value)
                    : [...current.filter(Boolean), option.value];
                  onChange?.(next as Array<string | number>);
                  return;
                }
                onChange?.(option.value);
              }}
            />
          );
        })}
      </AppView>
    </FieldShell>
  );
}

export function SelectTriggerField({
  label,
  helperText,
  errorText,
  required,
  disabled,
  valueLabel,
  placeholder,
  onPress,
  onClear,
  trailingLabel,
  labelColorName,
}: BaseFieldProps & {
  valueLabel?: string;
  onPress?: () => void;
  onClear?: () => void;
  trailingLabel?: string;
  labelColorName?: ColorName;
}) {
  const isEmpty = !valueLabel;

  return (
    <FieldShell
      labelColorName={labelColorName}
      label={label}
      required={required}
      helperText={helperText}
      errorText={errorText}
    >
      <AppPressableView
        row
        align="center"
        justify="space-between"
        gap={12}
        px={14}
        py={14}
        rounded={16}
        colorName="card"
        borderWidth={1}
        borderName={errorText ? ('error' as any) : 'border'}
        disabled={disabled}
        onPress={onPress}
      >
        <AppView flex={1}>
          <AppText textVariant="bodySm" colorName={isEmpty ? ('gray400' as any) : 'text'}>
            {valueLabel || placeholder || 'Select an option'}
          </AppText>
        </AppView>
        <AppView row align="center" gap={8}>
          {trailingLabel ? (
            <AppText textVariant="bodyXs" muted>
              {trailingLabel}
            </AppText>
          ) : null}
          {onClear && valueLabel ? (
            <AppButton title="Clear" size="xs" variant="ghost" kind="text" onPress={onClear} />
          ) : null}
        </AppView>
      </AppPressableView>
    </FieldShell>
  );
}

export function ValuePreview({
  title,
  lines,
  emptyLabel,
}: {
  title?: string;
  lines: string[];
  emptyLabel: string;
}) {
  const content = lines.filter(Boolean);

  return (
    <AppView gap={6}>
      {title ? <AppText textVariant="bodySm">{title}</AppText> : null}
      <AppView gap={4}>
        {content.length ? (
          content.map((line, index) => (
            <AppText key={`${line}-${index}`} textVariant="bodyXs" muted>
              {line}
            </AppText>
          ))
        ) : (
          <AppText textVariant="bodyXs" muted>
            {emptyLabel}
          </AppText>
        )}
      </AppView>
    </AppView>
  );
}
