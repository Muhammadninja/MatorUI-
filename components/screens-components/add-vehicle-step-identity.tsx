import AddVehicleFields, {
  type VehicleFieldErrors,
  type VehicleFieldKey,
  type VehicleFieldValues,
} from '@/components/screens-components/add-vehicle-fields';

export const STEP_IDENTITY_KEYS: VehicleFieldKey[] = ['year', 'make', 'model'];

export type AddVehicleStepIdentityProps = {
  values: VehicleFieldValues;
  errors?: VehicleFieldErrors;
  onChange: (key: VehicleFieldKey, value: string) => void;
};

export function AddVehicleStepIdentity({
  values,
  errors,
  onChange,
}: AddVehicleStepIdentityProps) {
  return (
    <AddVehicleFields
      values={values}
      errors={errors}
      onChange={onChange}
      only={STEP_IDENTITY_KEYS}
    />
  );
}

export default AddVehicleStepIdentity;
