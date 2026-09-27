import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView } from 'react-native';
import { ArrowLeft, X } from 'lucide-react-native';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import { AppNativePickerField } from '@/components/shared/app-native-picker-field';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useMakes, useModels } from '@/hooks/use-reference-catalog';
import { triggerHaptic } from '@/utils/haptics';

/** Years offered, newest first. 24 reaches the early 2000s, which covers the
 *  Nexias and Damas still on the road here. The list is long on purpose — a
 *  native picker shows five rows at a time, so length costs no screen space,
 *  and trimming it would make an older car unaddable by make and model. */
const YEARS_BACK = 24;

const STEPS = ['make', 'model', 'year'] as const;
type Step = (typeof STEPS)[number];

/** What the caller needs to create a vehicle, straight from the backend. */
export type PickedVehicle = {
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
  year: number;
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
 * Add a car by make, model and year — ONE QUESTION PER STEP, each answered
 * with the platform's own picker.
 *
 * Three pickers stacked in one sheet made you read a form before answering
 * anything, and on iOS an open wheel shoved the rest of it around. A step
 * shows only what it is asking for, so the wheel can sit open the whole time
 * and the sheet keeps its height from first question to last.
 *
 * It is still a single `AppBottomSheet` swapping its contents, NOT a sheet per
 * step: dismissing one Modal to present another flickers on iOS, which is
 * what the original two-sheet flow (model grid, then year grid) did.
 *
 * Makes and models come from the BACKEND reference catalog, never the bundled
 * `uz-vehicle-catalog`: that list carries makes the backend was never seeded
 * with and disagrees on ids where both have the car, so every one of those was
 * a dead end — the user picked a car and the create call rejected the id.
 * Reading the same tables `POST /v1/garage/vehicles` validates against means
 * anything offered here can actually be saved, and the picker hands back real
 * `make_id` / `model_id` values so the caller never matches names back to ids.
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

  const makes = useMakes();
  const models = useModels(makeId ?? undefined);

  const makeOptions = useMemo(
    () =>
      (makes.data ?? [])
        .filter((m) => !m.comingSoon)
        .map((m) => ({ label: m.name, value: m.id })),
    [makes.data],
  );
  const modelOptions = useMemo(
    () => (models.data ?? []).map((m) => ({ label: m.name, value: m.id })),
    [models.data],
  );
  const yearOptions = useMemo(() => {
    // Read per render, not at module load, so a session running across New
    // Year still offers the new year.
    const current = new Date().getFullYear();
    return Array.from({ length: YEARS_BACK }, (_, i) => {
      const y = String(current - i);
      return { label: y, value: y };
    });
  }, []);

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
  }, [visible]);

  // A different make invalidates the model: the ids are per-make, and keeping
  // the old one would submit a model that does not belong to the chosen brand.
  const pickMake = (next: string) => {
    if (next === makeId) return;
    setMakeId(next);
    setModelId(null);
  };

  const selectedMake = makeOptions.find((o) => o.value === makeId);
  const selectedModel = modelOptions.find((o) => o.value === modelId);

  /** Whether the question on screen has an answer yet. */
  const answered = step === 'make' ? !!selectedMake : step === 'model' ? !!selectedModel : !!year;

  const goBack = () => {
    triggerHaptic('selection');
    setStep(STEPS[Math.max(0, STEPS.indexOf(step) - 1)]);
  };

  const goNext = () => {
    if (!answered || busy) return;
    triggerHaptic('selection');
    if (step !== 'year') {
      setStep(STEPS[STEPS.indexOf(step) + 1]);
      return;
    }
    if (!selectedMake || !selectedModel || !year) return;
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
    step !== 'make' ? selectedMake?.label : undefined,
    step === 'year' ? selectedModel?.label : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  /** The model step's placeholder carries its own state, so a field with
   *  nothing to offer says WHY instead of sitting there blank. */
  const modelPlaceholder = models.isPending
    ? t('addVehicle.loadingModels')
    : modelOptions.length === 0
      ? t('addVehicle.noModels')
      : t('garage.notSelected');

  const makesFailed = makes.isError;
  const makesEmpty = !makes.isPending && !makesFailed && makeOptions.length === 0;

  const heading =
    step === 'make'
      ? t('garage.stepMakeTitle')
      : step === 'model'
        ? t('garage.stepModelTitle')
        : t('garage.stepYearTitle');

  return (
    <AppBottomSheet
      visible={visible}
      onClose={onClose}
      heightFraction={0.72}
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

      <AppView px={20} pt={14} pb={18} gap={12}>
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
              style={{ opacity: busy ? 0.5 : 1 }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <ArrowLeft size={18} strokeWidth={2.4} color={tokens.textMuted} />
              <AppText
                family="accent"
                weight="bold"
                style={{ fontSize: 13, color: tokens.textMuted }}
              >
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

        <AppText
          family="heading"
          weight="bold"
          style={{ fontSize: 26, lineHeight: 31, color: tokens.text }}
        >
          {heading}
        </AppText>
      </AppView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 26 }}
      >
        {makes.isPending ? (
          <AppView center style={{ paddingVertical: 32 }}>
            <ActivityIndicator color={tokens.textMuted} />
          </AppView>
        ) : makesFailed || makesEmpty ? (
          <AppView center gap={12} style={{ paddingVertical: 28 }}>
            <AppText
              family="default"
              style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 260 }}
            >
              {makesFailed ? t('garage.modelPickerError') : t('garage.makePickerEmpty')}
            </AppText>
            {makesFailed ? (
              <AppButton
                title={t('common.retry')}
                kind="secondary"
                size="sm"
                onPress={() => void makes.refetch()}
              />
            ) : null}
          </AppView>
        ) : (
          <AppView gap={14}>
            {/* The field starts CLOSED, so the step opens on an honest "not
             *  selected" and the wheel only appears once it is tapped. An
             *  always-open wheel had to centre something: with a placeholder
             *  row it centred that, leaving the top half of the wheel blank
             *  and the brands below the fold. */}
            {step === 'make' ? (
              <AppNativePickerField
                // Keyed per step so React REMOUNTS it instead of reusing one
                // instance across all three: without this the field keeps its
                // open state, so step two would arrive with its wheel already
                // open and — because an open wheel commits what it centres —
                // already answered.
                key="make"
                testID="vehicle-make-picker"
                label={t('addVehicle.fieldMake')}
                placeholder={t('garage.notSelected')}
                value={makeId}
                options={makeOptions}
                onChange={pickMake}
                disabled={busy}
              />
            ) : step === 'model' ? (
              <AppNativePickerField
                // Keyed per step so React REMOUNTS it instead of reusing one
                // instance across all three: without this the field keeps its
                // open state, so step two would arrive with its wheel already
                // open and — because an open wheel commits what it centres —
                // already answered.
                key="model"
                testID="vehicle-model-picker"
                label={t('addVehicle.fieldModel')}
                placeholder={modelPlaceholder}
                value={modelId}
                options={modelOptions}
                onChange={setModelId}
                disabled={busy}
              />
            ) : (
              <AppNativePickerField
                // Keyed per step so React REMOUNTS it instead of reusing one
                // instance across all three: without this the field keeps its
                // open state, so step two would arrive with its wheel already
                // open and — because an open wheel commits what it centres —
                // already answered.
                key="year"
                testID="vehicle-year-picker"
                label={t('addVehicle.fieldYear')}
                placeholder={t('garage.notSelected')}
                value={year}
                options={yearOptions}
                onChange={setYear}
                disabled={busy}
              />
            )}

            <AppButton
              testID="picker-step-next"
              title={step === 'year' ? t('common.save') : t('common.continue')}
              kind="brand"
              size="lg"
              fullWidth
              disabled={!answered || !!busy}
              loading={busy}
              onPress={goNext}
              containerStyle={{ marginTop: 4 }}
            />

            {/* The precise route, offered once at the start rather than on
             *  every step: a VIN resolves trim and engine, which make, model
             *  and year cannot. */}
            {onUseVin && step === 'make' ? (
              <AppButton
                testID="use-vin-instead"
                title={t('garage.addByVinInstead')}
                kind="text"
                variant="ghost"
                size="sm"
                fullWidth
                disabled={busy}
                onPress={onUseVin}
              />
            ) : null}
          </AppView>
        )}
      </ScrollView>
    </AppBottomSheet>
  );
}

export default GarageVehiclePickerSheet;
