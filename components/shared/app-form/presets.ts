import type { FieldDef } from './define-form';

type CommonOpts<TValues> = {
  label?: string;
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
  defaultValue?: any;
  /** Additional renderer props; kept loose to avoid leaking internal types */
  props?: Record<string, any>;
};

/** Numeric one-time code input (OTP) */
export function codeField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & { length?: number } = {},
): FieldDef<TValues> {
  const {
    label = 'Code',
    placeholder = 'Enter the code',
    defaultValue = '',
    helperText,
    disabled,
    props,
    length = 6,
  } = opts;
  return {
    name,
    type: 'text' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      keyboardType: 'number-pad',
      textContentType: 'oneTimeCode',
      autoComplete: 'one-time-code',
      returnKeyType: 'done',
      maxLength: length,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Secure password input */
export function passwordField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    textContentType?: 'password' | 'newPassword';
    returnKeyType?: 'next' | 'done';
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Password',
    placeholder = 'Enter your password',
    defaultValue = '',
    helperText,
    disabled,
    props,
    textContentType = 'newPassword',
    returnKeyType = 'next',
  } = opts;
  return {
    name,
    type: 'text' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      secureTextEntry: true,
      textContentType,
      autoComplete: 'password',
      returnKeyType,
      leftIcon: { family: 'material', name: 'lock', size: 'sm', colorName: 'white' },
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Confirm password input (secure) */
export function confirmPasswordField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & { returnKeyType?: 'next' | 'done' } = {},
): FieldDef<TValues> {
  const {
    label = 'Confirm Password',
    placeholder = 'Re-enter your password',
    defaultValue = '',
    helperText,
    disabled,
    props,
    returnKeyType = 'done',
  } = opts;
  return {
    name,
    type: 'text' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      secureTextEntry: true,
      textContentType: 'password',
      autoComplete: 'password',
      returnKeyType,
      leftIcon: { family: 'material', name: 'lock', size: 'sm', colorName: 'white' },
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Email input with proper keyboard + auto-complete */
export function emailField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    autoCapitalize?: 'none' | 'words' | 'sentences' | 'characters';
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Email address',
    placeholder = 'Enter your email',
    defaultValue = '',
    helperText,
    disabled,
    props,
    autoCapitalize = 'none',
  } = opts;
  const leftIcon = { family: 'material', name: 'mail', size: 'sm', colorName: 'white' };
  return {
    name,
    type: 'text' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      keyboardType: 'email-address',
      textContentType: 'emailAddress',
      autoComplete: 'email',
      autoCapitalize,
      autoCorrect: false,
      returnKeyType: 'default',
      ...(props ?? {}),
      leftIcon,
    },
  } as FieldDef<TValues>;
}

/** Phone input with embedded country dial code (modal selection). Stores only the local number in the form. */
export function phoneDialField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & { defaultDialCode?: string; showPhoneIcon?: boolean } = {},
): FieldDef<TValues> {
  const {
    label = 'Phone number',
    placeholder = 'Enter phone number',
    defaultValue = '',
    helperText,
    disabled,
    props,
    defaultDialCode = '+998',
    showPhoneIcon = true,
  } = opts;
  return {
    name,
    type: 'phone-dial' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      defaultDialCode,
      showPhoneIcon,
      returnKeyType: 'default',
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Username input: no auto-correct/capitalize */
export function usernameField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & { autoCapitalize?: 'none' | 'characters' } = {},
): FieldDef<TValues> {
  const {
    label = 'Username',
    placeholder = 'yourname',
    defaultValue = '',
    helperText,
    disabled,
    props,
    autoCapitalize = 'none',
  } = opts;
  return {
    name,
    type: 'text' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      autoCapitalize,
      autoCorrect: false,
      returnKeyType: 'next',
      ...props,
    },
  } as FieldDef<TValues>;
}

/**
 * Hidden field - stores a value in form state without rendering any UI.
 * Useful for storing IDs, computed values, or data that shouldn't be visible.
 */
