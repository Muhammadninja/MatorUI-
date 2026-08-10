import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type {
  VehicleFieldErrors,
  VehicleFieldKey,
  VehicleFieldValues,
} from '@/components/screens-components/add-vehicle/add-vehicle-fields';
import AddVehicleStepIdentity from '@/components/screens-components/add-vehicle/add-vehicle-step-identity';
import AddVehicleStepIndicator from '@/components/screens-components/add-vehicle/add-vehicle-step-indicator';
import AddVehicleStepOwnership from '@/components/screens-components/add-vehicle/add-vehicle-step-ownership';
import AddVehicleStepPersonalization from '@/components/screens-components/add-vehicle/add-vehicle-step-personalization';
import AddVehicleWizardFooter from '@/components/screens-components/add-vehicle/add-vehicle-wizard-footer';
import { AppView } from '@/components/shared/app-view';
import type { Vehicle, VehicleColor, VehicleInput } from '@/services/garage-service';
import { triggerHaptic } from '@/utils/haptics';

export type AddVehicleWizardSubmit = {
  payload: Omit<VehicleInput, 'setAsPrimary'>;
  setAsPrimary: boolean;
};

export type AddVehicleWizardProps = {
  editing?: Vehicle;
  onSubmit: (submission: AddVehicleWizardSubmit) => Promise<void> | void;
  onCancel: () => void;
};

const TOTAL_STEPS = 3;

function buildStepLabels(t: (key: string) => string): string[] {
  return [t('addVehicle.stepVehicle'), t('addVehicle.stepDetails'), t('addVehicle.stepStyle')];
}

function parseIntOrUndefined(value: string): number | undefined {
  const cleaned = value.replace(/[^0-9]/g, '');
  if (!cleaned) return undefined;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : undefined;
}

function buildInitialValues(editing?: Vehicle): VehicleFieldValues {
  return {
    year: editing ? String(editing.year) : '',
    make: editing?.make ?? '',
    model: editing?.model ?? '',
    trim: editing?.trim ?? '',
    nickname: editing?.nickname ?? '',
    mileage: editing?.mileage !== undefined ? String(editing.mileage) : '',
    plate: editing?.plate ?? '',
    vin: editing?.vin ?? '',
  };
}

export function AddVehicleWizard({ editing, onSubmit, onCancel }: AddVehicleWizardProps) {
  const { t } = useTranslation();
  const stepLabels = useMemo(() => buildStepLabels(t), [t]);
  const [step, setStep] = useState(1);
  const [values, setValues] = useState<VehicleFieldValues>(() => buildInitialValues(editing));
  const [color, setColor] = useState<VehicleColor>(editing?.color ?? 'midnight');
  const [setAsPrimary, setSetAsPrimary] = useState(editing?.isPrimary ?? false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saving, setSaving] = useState(false);

  const setField = useCallback((key: VehicleFieldKey, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const yearNumber = parseIntOrUndefined(values.year);
  const mileageNumber = parseIntOrUndefined(values.mileage);

  const yearValid = yearNumber !== undefined && yearNumber >= 1900 && yearNumber <= 2100;
  const makeValid = values.make.trim().length > 0;
  const modelValid = values.model.trim().length > 0;
  const stepOneValid = yearValid && makeValid && modelValid;

  const errors: VehicleFieldErrors = useMemo(() => {
    const e: VehicleFieldErrors = {};
    if (values.year && !yearValid) e.year = t('addVehicle.errorYearRange');
    if (submitAttempted) {
      if (!yearValid) e.year = e.year ?? t('addVehicle.errorRequired');
      if (!makeValid) e.make = t('addVehicle.errorRequired');
      if (!modelValid) e.model = t('addVehicle.errorRequired');
    }
    return e;
  }, [values.year, yearValid, makeValid, modelValid, submitAttempted, t]);

  const isLast = step === TOTAL_STEPS;

  const handleNext = useCallback(() => {
    if (step === 1 && !stepOneValid) {
      setSubmitAttempted(true);
      triggerHaptic('warning');
      return;
    }
    if (step < TOTAL_STEPS) {
      triggerHaptic('selection');
      setSubmitAttempted(false);
      setStep((s) => s + 1);
    }
  }, [step, stepOneValid]);

  const handleSubmit = useCallback(async () => {
    if (saving) return;
    if (!stepOneValid || yearNumber === undefined) {
      setSubmitAttempted(true);
      setStep(1);
      triggerHaptic('warning');
      return;
    }
    triggerHaptic('success');
    setSaving(true);
    try {
      await onSubmit({
        payload: {
          year: yearNumber,
          make: values.make.trim(),
          model: values.model.trim(),
          trim: values.trim.trim() || undefined,
          nickname: values.nickname.trim() || undefined,
          plate: values.plate.trim() || undefined,
          vin: values.vin.trim() || undefined,
          mileage: mileageNumber,
          color,
        },
        setAsPrimary,
      });
    } catch {
      // Parent surfaces the error via useGarage().error; we just release the lock.
    } finally {
      setSaving(false);
    }
  }, [saving, stepOneValid, yearNumber, mileageNumber, values, color, setAsPrimary, onSubmit]);

  return (
    <AppView>
      <AddVehicleStepIndicator
        total={TOTAL_STEPS}
        current={step}
        label={stepLabels[step - 1]}
      />
      <AppView px={20} pt="sm">
        {step === 1 ? (
          <AddVehicleStepIdentity values={values} errors={errors} onChange={setField} />
        ) : null}
        {step === 2 ? (
          <AddVehicleStepPersonalization
            values={values}
            errors={errors}
            onChange={setField}
          />
        ) : null}
        {step === 3 ? (
          <AddVehicleStepOwnership
            values={values}
            errors={errors}
            onChange={setField}
            color={color}
            onColorChange={setColor}
            setAsPrimary={setAsPrimary}
            onSetAsPrimaryChange={setSetAsPrimary}
          />
        ) : null}
      </AppView>
      <AddVehicleWizardFooter
        isLast={isLast}
        canAdvance={!saving}
        saveLabel={saving ? t('addVehicle.saving') : editing ? t('addVehicle.saveChanges') : t('addVehicle.saveVehicle')}
        onNext={handleNext}
        onSave={handleSubmit}
      />
    </AppView>
  );
}

export default AddVehicleWizard;
