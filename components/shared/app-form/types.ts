import type { MutableRefObject, ReactNode } from 'react';
import type {
  FieldValues,
  RegisterOptions,
  UseFormReturn,
  UseFormStateReturn,
} from 'react-hook-form';
import type { ZodTypeAny } from 'zod';

import type { AppAccessoriesFieldProps } from '@/components/shared/app-accessories-field';
import type { AppColorFieldProps } from '@/components/shared/app-color-field';
import type { AppColorPickerFieldProps } from '@/components/shared/app-color-picker-field';
import type { AppDateFieldProps } from '@/components/shared/app-date-field';
import type { Family } from '@/components/shared/app-icon';
import type {
  AppImageFieldProps,
  AppImageMultipleFieldProps,
  AppImagePairFieldProps,
  AppInsuranceImagesFieldProps,
} from '@/components/shared/app-image-field';
import type { AppListItemProps } from '@/components/shared/app-list-item';
import type { AppPhoneTextFieldProps } from '@/components/shared/app-phone-text-field';
import type { AppPriceInputProps } from '@/components/shared/app-price-input';
import type { AppRadioGroupProps } from '@/components/shared/app-radio-group';
import type { AppRangeSliderProps } from '@/components/shared/app-range-slider';
import type { AppSegmentedControlProps } from '@/components/shared/app-segmented-control';
import type { AppSelectProps } from '@/components/shared/app-select';
import type { AppSelectableCardFieldProps } from '@/components/shared/app-selectable-card';
import type { AppSpinnerFieldProps } from '@/components/shared/app-spinner-field';
import type { AppTextAreaProps } from '@/components/shared/app-text-area';
import type { AppTextFieldProps } from '@/components/shared/app-text-field';
import type { AppTimeFieldProps } from '@/components/shared/app-time-field';
import type { ColorName } from '@/themes';
import type { FieldRegistry } from './field-registry';

export type FieldType =
  | 'text'
  | 'textarea'
  | 'price'
  | 'toggle'
  | 'segmented'
  | 'radio'
  | 'selectable-card'
  | 'select'
  | 'select-sheet'
  | 'spinner'
  | 'color'
  | 'color-picker'
  | 'range'
  | 'phone-dial'
  | 'date'
  | 'time'
  | 'location'
  | 'car-selection'
  | 'image-pair'
  | 'image'
  | 'image-multiple'
  | 'insurance-images'
  | 'accessories'
  | 'hidden'
  | 'label';

export type VisibleIfFn<TValues> = (values: TValues) => boolean;

type BaseFieldCommon<TValues, TType extends FieldType, TProps> = {
  name: keyof TValues & string;
  type: TType;
  label?: string;
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
  visibleIf?: VisibleIfFn<TValues>;
  rules?: RegisterOptions;
  props?: TProps;
};

type TextFieldProps = Partial<
  Omit<
    AppTextFieldProps,
    'value' | 'onChangeText' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
> & {
  rightAction?: 'clear';
  onRightIconPress?: () => void;
  /** Optional formatting function that transforms input text as user types */
  format?: (value: string) => string;
};

type PriceFieldProps = Partial<
  Omit<AppPriceInputProps, 'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'>
>;

type ToggleFieldProps = Partial<
  Pick<AppListItemProps, 'divider' | 'dividerInset' | 'allowFontScaling' | 'haptics'>
>;

type SegmentedFieldProps = Partial<
  Omit<AppSegmentedControlProps, 'value' | 'defaultValue' | 'onChange'>
> & {
  /** Convenience items array; converted to segmented control items internally */
  options?: { label: string; value: string | number }[];
  /** Optional: override label color above segmented control */
  labelColorName?: ColorName;
};

type SelectableCardFieldProps = Partial<
  Omit<
    AppSelectableCardFieldProps,
    'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
>;

type SelectFieldProps = Partial<
  Omit<AppSelectProps, 'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'>
>;

type SelectSheetFieldProps = {
  options?: Array<{ label: string; value: string | number }>;
  modalTitle?: string;
  /** Maximum snap point for modal (0-1), default 0.6 */
  snapMax?: number;
  /** Minimum height of the modal in pixels, default 360 */
  minHeight?: number;
  /** Optional: override placeholder/inactive text color */
  inactiveTextColorName?: ColorName;
};

