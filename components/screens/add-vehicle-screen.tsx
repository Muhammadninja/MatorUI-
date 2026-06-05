import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';

import AddVehicleWizard, {
    type AddVehicleWizardSubmit,
} from '@/components/screens-components/add-vehicle-wizard';
import AppBottomSheet from '@/components/shared/app-bottom-sheet';
import useGarage from '@/hooks/use-garage';
import { garageService } from '@/services/garage-service';

export default function AddVehicleScreen() {
  const { addVehicle, updateVehicle, setPrimary } = useGarage();
  const params = useLocalSearchParams<{ id?: string }>();
  const editing = useMemo(
    () => (params.id ? garageService.getById(params.id) : undefined),
    [params.id],
  );

  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => router.back(), 200);
  }, []);

  const handleSubmit = useCallback(
    ({ payload, setAsPrimary }: AddVehicleWizardSubmit) => {
      if (editing) {
        updateVehicle(editing.id, payload);
        if (setAsPrimary && !editing.isPrimary) setPrimary(editing.id);
      } else {
        addVehicle({ ...payload, setAsPrimary });
      }
      handleClose();
    },
    [editing, addVehicle, updateVehicle, setPrimary, handleClose],
  );

  return (
    <AppBottomSheet visible={visible} onClose={handleClose} heightFraction={1 / 3}>
      <AddVehicleWizard
        editing={editing}
        onSubmit={handleSubmit}
        onCancel={handleClose}
      />
    </AppBottomSheet>
  );
}
