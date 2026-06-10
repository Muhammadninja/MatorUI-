import { router } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';

import AddVehicleWizard, {
    type AddVehicleWizardSubmit,
} from '@/components/screens-components/add-vehicle/add-vehicle-wizard';
import GarageEmptyState from '@/components/screens-components/garage/garage-empty-state';
import GarageHeader from '@/components/screens-components/garage/garage-header';
import GaragePrimaryVehicleCard from '@/components/screens-components/garage/garage-primary-vehicle-card';
import GarageSkeleton from '@/components/screens-components/garage/garage-skeleton';
import GarageVehicleTile from '@/components/screens-components/garage/garage-vehicle-tile';
import ScreenShell from '@/components/screens-components/screen-shell';
import { AppButton } from '@/components/shared/app-button';
import AppBlurView, { useBlurHeaderInset } from '@/components/shared/app-blur-view';
import AppBottomSheet from '@/components/shared/app-bottom-sheet';
import { AppInlineError } from '@/components/shared/app-inline-error';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import useGarage from '@/hooks/use-garage';
import { toastService } from '@/services/toast-service';
import { triggerHaptic } from '@/utils/haptics';

const GARAGE_HEADER_HEIGHT = 72;

export default function GarageScreen() {
  const {
    state,
    vehicles,
    primaryVehicle,
    secondaryVehicles,
    isLoading,
    error,
    addVehicle,
    setPrimary,
    refresh,
    clearError,
  } = useGarage();
  const { tokens } = useThemeContext();
  const topInset = useBlurHeaderInset(GARAGE_HEADER_HEIGHT);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [sheetSessionId, setSheetSessionId] = useState(0);

  const openAddSheet = useCallback(() => {
    triggerHaptic('selection');
    clearError();
    setSheetSessionId((id) => id + 1);
    setAddSheetVisible(true);
  }, [clearError]);

  const closeAddSheet = useCallback(() => {
    setAddSheetVisible(false);
  }, []);

  const handleAddSubmit = useCallback(
    async ({ payload, setAsPrimary }: AddVehicleWizardSubmit) => {
      await addVehicle({ ...payload, setAsPrimary });
      closeAddSheet();
    },
    [addVehicle, closeAddSheet],
  );

  const goToDetail = useCallback((id: string) => {
    router.push({ pathname: '/vehicle-detail', params: { id } });
  }, []);

  const goToCatalog = useCallback(() => {
    router.push('/explore');
  }, []);

  const handleSetPrimary = useCallback(
    async (id: string) => {
      triggerHaptic('success');
      const targetVehicle = vehicles.find((v) => v.id === id);
      try {
        await setPrimary(id);
        // Explicit confirmation toast — mirrors the detail-screen
        // pattern so set-primary feedback is identical across both
        // entry points (tile-tap and detail-screen action row).
        if (targetVehicle) {
          toastService.success('Set as primary', {
            description: `${targetVehicle.year} ${targetVehicle.make} ${targetVehicle.model}`,
          });
        }
      } catch {
        // Error is surfaced via the hook's `error` state.
      }
    },
    [vehicles, setPrimary],
  );

  // Loading / idle → section-scoped skeleton matching loaded geometry.
  if (state === 'loading' || state === 'idle') {
    return (
      <ScreenShell>
        <AppView pt={topInset} px={20}>
          <GarageSkeleton />
        </AppView>
      </ScreenShell>
    );
  }

  // Error path → centered icon + message + retry. Same shape as
  // the catalogue / top-featured error states.
  if (state === 'error') {
    return (
      <ScreenShell>
        <AppView flex={1} center px={20} gap={14}>
          <AlertCircle size={36} strokeWidth={2} color={tokens.error} />
          <AppView gap={4} align="center">
            <AppText textVariant="bodySemibold">Couldn't load your garage</AppText>
            <AppText
              textVariant="bodySm"
              colorName="gray400"
              style={{ textAlign: 'center', maxWidth: 280 }}
            >
              {error ?? 'Something went wrong. Try again.'}
            </AppText>
          </AppView>
          <AppButton
            title="Retry"
            kind="secondary"
            size="sm"
            onPress={() => {
              clearError();
              void refresh();
            }}
          />
        </AppView>
      </ScreenShell>
    );
  }

  // Empty path → designed empty state with primary CTA to add first vehicle.
  if (state === 'empty') {
    return (
      <ScreenShell>
        <GarageEmptyState onAddVehicle={openAddSheet} />
        <AppBottomSheet
          visible={addSheetVisible}
          onClose={closeAddSheet}
          heightFraction={0.85}
        >
          <AddVehicleWizard
            key={sheetSessionId}
            onSubmit={handleAddSubmit}
            onCancel={closeAddSheet}
          />
        </AppBottomSheet>
      </ScreenShell>
    );
  }

  return (
    <AppView flex={1} colorName="background">
      {error ? <AppInlineError message={error} onDismiss={clearError} /> : null}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: topInset,
          paddingHorizontal: 20,
          paddingBottom: 40,
          gap: 24,
        }}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refresh} />
        }
      >
        {primaryVehicle ? (
          <GaragePrimaryVehicleCard
            vehicle={primaryVehicle}
            image={primaryVehicle.images?.[0]}
            onOpenDetail={goToDetail}
            onFindParts={goToCatalog}
            onLogService={goToDetail}
          />
        ) : null}

        {secondaryVehicles.length > 0 ? (
          <AppView gap={12}>
            <AppText
              textVariant="caption"
              family="accent"
              colorName="gray400"
              transform="uppercase"
              accessibilityRole="header"
            >
              Also in the garage
            </AppText>
            <AppView gap={10}>
              {secondaryVehicles.map((v) => (
                <GarageVehicleTile
                  key={v.id}
                  vehicle={v}
                  onOpenDetail={goToDetail}
                  onSetPrimary={handleSetPrimary}
                  onFindParts={goToCatalog}
                />
              ))}
            </AppView>
          </AppView>
        ) : null}
      </ScrollView>

      <AppBlurView contentHeight={GARAGE_HEADER_HEIGHT}>
        <GarageHeader onAddPress={openAddSheet} />
      </AppBlurView>

      <AppBottomSheet
        visible={addSheetVisible}
        onClose={closeAddSheet}
        heightFraction={0.85}
      >
        <AddVehicleWizard
          key={sheetSessionId}
          onSubmit={handleAddSubmit}
          onCancel={closeAddSheet}
        />
      </AppBottomSheet>
    </AppView>
  );
}

