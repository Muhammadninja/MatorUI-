import { ScanLine } from 'lucide-react-native';

import AddVehicleColorPicker from '@/components/screens-components/add-vehicle/add-vehicle-color-picker';
import AddVehicleFields, {
  type VehicleFieldErrors,
  type VehicleFieldKey,
  type VehicleFieldValues,
} from '@/components/screens-components/add-vehicle/add-vehicle-fields';
import AddVehiclePrimaryToggle from '@/components/screens-components/add-vehicle/add-vehicle-primary-toggle';
import VinScannerModal from '@/components/screens-components/vin-scanner/vin-scanner-modal';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import useVinScanner from '@/hooks/use-vin-scanner';
import { toastService } from '@/services/toast-service';
import type { VehicleColor } from '@/services/garage-service';
import { triggerHaptic } from '@/utils/haptics';

// Step 2 owns plate + VIN. VIN was previously not part of the form;
// added now so the scanner has a target to write into.
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
  const { tokens } = useThemeContext();
  const scanner = useVinScanner({
    acceptInvalidChecksum: true,
    onResult: (vin) => {
      triggerHaptic('success');
      onChange('vin', vin);
      toastService.success('VIN captured', { description: vin });
    },
  });

  return (
    <AppView gap="lg">
      <AddVehicleFields
        values={values}
        errors={errors}
        onChange={onChange}
        only={STEP_OWNERSHIP_KEYS}
      />
      <AppButton
        kind="secondary"
        size="md"
        onPress={() => {
          triggerHaptic('selection');
          scanner.open();
        }}
        accessibilityLabel="Scan VIN with camera"
      >
        <AppView row align="center" gap="sm">
          <ScanLine size={18} strokeWidth={2} color={tokens.text} />
          <AppText textVariant="bodySemibold">Scan VIN with camera</AppText>
        </AppView>
      </AppButton>
      <AddVehicleColorPicker value={color} onChange={onColorChange} />
      <AddVehiclePrimaryToggle value={setAsPrimary} onChange={onSetAsPrimaryChange} />
      <VinScannerModal
        visible={scanner.isOpen}
        onClose={scanner.close}
        onBarcodeScanned={scanner.onBarcodeScanned}
      />
    </AppView>
  );
}

export default AddVehicleStepOwnership;
