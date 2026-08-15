import React from 'react';
import {
  Controller,
  useFormContext,
  type Control,
  type FieldValues,
  type Path,
} from 'react-hook-form';

import { AppCarSelectionField } from '@/components/shared/app-car-selection-field';
import { FieldMessages } from '@/components/shared/app-form/field-messages';
import { AppListItem } from '@/components/shared/app-list-item';
import { AppPriceInput } from '@/components/shared/app-price-input';
import { AppRadioGroup } from '@/components/shared/app-radio-group';
import { AppRangeSlider } from '@/components/shared/app-range-slider';
import { AppSegmentedControl } from '@/components/shared/app-segmented-control';
import { AppSelect } from '@/components/shared/app-select';
import { AppText } from '@/components/shared/app-text';
import { AppTextArea } from '@/components/shared/app-text-area';
import { AppTextField } from '@/components/shared/app-text-field';
import { AppView } from '@/components/shared/app-view';
import { debugLog } from '@/services/debug-log';
import { modalService } from '@/services/global-modal-service/global-modal.service';
import AppAccessoriesField from '../app-accessories-field';
import { AppColorField } from '../app-color-field';
import AppColorPickerField from '../app-color-picker-field';
import AppDateField from '../app-date-field';
import AppImagePairField, {
  AppImageField,
  AppImageMultipleField,
  AppInsuranceImagesField,
} from '../app-image-field';
import { AppLocationField } from '../app-location-field';
import { AppPhoneTextField } from '../app-phone-text-field';
import AppSelectSheetField from '../app-select-sheet-field';
import { AppSelectableCardField } from '../app-selectable-card';
import AppSpinnerField from '../app-spinner-field/app-spinner-field';
import { AppTimeField } from '../app-time-field';
import type { AnyField, FieldType } from './types';
// Note: keep renderers UI-light; styling is delegated to shared components

export type FieldRendererProps<TValues extends FieldValues, TField extends AnyField<TValues>> = {
  field: TField;
  control: Control<TValues>;
  disabled?: boolean;
};

export type FieldRenderer<TKey extends FieldType> = <TValues extends FieldValues>(
  props: FieldRendererProps<TValues, Extract<AnyField<TValues>, { type: TKey }>>,
) => React.ReactElement | null;

export type FieldRegistry = { [K in FieldType]: FieldRenderer<K> };

function resolveName<TValues extends FieldValues>(name: keyof TValues & string) {
  return name as Path<TValues>;
}

// Simple Text input using AppTextField for layout + native input via props.render
export const TextFieldRenderer: FieldRenderer<'text'> = ({ field, control, disabled }) => {
  return (
    <Controller
      control={control}
      name={resolveName(field.name)}
      rules={field.rules as any}
      render={({ field: rhf, fieldState }) => {
        const isDisabled = disabled ?? field.disabled;
        const rightAction = field.props?.rightAction;
        const onRightIconPress =
          rightAction === 'clear' ? () => rhf.onChange('') : field.props?.onRightIconPress;
        // Handle format prop if provided
        const formatFn = field.props?.format;
        const handleChangeText = (text: string) => {
          if (formatFn && typeof formatFn === 'function') {
            const formatted = formatFn(text);
            rhf.onChange(formatted);
          } else {
            rhf.onChange(text);
          }
        };

        // Hidden field if label and placeholder are empty
        if (!field.label && !field.placeholder) {
          return <></>;
        }

        return (
          <AppTextField
            label={field.label}
            placeholder={field.placeholder}
            helperText={field.helperText}
            errorText={fieldState.error?.message}
            required={false}
            value={(rhf.value as any) ?? ''}
            onChangeText={handleChangeText}
            onBlur={rhf.onBlur as any}
            disabled={isDisabled}
            onRightIconPress={onRightIconPress}
            {...field.props}
          />
        );
      }}
    />
  );
};

// TextArea field for multiline input
export const TextAreaFieldRenderer: FieldRenderer<'textarea'> = ({ field, control, disabled }) => {
  return (
    <Controller
      control={control}
      name={resolveName(field.name)}
      rules={field.rules as any}
      render={({ field: rhf, fieldState }) => {
        const isDisabled = disabled ?? field.disabled;

        return (
          <AppTextArea
            label={field.label}
            placeholder={field.placeholder}
            helperText={field.helperText}
            errorText={fieldState.error?.message}
            value={(rhf.value as any) ?? ''}
            onChangeText={rhf.onChange as any}
            onBlur={rhf.onBlur as any}
            disabled={isDisabled}
            {...field.props}
          />
        );
      }}
    />
  );
};

