import { ChoiceField, type FieldOption } from '@/components/shared/form-field-primitives';

export type AppAccessoriesFieldProps = {
  label?: string;
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  value?: Array<string | number>;
  onChange?: (value: Array<string | number>) => void;
  options?: FieldOption[];
  modalTitle?: string;
  maxSelections?: number;
  addButtonText?: string;
  addMoreButtonText?: string;
};

export default function AppAccessoriesField({
  options = [],
  value,
  onChange,
  ...props
}: AppAccessoriesFieldProps) {
  return (
    <ChoiceField
      options={options}
      value={value}
      onChange={(next) =>
        onChange?.(
          (next as Array<string | number>).slice(0, props.maxSelections ?? Number.MAX_SAFE_INTEGER),
        )
      }
      multiple
      {...props}
    />
  );
}