type SpinnerFieldProps = Partial<
  Omit<
    AppSpinnerFieldProps,
    'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
>;

type ColorFieldProps = Partial<
  Omit<AppColorFieldProps, 'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'>
>;

type ColorPickerFieldProps = Partial<
  Omit<
    AppColorPickerFieldProps,
    'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
>;

type RangeFieldProps = Partial<
  Omit<
    AppRangeSliderProps,
    'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
>;

type PhoneDialFieldProps = Partial<
  Omit<
    AppPhoneTextFieldProps,
    'value' | 'onChangeText' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
>;

type DateFieldProps = Partial<
  Omit<AppDateFieldProps, 'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'>
>;

type TimeFieldProps = Partial<
  Omit<AppTimeFieldProps, 'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'>
>;

type LocationFieldProps = {
  /** Initial latitude for prepopulating map */
  initialLatitude?: number | null;
  /** Initial longitude for prepopulating map */
  initialLongitude?: number | null;
  /** Callback when location is selected */
  onSelect?: (selection: { address: string; latitude: number; longitude: number }) => void;
  required?: boolean;
};

type CarSelectionFieldProps = {
  /** Navigation path to make selection screen */
  navigationPath?: string;
  required?: boolean;
  /** Optional: override label color token */
  labelColorName?: ColorName;

  /** Show the trailing disclosure arrow icon (default true). */
  showArrow?: boolean;

  /** Optional: override the trailing icon. */
  trailingIcon?: {
    family?: Family;
    name: string;
    size?: 'sm' | 'md' | 'lg' | number;
    colorName?: ColorName;
    color?: string;
  };
};

type ImagePairFieldProps = Partial<
  Omit<
    AppImagePairFieldProps,
    'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
>;
type ImageFieldProps = Partial<
  Omit<AppImageFieldProps, 'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'>
>;
type ImageMultipleFieldProps = Partial<
  Omit<
    AppImageMultipleFieldProps,
    'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
>;
type InsuranceImagesFieldProps = Partial<
  Omit<
    AppInsuranceImagesFieldProps,
    'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
>;
type AccessoriesFieldProps = Partial<
  Omit<
    AppAccessoriesFieldProps,
    'value' | 'onChange' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
>;
type TextAreaFieldProps = Partial<
  Omit<
    AppTextAreaProps,
    'value' | 'onChange' | 'onChangeText' | 'label' | 'helperText' | 'errorText' | 'disabled'
  >
>;

export type TextField<TValues> = BaseFieldCommon<TValues, 'text', TextFieldProps>;

export type TextAreaField<TValues> = BaseFieldCommon<TValues, 'textarea', TextAreaFieldProps>;

export type PriceField<TValues> = BaseFieldCommon<TValues, 'price', PriceFieldProps>;

export type ToggleField<TValues> = BaseFieldCommon<TValues, 'toggle', ToggleFieldProps>;

export type SegmentedField<TValues> = BaseFieldCommon<TValues, 'segmented', SegmentedFieldProps>;

export type RadioFieldProps = Omit<AppRadioGroupProps, 'value' | 'onChange'> & {
  onChangeSideEffect?: (value: string) => void;
};
export type RadioField<TValues> = BaseFieldCommon<TValues, 'radio', RadioFieldProps>;

export type SelectableCardField<TValues> = BaseFieldCommon<
  TValues,
  'selectable-card',
  SelectableCardFieldProps
>;

export type SelectField<TValues> = BaseFieldCommon<TValues, 'select', SelectFieldProps>;

export type SelectSheetField<TValues> = BaseFieldCommon<
  TValues,
  'select-sheet',
  SelectSheetFieldProps
>;

export type SpinnerField<TValues> = BaseFieldCommon<TValues, 'spinner', SpinnerFieldProps>;

export type ColorField<TValues> = BaseFieldCommon<TValues, 'color', ColorFieldProps>;

export type ColorPickerField<TValues> = BaseFieldCommon<
  TValues,
  'color-picker',
  ColorPickerFieldProps
>;