// Price input: delegate formatting/parsing through props.format/parse; fallback to plain string
export const PriceFieldRenderer: FieldRenderer<'price'> = ({ field, control, disabled }) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppPriceInput
          value={rhf.value as any}
          onChange={rhf.onChange as any}
          label={field.label}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          disabled={isDisabled}
          {...field.props}
        />
      );
    }}
  />
);

// Toggle (boolean)
export const ToggleFieldRenderer: FieldRenderer<'toggle'> = ({ field, control, disabled }) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppView gap={4} colorName="formFieldBg" rounded={16}>
          <AppListItem
            title={field.label ?? field.name}
            subtitle={fieldState.error ? undefined : field.helperText}
            subtitleVariant="caption"
            subtitleColorName="muted"
            rightSwitchValue={!!rhf.value}
            onRightSwitchChange={(value) => {
              rhf.onChange(value);
              rhf.onBlur();
            }}
            disabled={isDisabled}
            divider
            {...field.props}
          />
          <FieldMessages errorText={fieldState.error?.message} />
        </AppView>
      );
    }}
  />
);

// Radio Group
export const RadioFieldRenderer: FieldRenderer<'radio'> = ({ field, control, disabled }) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppRadioGroup
          label={field.label}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          value={rhf.value as string}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
            field.props?.onChangeSideEffect?.(val);
          }}
          disabled={isDisabled}
          options={field.props?.options ?? []}
        />
      );
    }}
  />
);

// Segmented (single select)
export const SegmentedFieldRenderer: FieldRenderer<'segmented'> = ({
  field,
  control,
  disabled,
}) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      const items =
        field.props?.items ??
        field.props?.options?.map((option) => ({ value: option.value, label: option.label })) ??
        [];
      return (
        <AppView gap={6}>
          {field.label ? (
            <AppText
              textVariant="bodySemibold"
              colorName={fieldState.error ? 'error' : (field.props?.labelColorName ?? 'text')}
              weight="semibold"
            >
              {field.label}
            </AppText>
          ) : null}
          <AppSegmentedControl
            items={items}
            value={rhf.value as any}
            onChange={(next) => {
              if (!isDisabled) {
                rhf.onChange(next);
                rhf.onBlur();
              }
            }}
            {...field.props}
          />
          <FieldMessages helperText={field.helperText} errorText={fieldState.error?.message} />
        </AppView>
      );
    }}
  />
);

// Selectable Card (modern card-based single select)
export const SelectableCardFieldRenderer: FieldRenderer<'selectable-card'> = ({
  field,
  control,
  disabled,
}) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppSelectableCardField
          label={field.label}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          required={false}
          options={field.props?.options ?? []}
          value={rhf.value as any}
          onChange={(next) => {
            if (!isDisabled) {
              rhf.onChange(next);
              rhf.onBlur();
            }
          }}
          disabled={isDisabled}
          {...field.props}
        />
      );
    }}
  />
);
export const SelectFieldRenderer: FieldRenderer<'select'> = ({ field, control, disabled }) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppSelect
          value={rhf.value as any}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          label={field.label}
          placeholder={field.placeholder}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          disabled={isDisabled}
          {...field.props}
        />
      );
    }}
  />
);

// SelectSheet field - simple bottom sheet with clean list
export const SelectSheetFieldRenderer: FieldRenderer<'select-sheet'> = ({
  field,
  control,
  disabled,
}) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppSelectSheetField
          value={rhf.value as any}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          label={field.label}
          required={false}
          placeholder={field.placeholder}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          disabled={isDisabled}
          options={(field.props as any)?.options ?? []}
          modalTitle={(field.props as any)?.modalTitle}
          snapMax={(field.props as any)?.snapMax}
          minHeight={(field.props as any)?.minHeight}
          inactiveTextColorName={(field.props as any)?.inactiveTextColorName}
        />
      );
    }}
  />
);

export const SpinnerFieldRenderer: FieldRenderer<'spinner'> = ({ field, control, disabled }) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppSpinnerField
          value={rhf.value as any}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          label={field.label}
          required={false}
          placeholder={field.placeholder}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          disabled={isDisabled}
          options={(field.props as any)?.options ?? []}
          {...field.props}
        />
      );
    }}
  />
);

