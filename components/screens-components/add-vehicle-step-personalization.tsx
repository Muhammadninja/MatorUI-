import AddVehicleFields, {
  type VehicleFieldErrors,
  type VehicleFieldKey,
  type VehicleFieldValues,
} from '@/components/screens-components/add-vehicle-fields';

export const STEP_PERSONALIZATION_KEYS: VehicleFieldKey[] = ['trim', 'nickname', 'mileage'];

export type AddVehicleStepPersonalizationProps = {
  values: VehicleFieldValues;
  errors?: VehicleFieldErrors;
  onChange: (key: VehicleFieldKey, value: string) => void;
};

export function AddVehicleStepPersonalization({
  values,
  errors,
  onChange,
}: AddVehicleStepPersonalizationProps) {
  return (
    <AddVehicleFields
      values={values}
      errors={errors}
      onChange={onChange}
      only={STEP_PERSONALIZATION_KEYS}
    />
  );
}

export default AddVehicleStepPersonalization;