export function hiddenField<TValues>(
  name: keyof TValues & string,
  opts: Pick<CommonOpts<TValues>, 'defaultValue'> = {},
): FieldDef<TValues> {
  const { defaultValue = '' } = opts;
  return {
    name,
    type: 'hidden' as const,
    defaultValue,
  } as FieldDef<TValues>;
}

/** Generic text input field */
export function textField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    maxLength?: number;
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    returnKeyType?: 'next' | 'done' | 'default';
  } = {},
): FieldDef<TValues> {
  const {
    label,
    placeholder,
    defaultValue = '',
    helperText,
    disabled,
    props,
    maxLength,
    autoCapitalize = 'sentences',
    returnKeyType = 'next',
  } = opts;
  return {
    name,
    type: 'text' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      autoCapitalize,
      returnKeyType,
      maxLength,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Generic numeric-only field (no decimals) */
export function numericField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & { maxLength?: number; returnKeyType?: 'next' | 'done' } = {},
): FieldDef<TValues> {
  const {
    label,
    placeholder,
    defaultValue = '',
    helperText,
    disabled,
    props,
    maxLength,
    returnKeyType = 'next',
  } = opts;
  return {
    name,
    type: 'text' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      keyboardType: 'decimal-pad',
      returnKeyType,
      maxLength,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Select (dropdown) with optional search and multiple */
export function selectField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    options?: { label: string; value: string | number }[];
    multiple?: boolean;
    searchable?: boolean;
    modalTitle?: string;
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Select',
    placeholder = 'Select…',
    helperText,
    disabled,
    defaultValue,
    props,
    options,
    multiple = false,
    searchable,
    modalTitle,
  } = opts;
  return {
    name,
    type: 'select' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue: defaultValue ?? (multiple ? [] : undefined),
    props: {
      options,
      multiple,
      searchable,
      modalTitle,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Selectable card field (modern card-based single select with checkmarks) */
export function selectableCardField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    options?: {
      label: string;
      value: string | number | boolean;
      icon?: { family?: string; name: string } | string;
      disabled?: boolean;
    }[];
    /** Layout direction: 'vertical' (default) or 'horizontal' */
    direction?: 'vertical' | 'horizontal';
    /** Gap between cards in pixels */
    gap?: number;
  } = {},
): FieldDef<TValues> {
  const {
    label,
    helperText,
    disabled,
    defaultValue,
    props,
    options = [],
    direction = 'vertical',
    gap,
  } = opts;

  // Normalize icon format
  const normalizedOptions = options.map((opt) => ({
    ...opt,
    icon: typeof opt.icon === 'string' ? { family: 'symbol' as const, name: opt.icon } : opt.icon,
  }));

  return {
    name,
    type: 'selectable-card' as const,
    label,
    helperText,
    disabled,
    defaultValue,
    props: {
      options: normalizedOptions,
      direction,
      gap,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Spinner picker field (iOS date-picker style for short lists) */
export function spinnerField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    options?: { label: string; value: string }[];
    /** Modal title (defaults to label if not provided) */
    modalTitle?: string;
    /** Maximum snap point for modal (0-1), default 0.45 */
    snapMax?: number;
    /** Minimum height of the modal in pixels, default 280 */
    minHeight?: number;
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Select',
    placeholder = 'Select…',
    helperText,
    disabled,
    defaultValue,
    props,
    options = [],
    modalTitle,
    snapMax,
    minHeight,
  } = opts;
  return {
    name,
    type: 'spinner' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue: defaultValue ?? '',
    props: {
      options,
      modalTitle,
      snapMax,
      minHeight,
      required: true,
      ...props,
    },
  } as FieldDef<TValues>;
}

/**
 * Creates a select-sheet field configuration.
 * Opens a clean bottom sheet modal with simple list selection.
 */
export function selectSheetField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    options?: { label: string; value: string | number }[];
    /** Modal title (defaults to label if not provided) */
    modalTitle?: string;
    /** Maximum snap point for modal (0-1), default 0.6 */
    snapMax?: number;
    /** Minimum height of the modal in pixels, default 360 */
    minHeight?: number;
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Select',
    placeholder = 'Select…',
    helperText,
    disabled,
    defaultValue,
    props,
    options = [],
    modalTitle,
    snapMax,
    minHeight,
  } = opts;
  return {
    name,
    type: 'select-sheet' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue: defaultValue ?? '',
    props: {
      options,
      modalTitle,
      snapMax,
      minHeight,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Color field (opens modal with color swatch grid) */
export function colorField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    options?: { label: string; value: string; hex: string }[];
    /** Modal title (defaults to label if not provided) */
    modalTitle?: string;
    /** Maximum snap point for modal (0-1), default 0.6 */
    snapMax?: number;
    /** Minimum height of the modal in pixels, default 400 */
    minHeight?: number;
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Color',
    placeholder = 'Select color',
    helperText,
    disabled,
    defaultValue,
    props,
    options = [],
    modalTitle,
    snapMax,
    minHeight,
  } = opts;
  return {
    name,
    type: 'color' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue: defaultValue ?? '',
    props: {
      options,
      modalTitle,
      snapMax,
      minHeight,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Color picker field with horizontal scroll and color images */
export function colorPickerField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    options?: Array<{
      label: string;
      value: any; // ImageSourcePropType from require()
    }>;
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Select',
    placeholder = 'Select…',
    helperText,
    disabled,
    defaultValue,
    props,
    options = [],
  } = opts;
  return {
    name,
    type: 'color-picker' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue: defaultValue ?? '',
    props: {
      options,
      required: true,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Multi-select convenience wrapper */
export function multiSelectField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    options?: { label: string; value: string | number }[];
    searchable?: boolean;
    modalTitle?: string;
  } = {},
): FieldDef<TValues> {
  return selectField(name, { ...opts, multiple: true, defaultValue: opts.defaultValue ?? [] });
}

/** Segmented control convenience using simple options */
export function segmentedField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & { options: { label: string; value: string | number }[] } & {
    size?: 'sm' | 'md' | 'lg';
    variant?: 'pill' | 'underline';
  } = { options: [] },
): FieldDef<TValues> {
  const {
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props,
    options,
    size = 'md',
    variant = 'pill',
  } = opts;
  return {
    name,
    type: 'segmented' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      options,
      size,
      variant,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Radio group preset for exclusive choice with descriptions */
export function radioField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    options: { label: string; value: string; description?: string; badge?: string }[];
  } = { options: [] },
): FieldDef<TValues> {
  const { label, helperText, disabled, defaultValue, props, options } = opts;
  return {
    name,
    type: 'radio' as const,
    label,
    helperText,
    disabled,
    defaultValue,
    props: {
      options,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Date text field preset (pair with a date picker handler in screen or registry override) */
export function dateTextField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & { formatHint?: string; returnKeyType?: 'next' | 'done' } = {},
): FieldDef<TValues> {
  const {
    label = 'Date',
    placeholder = 'YYYY-MM-DD',
    helperText,
    disabled,
    defaultValue = '',
    props,
    formatHint = 'YYYY-MM-DD',
    returnKeyType = 'next',
  } = opts;
  return {
    name,
    type: 'text' as const,
    label,
    placeholder,
    helperText: helperText ?? formatHint,
    disabled,
    defaultValue,
    props: {
      keyboardType: 'numbers-and-punctuation',
      returnKeyType,
      rightIcon: { name: 'calendar' },
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Date picker field */
export function dateField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    minimumDate?: Date;
    maximumDate?: Date;
    mode?: 'date' | 'time' | 'datetime';
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Date',
    placeholder = 'DD/MM/YYYY',
    helperText,
    disabled,
    defaultValue = '',
    props,
    minimumDate,
    maximumDate,
    mode = 'date',
  } = opts;
  return {
    name,
    type: 'date' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      required: true,
      minimumDate,
      maximumDate,
      mode,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Time picker field */
export function timeField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    is24Hour?: boolean;
    parsePattern?: string;
    formatPattern?: string;
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Time',
    placeholder = '18:00',
    helperText,
    disabled,
    defaultValue = '',
    props,
    is24Hour = true,
    parsePattern = 'HH:mm',
    formatPattern = 'HH:mm',
  } = opts;
  return {
    name,
    type: 'time' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      is24Hour,
      parsePattern,
      formatPattern,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Location picker field with map selection */
export function locationField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> = {},
): FieldDef<TValues> {
  const {
    label = 'Location',
    placeholder = 'Select location',
    helperText,
    disabled,
    defaultValue = '',
    props,
  } = opts;
  return {
    name,
    type: 'location' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: props || {},
  } as FieldDef<TValues>;
}

/** Decimal number text field */
export function decimalField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & { returnKeyType?: 'next' | 'done' } = {},
): FieldDef<TValues> {
  const {
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue = '',
    props,
    returnKeyType = 'next',
  } = opts;
  return {
    name,
    type: 'text' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      keyboardType: 'decimal-pad',
      returnKeyType,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Multiline text area */
export function textareaField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    numberOfLines?: number;
    maxLength?: number;
    showCharacterCount?: boolean;
  } = {},
): FieldDef<TValues> {
  const {
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue = '',
    props,
    numberOfLines = 4,
    maxLength,
    showCharacterCount,
  } = opts;
  return {
    name,
    type: 'textarea' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      numberOfLines,
      maxLength,
      showCharacterCount,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Image pair upload (front/back document images) */
export function imagePairField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    width?: number;
    height?: number;
    pickerTitle?: string;
    swipeHintOnMount?: boolean;
    placeholderTexts?: [string, string];
    document?: {
      enabled: boolean;
      template: string;
    };
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Document Photos',
    helperText,
    disabled,
    defaultValue = { front: null, back: null },
    props,
    width = 300,
    height = 220,
    pickerTitle = 'Select Document Image',
    swipeHintOnMount = true,
    placeholderTexts = ['Front Side', 'Back Side'],
    document,
  } = opts;
  return {
    name,
    type: 'image-pair' as const,
    label,
    helperText,
    disabled,
    defaultValue,
    props: {
      required: true,
      width,
      height,
      pickerTitle,
      swipeHintOnMount,
      placeholderTexts,
      document,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Multiple image upload field (scrollable horizontal gallery with empty state) */
export function imageMultipleField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    maxImages?: number;
    minImages?: number;
    width?: number;
    height?: number;
    placeholderText?: string;
    pickerTitle?: string;
    showHelpIcon?: boolean;
    onHelpIconPress?: () => void;
    placeholderFrames?: any[];
    swipeHintOnMount?: boolean;
    swipeHintDelayMs?: number;
    /** Custom icon name for empty state (from custom icon family, defaults to 'icons-img-library') */
    emptyStateIconName?: string;
    /** Custom button text for empty state */
    emptyStateButtonText?: string;
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Photos',
    helperText,
    disabled,
    defaultValue = [],
    props,
    maxImages = 10,
    minImages = 7,
    width = 160,
    height = 120,
    placeholderText = 'Upload Photo',
    pickerTitle = 'Select Car Image',
    showHelpIcon = false,
    onHelpIconPress,
    placeholderFrames,
    swipeHintOnMount,
    swipeHintDelayMs,
    emptyStateIconName,
    emptyStateButtonText = 'Add car photos',
  } = opts;
  return {
    name,
    type: 'image-multiple' as const,
    label,
    helperText,
    disabled,
    defaultValue,
    props: {
      maxImages,
      minImages,
      width,
      height,
      placeholderText,
      pickerTitle,
      showHelpIcon,
      onHelpIconPress,
      placeholderFrames,
      swipeHintOnMount,
      swipeHintDelayMs,
      emptyStateIconName,
      emptyStateButtonText,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Insurance images field (one image at a time with plus button) */
export function insuranceImagesField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    maxImages?: number;
    minImages?: number;
    width?: number;
    height?: number;
    placeholderText?: string;
    pickerTitle?: string;
    showHelpIcon?: boolean;
    onHelpIconPress?: () => void;
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Insurance Documents',
    helperText,
    disabled,
    defaultValue = [],
    props,
    maxImages = 5,
    minImages = 1,
    width = 350,
    height = 200,
    placeholderText = 'Add Insurance Photo',
    pickerTitle = 'Select Insurance Document',
    showHelpIcon = false,
    onHelpIconPress,
  } = opts;
  return {
    name,
    type: 'insurance-images' as const,
    label,
    helperText,
    disabled,
    defaultValue,
    props: {
      maxImages,
      minImages,
      width,
      height,
      placeholderText,
      pickerTitle,
      showHelpIcon,
      onHelpIconPress,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Range slider field (two-value slider) */
export function rangeField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    min?: number;
    max?: number;
    step?: number;
    formatValue?: (n: number) => string;
  } = {},
): FieldDef<TValues> {
  const {
    label,
    helperText,
    disabled,
    defaultValue = [18, 80],
    props,
    min = 18,
    max = 80,
    step = 1,
    formatValue,
  } = opts;
  return {
    name,
    type: 'range' as const,
    label,
    helperText,
    disabled,
    defaultValue,
    props: {
      min,
      max,
      step,
      formatValue,
      ...props,
    },
  } as FieldDef<TValues>;
}
/** Car selection field (navigation-based make/model/trim selection) */
export function carSelectionField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    navigationPath?: string;
  } = {},
): FieldDef<TValues> {
  const {
    label = 'Car',
    placeholder = 'Select car',
    helperText,
    disabled,
    defaultValue = '',
    props,
    navigationPath = '/(tabs)/publish-screen/select-make',
  } = opts;
  return {
    name,
    type: 'car-selection' as const,
    label,
    placeholder,
    helperText,
    disabled,
    defaultValue,
    props: {
      navigationPath,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Accessories field (multi-select with chips) */
export function accessoriesField<TValues>(
  name: keyof TValues & string,
  opts: CommonOpts<TValues> & {
    options: Array<{ label: string; value: string }>;
    modalTitle?: string;
    maxSelections?: number;
    addButtonText?: string;
    addMoreButtonText?: string;
    confirmText?: string;
  },
): FieldDef<TValues> {
  const {
    label = 'Accessories',
    helperText,
    disabled,
    defaultValue = [],
    props,
    options,
    modalTitle,
    maxSelections,
    addButtonText = 'Add accessories',
    addMoreButtonText = 'Add more accessories',
    confirmText = 'Confirm',
  } = opts;
  return {
    name,
    type: 'accessories' as const,
    label,
    helperText,
    disabled,
    defaultValue,
    props: {
      options,
      modalTitle,
      maxSelections,
      addButtonText,
      addMoreButtonText,
      confirmText,
      ...props,
    },
  } as FieldDef<TValues>;
}

/** Row layout for side-by-side fields */
export function rowField<TValues>(
  fields: Array<FieldDef<TValues>>,
  opts: { gap?: number } = {},
): { type: 'row'; gap?: number; fields: Array<FieldDef<TValues>> } {
  const { gap = 12 } = opts;
  return {
    type: 'row' as const,
    gap,
    fields,
  };
}

/** Section label/header - displays text without any input */
export function labelField<TValues>(
  name: keyof TValues & string,
  opts: { label?: string; helperText?: string } = {},
): FieldDef<TValues> {
  const { label = '', helperText } = opts;
  return {
    name,
    type: 'label' as const,
    label,
    helperText,
  } as FieldDef<TValues>;
}