export const ColorFieldRenderer: FieldRenderer<'color'> = ({ field, control, disabled }) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppColorField
          value={rhf.value as any}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          label={field.label}
          placeholder={field.placeholder}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          disabled={isDisabled}
          options={(field.props as any)?.options ?? []}
          {...field.props}
        />
      );
    }}
  />
);

export const ColorPickerFieldRenderer: FieldRenderer<'color-picker'> = ({
  field,
  control,
  disabled,
}) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppColorPickerField
          value={rhf.value as any}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          label={field.label}
          required={false}
          helperText={field.helperText}
          error={fieldState.error?.message}
          disabled={isDisabled}
          options={(field.props as any)?.options ?? []}
          {...field.props}
        />
      );
    }}
  />
);

export const RangeFieldRenderer: FieldRenderer<'range'> = ({ field, control, disabled }) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppRangeSlider
          min={field.props?.min ?? 0}
          max={field.props?.max ?? 100}
          step={field.props?.step ?? 1}
          value={(rhf.value as any) ?? [field.props?.min ?? 0, field.props?.max ?? 100]}
          onChange={rhf.onChange as any}
          onChangeEnd={field.props?.onChangeEnd}
          label={field.label}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          required={false}
          disabled={isDisabled}
          {...field.props}
        />
      );
    }}
  />
);

// Phone with embedded dial code renderer (fixed to +998 for Uzbekistan)
export const PhoneDialFieldRenderer: FieldRenderer<'phone-dial'> = ({
  field,
  control,
  disabled,
}) => {
  const methods = useFormContext();
  return (
    <Controller
      control={control}
      name={resolveName(field.name)}
      rules={field.rules as any}
      render={({ field: rhf, fieldState }) => {
        const isDisabled = disabled ?? field.disabled;
        return (
          <AppPhoneTextField
            label={field.label}
            placeholder={field.placeholder}
            helperText={field.helperText}
            errorText={fieldState.error?.message}
            required={Boolean((field.props as any)?.required)}
            value={(rhf.value as any) ?? ''}
            onChangeText={(text) => {
              rhf.onChange(text);
              // Keep the hidden phoneCode field in sync (+998). Log instead of
              // silently swallowing — a broken field name would otherwise let a
              // phone submit without its dialing code with zero signal.
              try {
                (methods.setValue as any)('phoneCode', '+998');
              } catch (err) {
                debugLog('form', 'phoneCode sync failed', { message: (err as Error)?.message });
              }
            }}
            onBlur={rhf.onBlur as any}
            disabled={isDisabled}
            {...(field.props as any)}
          />
        );
      }}
    />
  );
};
export const DateFieldRenderer: FieldRenderer<'date'> = ({ field, control, disabled }) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppDateField
          label={field.label}
          placeholder={field.placeholder}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          required={false}
          value={(rhf.value as any) ?? ''}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          disabled={isDisabled}
          {...(field.props as any)}
        />
      );
    }}
  />
);

export const TimeFieldRenderer: FieldRenderer<'time'> = ({ field, control, disabled }) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppTimeField
          label={field.label}
          placeholder={field.placeholder}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          required={false}
          value={(rhf.value as any) ?? ''}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          disabled={isDisabled}
          {...(field.props as any)}
        />
      );
    }}
  />
);

export const LocationFieldRenderer: FieldRenderer<'location'> = ({ field, control, disabled }) => {
  return (
    <Controller
      control={control}
      name={resolveName(field.name)}
      rules={field.rules as any}
      render={({ field: rhf, fieldState }) => {
        const isDisabled = disabled ?? field.disabled;
        const fieldProps = field.props as any;
        const methods = useFormContext();

        // Value is just the address string
        const displayValue = (rhf.value as any) || '';

        // Read current coordinates from form state (not initial props) for proper display
        const currentLatitude = methods.watch('latitude') as number | null;
        const currentLongitude = methods.watch('longitude') as number | null;
        const coordinates =
          currentLatitude != null && currentLongitude != null
            ? { latitude: currentLatitude, longitude: currentLongitude }
            : null;

        // Optional callback from field.props for additional actions (e.g., store updates)
        const userOnSelect = fieldProps?.onSelect;

        return (
          <AppLocationField
            label={field.label}
            placeholder={field.placeholder}
            helperText={field.helperText}
            errorText={fieldState.error?.message}
            required={Boolean(fieldProps?.required)}
            value={displayValue}
            coordinates={coordinates}
            onChange={(address, coords) => {
              // If address is empty (clearing), set all fields to null/empty
              if (!address) {
                // Update all 3 form fields
                methods.setValue('latitude', null);
                methods.setValue('longitude', null);
                rhf.onChange('');
                rhf.onBlur();

                // Call optional user callback (e.g., for store updates)
                userOnSelect?.({
                  address: '',
                  latitude: null as any,
                  longitude: null as any,
                });
              }
              // Otherwise update all fields with new values
              else if (coords) {
                // Update all 3 form fields
                methods.setValue('latitude', coords.latitude);
                methods.setValue('longitude', coords.longitude);
                rhf.onChange(address);
                rhf.onBlur();

                // Call optional user callback (e.g., for store updates)
                userOnSelect?.({
                  address,
                  latitude: coords.latitude,
                  longitude: coords.longitude,
                });
              }
            }}
            disabled={isDisabled}
            {...fieldProps}
          />
        );
      }}
    />
  );
};

