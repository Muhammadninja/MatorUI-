import { useTranslation } from 'react-i18next';

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
  saveLabel,
  onNext,
  onSave,
}: AddVehicleWizardFooterProps) {
  const { t } = useTranslation();
  const resolvedSaveLabel = saveLabel ?? t('addVehicle.saveVehicle');
  return (
    <AppView px={20} pt="md" pb="md">
      <AppButton
        title={isLast ? resolvedSaveLabel : t('addVehicle.next')}
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
