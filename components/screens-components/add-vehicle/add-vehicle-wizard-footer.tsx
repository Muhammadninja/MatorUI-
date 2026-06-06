import { AppButton } from '@/components/shared/app-button';
import { AppView } from '@/components/shared/app-view';

export type AddVehicleWizardFooterProps = {
  isLast: boolean;
  canAdvance: boolean;
  saveLabel?: string;
  onNext: () => void;
  onSave: () => void;
};

export function AddVehicleWizardFooter({
  isLast,
  canAdvance,
  saveLabel = 'Save vehicle',
  onNext,
  onSave,
}: AddVehicleWizardFooterProps) {
  return (
    <AppView px={20} pt={12} pb={12}>
      <AppButton
        title={isLast ? saveLabel : 'Next'}
        kind="brand"
        size="lg"
        fullWidth
        disabled={!canAdvance}
        onPress={isLast ? onSave : onNext}
      />
    </AppView>
  );
}

export default AddVehicleWizardFooter;
