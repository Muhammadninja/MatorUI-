import { ChoiceField, type FieldOption } from '@/components/shared/form-field-primitives';

export type AppSegmentedControlProps = {
  items?: FieldOption[];
  options?: FieldOption[];
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (value: string | number) => void;
  disabled?: boolean;
};

export function AppSegmentedControl({
  items,
  options,
  value,
  defaultValue,
  onChange,
  disabled,
}: AppSegmentedControlProps) {
  return (
    <ChoiceField
      disabled={disabled}
      options={items ?? options ?? []}
      value={value ?? defaultValue}
      onChange={(next) => onChange?.(next as string | number)}
      selectedKind="secondary"
    />
  );
}

export default AppSegmentedControl;
