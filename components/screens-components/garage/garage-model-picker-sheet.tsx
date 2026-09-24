import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';

import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useMakes, useModels } from '@/hooks/use-reference-catalog';
import { triggerHaptic } from '@/utils/haptics';

const COLUMNS = 2;

/** What the caller needs to create a vehicle, straight from the backend. */
export type PickedModel = {
  makeId: string;
  makeName: string;
  modelId: string;
  modelName: string;
};

export type GarageModelPickerSheetProps = {
  visible: boolean;
  onClose: () => void;
  onPick: (picked: PickedModel) => void;
};

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

/**
 * Make, then model, sourced from the BACKEND reference catalog.
 *
 * Deliberately not the bundled `uz-vehicle-catalog`. That list carries makes
 * the backend has never been seeded with (Kia, Chery, Hyundai, Lada, Toyota,
 * Haval, Nissan, Daewoo all return zero models live) and disagrees on ids
 * where both have the car (`tracker` bundled against `tracker-2` live). Every
 * one of those was a dead end: the user picked a car, the id failed to
 * resolve, and the flow bounced them to the VIN screen. Reading the same
 * tables the create endpoint validates against means anything offered here can
 * actually be saved.
 *
 * It also lets the picker hand back real `make_id` / `model_id` values, so the
 * caller no longer has to match names back to ids.
 */
export function GarageModelPickerSheet({
  visible,
  onClose,
  onPick,
}: GarageModelPickerSheetProps) {
  const { t } = useTranslation();
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';

  const [make, setMake] = useState<{ id: string; name: string } | null>(null);

  const makes = useMakes();
  const models = useModels(make?.id);

  const tileBg = isDark ? tokens.card : tokens.backgroundSecondary;

  const close = () => {
    setMake(null);
    onClose();
  };

  const Tile = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <AppPressableView
      onPress={() => {
        triggerHaptic('selection');
        onPress();
      }}
      androidRipple
      accessibilityRole="button"
      accessibilityLabel={label}
      flex={1}
      rounded={14}
      px={14}
      style={{ paddingVertical: 14, backgroundColor: tileBg }}
    >
      <AppText
        family="default"
        weight="semibold"
        numberOfLines={1}
        style={{ fontSize: 14.5, color: tokens.text }}
      >
        {label}
      </AppText>
    </AppPressableView>
  );

  const Grid = ({ items }: { items: { key: string; label: string; onPress: () => void }[] }) => (
    <AppView gap={10}>
      {chunk(items, COLUMNS).map((row) => (
        <AppView key={row[0].key} row gap={10}>
          {row.map((item) => (
            <Tile key={item.key} label={item.label} onPress={item.onPress} />
          ))}
          {/* Odd count: hold the column so a lone tile keeps its width. */}
          {row.length < COLUMNS ? <AppView flex={1} /> : null}
        </AppView>
      ))}
    </AppView>
  );

  /** One surface for the three non-success outcomes of either query. */
  const Status = ({
    loading,
    failed,
    emptyText,
    onRetry,
  }: {
    loading: boolean;
    failed: boolean;
    emptyText: string;
    onRetry: () => void;
  }) => {
    if (loading) {
      return (
        <AppView center style={{ paddingVertical: 32 }}>
          <ActivityIndicator color={tokens.textMuted} />
        </AppView>
      );
    }
    return (
      <AppView center gap={12} style={{ paddingVertical: 28 }}>
        <AppText
          family="default"
          style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 260 }}
        >
          {failed ? t('garage.modelPickerError') : emptyText}
        </AppText>
        {failed ? (
          <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={onRetry} />
        ) : null}
      </AppView>
    );
  };

  const onMakeStep = make === null;
  const makeItems = (makes.data ?? [])
    .filter((m) => !m.comingSoon)
    .map((m) => ({
      key: m.id,
      label: m.name,
      onPress: () => setMake({ id: m.id, name: m.name }),
    }));
  const modelItems = (models.data ?? []).map((m) => ({
    key: m.id,
    label: m.name,
    onPress: () =>
      onPick({
        makeId: make?.id ?? m.makeId,
        makeName: make?.name ?? '',
        modelId: m.id,
        modelName: m.name,
      }),
  }));

  return (
    <AppBottomSheet visible={visible} onClose={close} heightFraction={0.8}>
      <AppView px={20} pt={2} pb={16} gap={10}>
        {/* Back appears only on the model step, where there is somewhere to
         *  go back TO. */}
        {!onMakeStep ? (
          <AppView row align="center" gap={10}>
            <AppPressableView
              onPress={() => {
                triggerHaptic('selection');
                setMake(null);
              }}
              androidRipple={false}
              accessibilityRole="button"
              accessibilityLabel={t('common.back')}
              center
              rounded={999}
              style={{ width: 30, height: 30, backgroundColor: tileBg }}
            >
              <ArrowLeft size={16} strokeWidth={2.4} color={tokens.text} />
            </AppPressableView>
            <AppText
              family="default"
              weight="semibold"
              style={{ fontSize: 13.5, color: tokens.textMuted }}
            >
              {make.name}
            </AppText>
          </AppView>
        ) : null}

        <AppView gap={5}>
          <AppText
            family="heading"
            weight="bold"
            style={{ fontSize: 24, lineHeight: 28, color: tokens.text }}
          >
            {onMakeStep ? t('garage.makePickerTitle') : t('garage.modelPickerTitle')}
          </AppText>
          <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted }}>
            {onMakeStep ? t('garage.makePickerBody') : t('garage.modelPickerBody')}
          </AppText>
        </AppView>
      </AppView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 26 }}
      >
        {onMakeStep ? (
          makeItems.length > 0 ? (
            <Grid items={makeItems} />
          ) : (
            <Status
              loading={makes.isPending}
              failed={makes.isError}
              emptyText={t('garage.makePickerEmpty')}
              onRetry={() => void makes.refetch()}
            />
          )
        ) : modelItems.length > 0 ? (
          <Grid items={modelItems} />
        ) : (
          <Status
            loading={models.isPending}
            failed={models.isError}
            emptyText={t('garage.modelPickerEmpty', { make: make.name })}
            onRetry={() => void models.refetch()}
          />
        )}
      </ScrollView>
    </AppBottomSheet>
  );
}

export default GarageModelPickerSheet;
