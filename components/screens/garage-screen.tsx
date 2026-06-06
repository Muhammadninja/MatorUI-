import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView } from 'react-native';

import AddVehicleWizard, {
    type AddVehicleWizardSubmit,
} from '@/components/screens-components/add-vehicle/add-vehicle-wizard';
import GarageEmptyState from '@/components/screens-components/garage/garage-empty-state';
import GarageHeader from '@/components/screens-components/garage/garage-header';
import GaragePrimaryVehicleCard from '@/components/screens-components/garage/garage-primary-vehicle-card';
import GarageVehicleTile from '@/components/screens-components/garage/garage-vehicle-tile';
import ScreenShell from '@/components/screens-components/screen-shell';
import AppBlurView, { useBlurHeaderInset } from '@/components/shared/app-blur-view';
import AppBottomSheet from '@/components/shared/app-bottom-sheet';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import useGarage from '@/hooks/use-garage';
import { triggerHaptic } from '@/utils/haptics';

const GARAGE_HEADER_HEIGHT = 72;

export default function GarageScreen() {
  const {
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
      try {
        await setPrimary(id);
      } catch {
        // Error is surfaced via the hook's `error` state.
      }
    },
    [setPrimary],
  );

  if (isLoading && vehicles.length === 0) {
    return (
      <ScreenShell>
        <LoadingState />
      </ScreenShell>
    );
  }

  if (vehicles.length === 0) {
    return (
      <ScreenShell>
        {error ? <ErrorBanner message={error} onDismiss={clearError} /> : null}
        <GarageEmptyState onAddVehicle={openAddSheet} />
        <AppBottomSheet
          visible={addSheetVisible}
          onClose={closeAddSheet}
          heightFraction={0.7}
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
      {error ? <ErrorBanner message={error} onDismiss={clearError} /> : null}
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
        heightFraction={0.7}
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

function LoadingState() {
  const { tokens } = useThemeContext();
  return (
    <AppView flex={1} center gap={12}>
      <ActivityIndicator color={tokens.text} />
      <AppText textVariant="bodySm" colorName="gray400">
        Loading your garage…
      </AppText>
    </AppView>
  );
}

type ErrorBannerProps = { message: string; onDismiss: () => void };

function ErrorBanner({ message, onDismiss }: ErrorBannerProps) {
  return (
    <AppView
      mx={20}
      mt={8}
      px={14}
      py={10}
      rounded={14}
      row
      align="center"
      justify="space-between"
      gap={10}
      colorName="card"
      borderName="error"
      borderWidth={1}
    >
      <AppText
        textVariant="bodyXs"
        colorName="error"
        numberOfLines={2}
        style={{ flexShrink: 1 }}
      >
        {message}
      </AppText>
      <AppText
        textVariant="bodyXs"
        family="accent"
        colorName="error"
        onPress={onDismiss}
        suppressHighlighting
      >
        Dismiss
      </AppText>
    </AppView>
  );
}
