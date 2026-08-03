import AddVehicleColorPicker from '@/components/screens-components/add-vehicle/add-vehicle-color-picker';
import AddVehicleFields, {
  type VehicleFieldErrors,
  type VehicleFieldKey,
  type VehicleFieldValues,
} from '@/components/screens-components/add-vehicle/add-vehicle-fields';
import AddVehiclePrimaryToggle from '@/components/screens-components/add-vehicle/add-vehicle-primary-toggle';
import { AppView } from '@/components/shared/app-view';
import type { VehicleColor } from '@/services/garage-service';

// Step 2 owns plate + VIN. VIN is entered manually in the form field.
export const STEP_OWNERSHIP_KEYS: VehicleFieldKey[] = ['plate', 'vin'];

export type AddVehicleStepOwnershipProps = {
  values: VehicleFieldValues;
  errors?: VehicleFieldErrors;
  onChange: (key: VehicleFieldKey, value: string) => void;
  color: VehicleColor;
  onColorChange: (color: VehicleColor) => void;
  setAsPrimary: boolean;
  onSetAsPrimaryChange: (value: boolean) => void;
};

export function AddVehicleStepOwnership({
  values,
  errors,
  onChange,
  color,
  onColorChange,
  setAsPrimary,
  onSetAsPrimaryChange,
}: AddVehicleStepOwnershipProps) {
  return (
    <AppView gap="lg">
      <AddVehicleFields
        values={values}
        errors={errors}
        onChange={onChange}
        only={STEP_OWNERSHIP_KEYS}
      />
      <AddVehicleColorPicker value={color} onChange={onColorChange} />
      <AddVehiclePrimaryToggle value={setAsPrimary} onChange={onSetAsPrimaryChange} />
    </AppView>
  );
}

export default AddVehicleStepOwnership;
