import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import {
  VehicleChoiceList,
  type VehicleChoice,
} from '@/components/screens-components/garage/vehicle-choice-list';
import { useMakes, useModels } from '@/hooks/use-reference-catalog';
import { modelYearChoices } from '@/services/vehicle-model-years';
import { checkManualName, findListedByName, manualYearChoices, MANUAL_NAME_MAX } from '@/services/manual-vehicle';
import VehicleManualEntry, { type ManualNameErrors } from '@/components/screens-components/garage/vehicle-manual-entry';
import { triggerHaptic } from '@/utils/haptics';

const STEPS = ['make', 'model', 'year'] as const;
type Step = (typeof STEPS)[number];

/** What the caller needs to create a vehicle, straight from the backend. */
export type PickedVehicle = {
  /** Catalog make, or null when the owner typed a make the catalog lacks. */
  makeId: string | null;
  makeName: string;
  /** Catalog model, or null for a car entered by hand (`custom`). */
  modelId: string | null;
  modelName: string;
  year: number;
  /** Entered by hand: names are the owner's, no catalog model behind them. */
  custom?: boolean;
};

export type GarageVehiclePickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (picked: PickedVehicle) => void;
  /** Hand off to the VIN screen. Omitted = the link is not rendered. */
  onUseVin?: () => void;
  /** A create is in flight — freeze the form so a double-tap can't add twice. */
  busy?: boolean;
};

/**
 * Add a car by make, model and year: one question per step, each answered from a
 * searchable list.
 *
 * It is a single `AppBottomSheet` swapping its contents, not a sheet per step:
 * dismissing one Modal to present another flickers on iOS. The sheet has a fixed
 * height, so the list fills it, it keeps its height from step to step, and the
 * keyboard (capped by the sheet) never pushes the question off screen.
 *
 * Makes and models come from the BACKEND reference catalog, never the bundled
 * `uz-vehicle-catalog`: reading the same tables `POST /v1/garage/vehicles`
 * validates against means anything offered can be saved, and the sheet hands
 * back real `make_id` / `model_id` values, never names to match back to ids.
 * Tapping a make or a model answers it and moves on; going back shows the answer
 * still marked. A different make drops the model chosen under the old one.
 */
