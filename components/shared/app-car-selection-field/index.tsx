import type { Family } from '@/components/shared/app-icon';
import { SelectTriggerField } from '@/components/shared/form-field-primitives';
import type { ColorName } from '@/themes';

export type AppCarSelectionFieldProps = {
  label?: string;
  labelColorName?: ColorName;
  helperText?: string;
  errorText?: string;
  required?: boolean;
  showArrow?: boolean;
  trailingIcon?: {
    family?: Family;
    name: string;
    size?: 'sm' | 'md' | 'lg' | number;
    colorName?: ColorName;
    color?: string;
  };
  selectedCarName?: string;
  onPress?: () => void;
  onClear?: () => void;
};

export function AppCarSelectionField({
  labelColorName,
  selectedCarName,
  ...props
}: AppCarSelectionFieldProps) {
  return (
    <SelectTriggerField
      labelColorName={labelColorName}
      valueLabel={selectedCarName}
      placeholder="Choose vehicle"
      {...props}
    />
  );
}

export default AppCarSelectionField;