export type RangeField<TValues> = BaseFieldCommon<TValues, 'range', RangeFieldProps>;

export type PhoneDialField<TValues> = BaseFieldCommon<TValues, 'phone-dial', PhoneDialFieldProps>;

export type DateField<TValues> = BaseFieldCommon<TValues, 'date', DateFieldProps>;

export type TimeField<TValues> = BaseFieldCommon<TValues, 'time', TimeFieldProps>;

export type LocationField<TValues> = BaseFieldCommon<TValues, 'location', LocationFieldProps>;

export type CarSelectionField<TValues> = BaseFieldCommon<
  TValues,
  'car-selection',
  CarSelectionFieldProps
>;

export type ImagePairField<TValues> = BaseFieldCommon<TValues, 'image-pair', ImagePairFieldProps>;
export type ImageField<TValues> = BaseFieldCommon<TValues, 'image', ImageFieldProps>;
export type ImageMultipleField<TValues> = BaseFieldCommon<
  TValues,
  'image-multiple',
  ImageMultipleFieldProps
>;
export type InsuranceImagesField<TValues> = BaseFieldCommon<
  TValues,
  'insurance-images',
  InsuranceImagesFieldProps
>;
export type AccessoriesField<TValues> = BaseFieldCommon<
  TValues,
  'accessories',
  AccessoriesFieldProps
>;

/** Hidden field - stores value in form state without rendering UI */
export type HiddenField<TValues> = {
  name: keyof TValues & string;
  type: 'hidden';
};

/** Label field - displays a section header without any input */
export type LabelField<TValues> = {
  name: keyof TValues & string;
  type: 'label';
  label?: string;
  helperText?: string;
};

export type RowField<TValues> = {
  type: 'row';
  gap?: number;
  fields: Array<AnyField<TValues> & { schema?: ZodTypeAny }>;
};

export type AnyField<TValues> =
  | TextField<TValues>
  | TextAreaField<TValues>
  | PriceField<TValues>
  | ToggleField<TValues>
  | SegmentedField<TValues>
  | RadioField<TValues>
  | SelectableCardField<TValues>
  | SelectField<TValues>
  | SelectSheetField<TValues>
  | SpinnerField<TValues>
  | ColorField<TValues>
  | ColorPickerField<TValues>
  | RangeField<TValues>
  | PhoneDialField<TValues>
  | DateField<TValues>
  | TimeField<TValues>
  | LocationField<TValues>
  | CarSelectionField<TValues>
  | ImagePairField<TValues>
  | ImageField<TValues>
  | ImageMultipleField<TValues>
  | InsuranceImagesField<TValues>
  | AccessoriesField<TValues>
  | HiddenField<TValues>
  | LabelField<TValues>
  | RowField<TValues>;

export type FormConfig<TValues> = {
  fields: (AnyField<TValues> | RowField<TValues>)[];
  sections?: { title?: string; description?: string; fields: (keyof TValues & string)[] }[];
};

export type AppFormProps<TValues extends FieldValues> = {
  config: FormConfig<TValues>;
  defaultValues: TValues;
  schema?: ZodTypeAny;
  onSubmit: (values: TValues) => void | Promise<void>;
  onChange?: (values: TValues) => void;
  mode?: 'onBlur' | 'onChange' | 'onSubmit';
  disabled?: boolean;
  submitLabel?: string;
  /**
   * Footer can be a node or a render function. When a function is provided,
   * it will receive helpers to trigger submit and access form state/methods.
   */
  footer?:
    | ReactNode
    | ((ctx: {
        submit: () => void;
        formState: UseFormStateReturn<TValues>;
        methods: UseFormReturn<TValues>;
      }) => ReactNode);
  /** Optional registry override to swap field renderers */
  registry?: Partial<FieldRegistry>;

  /** Vertical spacing between fields (non-section forms). Default is 8. */
  fieldGap?: number;

  /** Vertical spacing between fields inside sections. Default is 8. */
  sectionFieldGap?: number;

  /**
   * Optional ref that receives the underlying React Hook Form methods.
   * Use this to call `trigger()`, `setError()`, `getValues()`, etc. from outside.
   */
  formRef?: MutableRefObject<UseFormReturn<any> | null>;
};