export function GarageVehiclePickerSheet({
  visible,
  onClose,
  onSubmit,
  onUseVin,
  busy,
}: GarageVehiclePickerSheetProps) {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();

  const [step, setStep] = useState<Step>('make');
  const [makeId, setMakeId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  /** "Нет в списке? Ввести вручную": the model is typed ('model', the make is
   *  the picked one) or both are ('make', the catalog lacks the make). */
  const [manual, setManual] = useState<null | 'model' | 'make'>(null);
  const [customMake, setCustomMake] = useState('');
  const [customModel, setCustomModel] = useState('');
  const [manualErrors, setManualErrors] = useState<ManualNameErrors>({});

  const makes = useMakes();
  const models = useModels(makeId ?? undefined);

  // Alphabetical: the catalog states no popularity yet to pin brands above it.
  // "Coming soon" brands are offered too: the flag means parts are not shoppable
  // yet, not that an owner can't own the car, and the backend saves any active
  // make's model. A brand with no models yet lands on the empty model step.
  const makeChoices = useMemo<VehicleChoice[]>(
    () =>
      (makes.data ?? [])
        .map((m) => ({ value: m.id, label: m.name, logoUrl: m.logoUrl }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [makes.data],
  );
  const modelChoices = useMemo<VehicleChoice[]>(
    () =>
      (models.data ?? [])
        .map((m) => ({ value: m.id, label: m.name }))
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    [models.data],
  );
  // Only the years this model was built (the backend's range), so a
  // discontinued car offers no year after its last one.
  const pickedModel = models.data?.find((m) => m.id === modelId);
  const yearChoices = useMemo<VehicleChoice[]>(
    // Read per render, not at module load, so a session running across New
    // Year still offers the new year. A hand-entered car has no catalog
    // range: this year back to MANUAL_YEAR_MIN, never a future year.
    () =>
      (manual ? manualYearChoices(new Date().getFullYear()) : modelYearChoices(pickedModel, new Date().getFullYear()))
        .map((y) => ({ value: String(y), label: String(y) })),
    [manual, pickedModel],
  );

  // Clear on the way OUT, not on submit. The parent keeps this sheet mounted
  // and only flips `visible`, so resetting here is what stops a second open
  // from showing the last car; and NOT resetting on submit is what lets a
  // failed create (sheet stays open, `busy` back to false) be retried with the
  // answers still in place instead of an empty first step.
  useEffect(() => {
    if (visible) return;
    setStep('make');
    setMakeId(null);
    setModelId(null);
    setYear(null);
    setManual(null);
    setCustomMake('');
    setCustomModel('');
    setManualErrors({});
  }, [visible]);

  const selectedMake = makeChoices.find((o) => o.value === makeId);
  const selectedModel = modelChoices.find((o) => o.value === modelId);

  /** Whether the question on screen has an answer yet. */
  const answered =
    step === 'make'
      ? !!selectedMake
      : step === 'model'
        ? manual
          ? !!customModel.trim() && (manual === 'model' || !!customMake.trim())
          : !!selectedModel
        : yearChoices.some((choice) => choice.value === year);

  /** Open manual entry from the make step (type both) or the model step (type the model). */
  const enterManual = () => {
    if (busy) return;
    triggerHaptic('selection');
    setManualErrors({});
    setYear(null);
    if (step === 'make') {
      setManual('make');
      setMakeId(null);
      setModelId(null);
      setStep('model');
    } else {
      setManual('model');
      setModelId(null);
    }
  };

  /** The typed names, cleaned as the backend will, or the field errors to show. */
  const validateManual = (): { make: string | null; model: string } | null => {
    const message = (error: 'empty' | 'invalid' | 'tooLong') =>
      t(`vehiclePicker.manualError.${error}`, { max: MANUAL_NAME_MAX });
    const errors: ManualNameErrors = {};
    const model = checkManualName(customModel);
    if ('error' in model) errors.model = message(model.error);
    let make: string | null = null;
    if (manual === 'make') {
      const checked = checkManualName(customMake);
      if ('error' in checked) errors.make = message(checked.error);
      else make = checked.name;
    }
    setManualErrors(errors);
    return 'name' in model && !errors.make ? { make, model: model.name } : null;
  };

  // A different make invalidates the model and year: model ids are per-make.
  const pickMake = (next: string) => {
    if (busy) return;
    triggerHaptic('selection');
    if (next !== makeId) {
      setMakeId(next);
      setModelId(null);
      setYear(null);
    }
    setStep('model');
  };
  const pickModel = (next: string) => {
    if (busy) return;
    triggerHaptic('selection');
    if (next !== modelId) setYear(null);
    setModelId(next);
    setStep('year');
  };
  const pickYear = (next: string) => {
    // Only a year the list offers (catalog range, or this year back for a car typed in).
    if (busy || !yearChoices.some((choice) => choice.value === next)) return;
    triggerHaptic('selection');
    setYear(next);
  };

  const goBack = () => {
    triggerHaptic('selection');
    if (step === 'model' && manual) {
      // Back to the list the manual entry was opened from.
      setManual(null);
      setManualErrors({});
      if (manual === 'make') setStep('make');
      return;
    }
    setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);
  };

  const goNext = () => {
    if (!answered || busy) return;
    triggerHaptic('selection');
    if (step === 'model' && manual) {
      if (!validateManual()) return;
      // Typed something the catalog lists: use the listed row instead, so the
      // car keeps exact part matching (the backend would refuse it anyway).
      if (manual === 'make') {
        const listedMake = findListedByName(makeChoices, customMake);
        if (listedMake) {
          setMakeId(listedMake.value);
          setManual('model');
          return;
        }
      } else {
        const listedModel = findListedByName(modelChoices, customModel);
        if (listedModel) {
          setManual(null);
          setModelId(listedModel.value);
          setYear(null);
          setStep('year');
          return;
        }
      }
    }
    if (step !== 'year') {
      setStep(STEPS[STEPS.indexOf(step) + 1]);
      return;
    }
    if (!year) return;
    if (manual) {
      const names = validateManual();
      if (!names || (manual === 'model' && !selectedMake)) return;
      onSubmit({
        makeId: manual === 'model' ? selectedMake!.value : null,
        makeName: manual === 'model' ? selectedMake!.label : names.make!,
        modelId: null,
        modelName: names.model,
        year: Number(year),
        custom: true,
      });
      return;
    }
    if (!selectedMake || !selectedModel) return;
    onSubmit({
      makeId: selectedMake.value,
      makeName: selectedMake.label,
      modelId: selectedModel.value,
      modelName: selectedModel.label,
      year: Number(year),
    });
  };

  /** The answers so far, shown beside the back arrow. */
  const trail = [
    step !== 'make' ? (manual === 'make' ? customMake.trim() : selectedMake?.label) : undefined,
    step === 'year' ? (manual ? customModel.trim() : selectedModel?.label) : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  const heading = step === 'model' && manual
    ? t('vehiclePicker.manualTitle')
    : step === 'make'
      ? t('garage.stepMakeTitle')
      : step === 'model'
        ? t('garage.stepModelTitle')
        : t('garage.stepYearTitle');

  /** A list's place when it has nothing to list: loading, failed or empty. */
  const listState = (state: { pending: boolean; failed: boolean; empty: boolean; emptyText: string; retry: () => void }) =>
    state.pending ? (
      <AppView center style={{ paddingVertical: 32 }}>
        <ActivityIndicator color={tokens.textMuted} />
      </AppView>
    ) : state.failed || state.empty ? (
      <AppView center gap={12} style={{ paddingVertical: 28 }}>
        <AppText family="default" style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}>
          {state.failed ? t('garage.modelPickerError') : state.emptyText}
        </AppText>
        {state.failed ? (
          <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={state.retry} />
        ) : null}
      </AppView>
    ) : null;

  const makeState = listState({
    pending: makes.isPending,
    failed: makes.isError,
    empty: makeChoices.length === 0,
    emptyText: t('garage.makePickerEmpty'),
    retry: () => void makes.refetch(),
  });
  const modelState = listState({
    pending: models.isPending,
    failed: models.isError,
    empty: modelChoices.length === 0,
    emptyText: t('addVehicle.noModels'),
    retry: () => void models.refetch(),
  });

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.86}
      expandable={false}
      dismissOnOverlayPress={!busy}
      swipeToClose={!busy}
    >
      {/* Progress first, under the handle: three segments say "this is short
       *  and you are here" before any copy is read. */}
      <AppView row gap={6} px={20} pt={4}>
        {STEPS.map((id, i) => (
          <AppView
            key={id}
            flex={1}
            rounded={999}
            colorName={i <= STEPS.indexOf(step) ? 'brand' : 'border'}
            style={{ height: 3 }}
          />
        ))}
      </AppView>

      <AppView px={20} pt={14} pb={12} gap={12}>
        {/* Back and close sit on one line ABOVE the question, so the question
         *  itself gets the full width and never shares a row with controls. */}
        <AppView row align="center" justify="space-between" style={{ height: 32 }}>
          {step !== 'make' ? (
            <AppPressableView
              testID="picker-step-back"
              onPress={goBack}
              disabled={busy}
              androidRipple={false}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              row
              align="center"
              gap={6}
              style={{ opacity: busy ? 0.5 : 1, flexShrink: 1 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={18} strokeWidth={2.4} color={tokens.textMuted} />
              <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.textMuted, flexShrink: 1 }}>
                {trail}
              </AppText>
            </AppPressableView>
          ) : (
            <AppView />
          )}

          <AppPressableView
            testID="picker-close"
            onPress={onClose}
            disabled={busy}
            hitSlop={{ top: 9, bottom: 9, left: 9, right: 9 }}
            androidRipple={false}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            center
            rounded={999}
            colorName="backgroundSecondary"
            style={{ width: 30, height: 30, opacity: busy ? 0.5 : 1 }}
          >
            <X size={16} strokeWidth={2.4} color={tokens.text} />
          </AppPressableView>
        </AppView>

        <AppText family="heading" weight="bold" style={{ fontSize: 26, lineHeight: 31, color: tokens.text }}>
          {heading}
        </AppText>
      </AppView>

      <AppView flex={1} px={20} style={{ minHeight: 0 }}>
        {step === 'model' && manual ? (
          <VehicleManualEntry
            catalogMakeName={manual === 'model' ? selectedMake?.label ?? null : null}
            makeName={customMake}
            modelName={customModel}
            errors={manualErrors}
            disabled={busy}
            onChangeMake={(v) => {
              setCustomMake(v);
              if (manualErrors.make) setManualErrors((e) => ({ ...e, make: undefined }));
            }}
            onChangeModel={(v) => {
              setCustomModel(v);
              if (manualErrors.model) setManualErrors((e) => ({ ...e, model: undefined }));
            }}
          />
        ) : step === 'make' ? (
          makeState ?? (
            <VehicleChoiceList
              key="make"
              testID="vehicle-make-list"
              choices={makeChoices}
              selected={makeId}
              onSelect={pickMake}
              searchable
              searchPlaceholder={t('vehiclePicker.searchMake')}
              emptyLabel={t('vehiclePicker.noMatches')}
              disabled={busy}
              showLogos
            />
          )
        ) : step === 'model' ? (
          modelState ?? (
            <VehicleChoiceList
              key={`model-${makeId}`}
              testID="vehicle-model-list"
              choices={modelChoices}
              selected={modelId}
              onSelect={pickModel}
              searchable
              searchPlaceholder={t('vehiclePicker.searchModel')}
              emptyLabel={t('vehiclePicker.noMatches')}
              disabled={busy}
            />
          )
        ) : (
          <VehicleChoiceList
            key="year"
            testID="vehicle-year-list"
            choices={yearChoices}
            selected={year}
            onSelect={pickYear}
            searchable={false}
            emptyLabel={t('vehiclePicker.noMatches')}
            disabled={busy}
          />
        )}
      </AppView>

      {/* Fixed under the list: the step's action, then the quieter ways out. */}
      <AppView px={20} pt={12} pb={8} gap={4} style={{ borderTopWidth: 1, borderTopColor: tokens.divider }}>
        <>
            <AppButton
              testID="picker-step-next"
              title={step === 'year' ? t('common.save') : t('common.continue')}
              kind="brand"
              size="lg"
              fullWidth
              disabled={!answered || !!busy}
              loading={busy}
              onPress={goNext}
            />
            <AppView row justify="center" wrap gap={4}>
              {/* The precise route, offered at the start: a VIN resolves trim
               *  and engine, which make, model and year cannot. */}
              {onUseVin && (step === 'make' || (step === 'model' && manual)) ? (
                <AppButton
                  testID="use-vin-instead"
                  title={t('garage.addByVinInstead')}
                  kind="text"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onPress={onUseVin}
                />
              ) : null}
              {/* Not in the list: type the model (and the make when it isn't listed). */}
              {step !== 'year' && !manual ? (
                <AppButton
                  testID="picker-not-found-link"
                  title={t('vehiclePicker.manualAction')}
                  kind="text"
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onPress={enterManual}
                />
              ) : null}
            </AppView>
        </>
      </AppView>
    </AppBottomSheet>
  );
}

export default GarageVehiclePickerSheet;