export const ImagePairFieldRenderer: FieldRenderer<'image-pair'> = ({
  field,
  control,
  disabled,
}) => {
  const { formState } = useFormContext();
  const fieldErrors = (formState.errors as any) ?? {};
  const nestedErrors = fieldErrors?.[field.name as string] ?? {};
  const frontErrorText = nestedErrors?.front?.message as string | undefined;
  const backErrorText = nestedErrors?.back?.message as string | undefined;

  return (
    <Controller
      control={control}
      name={resolveName(field.name)}
      rules={field.rules as any}
      render={({ field: rhf, fieldState }) => {
        const isDisabled = disabled ?? field.disabled;
        return (
          <AppImagePairField
            label={field.label}
            helperText={field.helperText}
            errorText={fieldState.error?.message}
            frontErrorText={frontErrorText}
            backErrorText={backErrorText}
            required={false}
            value={(rhf.value as any) ?? { front: null, back: null }}
            onChange={(val: any) => {
              rhf.onChange(val);
              rhf.onBlur();
            }}
            disabled={isDisabled}
            {...(field.props as any)}
          />
        );
      }}
    />
  );
};

export const ImageFieldRenderer: FieldRenderer<'image'> = ({ field, control, disabled }) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppImageField
          label={field.label}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          required={false}
          value={(rhf.value as any) ?? null}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          disabled={isDisabled}
          {...(field.props as any)}
        />
      );
    }}
  />
);

export const ImageMultipleFieldRenderer: FieldRenderer<'image-multiple'> = ({
  field,
  control,
  disabled,
}) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppImageMultipleField
          label={field.label}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          required={false}
          value={(rhf.value as any) ?? []}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          disabled={isDisabled}
          {...(field.props as any)}
        />
      );
    }}
  />
);

export const InsuranceImagesFieldRenderer: FieldRenderer<'insurance-images'> = ({
  field,
  control,
  disabled,
}) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppInsuranceImagesField
          label={field.label}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          required={false}
          value={(rhf.value as any) ?? []}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          disabled={isDisabled}
          {...(field.props as any)}
        />
      );
    }}
  />
);

export const AccessoriesFieldRenderer: FieldRenderer<'accessories'> = ({
  field,
  control,
  disabled,
}) => (
  <Controller
    control={control}
    name={resolveName(field.name)}
    rules={field.rules as any}
    render={({ field: rhf, fieldState }) => {
      const isDisabled = disabled ?? field.disabled;
      return (
        <AppAccessoriesField
          label={field.label}
          helperText={field.helperText}
          errorText={fieldState.error?.message}
          value={(rhf.value as any) ?? []}
          onChange={(val: any) => {
            rhf.onChange(val);
            rhf.onBlur();
          }}
          disabled={isDisabled}
          options={(field.props as any)?.options ?? []}
          modalTitle={(field.props as any)?.modalTitle}
          maxSelections={(field.props as any)?.maxSelections}
          addButtonText={(field.props as any)?.addButtonText}
          addMoreButtonText={(field.props as any)?.addMoreButtonText}
        />
      );
    }}
  />
);

export const CarSelectionFieldRenderer: FieldRenderer<'car-selection'> = ({
  field,
  control,
  disabled,
}) => {
  return (
    <Controller
      control={control}
      name={resolveName(field.name)}
      rules={field.rules as any}
      render={({ field: rhf, fieldState }) => {
        const isDisabled = disabled ?? field.disabled;
        const methods = useFormContext();

        // This field controls selectedCarName, read current IDs from form state
        const currentSelectedCarName = (rhf.value as string) || '';
        // Read current IDs from form state (not initial props) for proper modal pre-selection
        const currentMakeId = (methods.watch('makeId') as string) || '';
        const currentModelId = (methods.watch('modelId') as string) || '';
        const currentTrimId = (methods.watch('trimId') as string) || '';

        // Optional callback from field.props for additional actions (e.g., store updates)
        const userOnSelect = (field.props as any)?.onSelect;
        const userOnClear = (field.props as any)?.onClear;

        return (
          <AppCarSelectionField
            label={field.label}
            labelColorName={(field.props as any)?.labelColorName}
            helperText={field.helperText}
            errorText={fieldState.error?.message}
            required={Boolean((field.props as any)?.required)}
            showArrow={(field.props as any)?.showArrow}
            trailingIcon={(field.props as any)?.trailingIcon}
            selectedCarName={currentSelectedCarName}
            onPress={() => {
              if (!isDisabled) {
                modalService.openModal('carSelection', {
                  initialMake: currentMakeId,
                  initialModel: currentModelId,
                  initialTrim: currentTrimId,
                  onSelect: (selection: {
                    makeId: string;
                    modelId: string;
                    trimId: string;
                    selectedCarName: string;
                  }) => {
                    // Update all 4 flat form fields
                    methods.setValue('makeId', selection.makeId);
                    methods.setValue('modelId', selection.modelId);
                    methods.setValue('trimId', selection.trimId);
                    rhf.onChange(selection.selectedCarName);
                    rhf.onBlur();

                    // Call optional user callback (e.g., for store updates)
                    userOnSelect?.(selection);
                  },
                });
              }
            }}
            onClear={() => {
              if (!isDisabled) {
                // Clear all 4 flat form fields
                methods.setValue('makeId', '');
                methods.setValue('modelId', '');
                methods.setValue('trimId', '');
                rhf.onChange('');
                rhf.onBlur();

                // Call optional user callback (e.g., for store updates)
                userOnClear?.();
              }
            }}
          />
        );
      }}
    />
  );
};

/**
 * Hidden field renderer - maintains value in form state without rendering any UI.
 * Useful for storing IDs or computed values that shouldn't be visible to users.
 */
export const HiddenFieldRenderer: FieldRenderer<'hidden'> = ({ field, control }) => {
  const fieldName = (field as { name: string }).name;
  return <Controller control={control} name={fieldName as any} render={() => <></>} />;
};

/**
 * Label field renderer - displays a section header/label without any input.
 * Useful for visually grouping fields within a step.
 */
export const LabelFieldRenderer: FieldRenderer<'label'> = ({ field }) => {
  const label = field.label ?? '';
  const helperText = field.helperText;
  return (
    <AppView pt={8}>
      <AppText textVariant="caption" colorName="muted" weight="medium">
        {label}
      </AppText>
      {helperText ? (
        <AppText textVariant="bodyXs" colorName="textSecondary" style={{ marginTop: 2 }}>
          {helperText}
        </AppText>
      ) : null}
    </AppView>
  );
};

export const defaultFieldRegistry: FieldRegistry = {
  text: TextFieldRenderer,
  textarea: TextAreaFieldRenderer,
  price: PriceFieldRenderer,
  toggle: ToggleFieldRenderer,
  segmented: SegmentedFieldRenderer,
  radio: RadioFieldRenderer,
  'selectable-card': SelectableCardFieldRenderer,
  select: SelectFieldRenderer,
  'select-sheet': SelectSheetFieldRenderer,
  spinner: SpinnerFieldRenderer,
  color: ColorFieldRenderer,
  'color-picker': ColorPickerFieldRenderer,
  range: RangeFieldRenderer,
  'phone-dial': PhoneDialFieldRenderer,
  date: DateFieldRenderer,
  time: TimeFieldRenderer,
  location: LocationFieldRenderer,
  'car-selection': CarSelectionFieldRenderer,
  'image-pair': ImagePairFieldRenderer,
  image: ImageFieldRenderer,
  'image-multiple': ImageMultipleFieldRenderer,
  'insurance-images': InsuranceImagesFieldRenderer,
  accessories: AccessoriesFieldRenderer,
  hidden: HiddenFieldRenderer,
  label: LabelFieldRenderer,
};

export type DefaultFieldType = keyof typeof defaultFieldRegistry;
