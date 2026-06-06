import { router, useLocalSearchParams } from 'expo-router';
import { Pencil, ScanLine, Star, Trash2, Wrench } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';

import ScreenShell from '@/components/screens-components/screen-shell';
import AddVehicleWizard, {
  type AddVehicleWizardSubmit,
} from '@/components/screens-components/add-vehicle/add-vehicle-wizard';
import VehicleDetailActionRow from '@/components/screens-components/vehicle-detail/vehicle-detail-action-row';
import VehicleDetailHeader from '@/components/screens-components/vehicle-detail/vehicle-detail-header';
import VehicleDetailHeadline from '@/components/screens-components/vehicle-detail/vehicle-detail-headline';
import VehicleDetailStats from '@/components/screens-components/vehicle-detail/vehicle-detail-stats';
import AppBlurView, { useBlurHeaderInset } from '@/components/shared/app-blur-view';
import AppBottomSheet from '@/components/shared/app-bottom-sheet';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import useGarage from '@/hooks/use-garage';
import { useGlobalModal } from '@/hooks/use-global-modal';
import { garageService } from '@/services/garage-service';
import { triggerHaptic } from '@/utils/haptics';

const VEHICLE_DETAIL_HEADER_HEIGHT = 52;

function formatMileage(mi?: number): string {
  if (!mi && mi !== 0) return '—';
  return `${mi.toLocaleString('en-US')} mi`;
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function VehicleDetailScreen() {
  const { tokens } = useThemeContext();
  const { vehicles, setPrimary, removeVehicle, updateVehicle } = useGarage();
  const { openConfirm } = useGlobalModal();
  const params = useLocalSearchParams<{ id?: string }>();
  // peek=-24 means content paddingTop = insets.top + headerHeight + fadeHeight,
  // i.e. the headline starts BELOW the entire blur strip (no overlap behind the fade).
  const topInset = useBlurHeaderInset(VEHICLE_DETAIL_HEADER_HEIGHT, -24);

  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [editSessionId, setEditSessionId] = useState(0);

  const vehicle = useMemo(() => {
    if (!params.id) return undefined;
    return vehicles.find((v) => v.id === params.id) ?? garageService.getById(params.id);
  }, [params.id, vehicles]);

  const openEditSheet = useCallback(() => {
    if (!vehicle) return;
    triggerHaptic('selection');
    setEditSessionId((id) => id + 1);
    setEditSheetVisible(true);
  }, [vehicle]);

  const closeEditSheet = useCallback(() => {
    setEditSheetVisible(false);
  }, []);

  const handleEditSubmit = useCallback(
    async ({ payload, setAsPrimary }: AddVehicleWizardSubmit) => {
      if (!vehicle) return;
      await updateVehicle(vehicle.id, payload);
      if (setAsPrimary && !vehicle.isPrimary) await setPrimary(vehicle.id);
      closeEditSheet();
    },
    [vehicle, updateVehicle, setPrimary, closeEditSheet],
  );

  if (!vehicle) {
    return (
      <ScreenShell>
        <AppView flex={1} center px={20} gap={12}>
          <AppText textVariant="title" family="heading" colorName="text" align="center">
            Vehicle not found
          </AppText>
          <AppText textVariant="bodySm" colorName="gray400" align="center">
            It may have been removed from your garage.
          </AppText>
          <AppPressableView rounded={999} colorName="brand" onPress={() => router.back()}>
            <AppView row align="center" gap={6} px={16} py={10}>
              <AppText textVariant="buttonSm" family="accent" colorName="onBrand">
                Go back
              </AppText>
            </AppView>
          </AppPressableView>
        </AppView>
      </ScreenShell>
    );
  }

  const headline = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const subline = [vehicle.trim, vehicle.nickname].filter(Boolean).join(' · ') || 'In your garage';

  async function handleSetPrimary() {
    if (!vehicle || vehicle.isPrimary) return;
    triggerHaptic('success');
    try {
      await setPrimary(vehicle.id);
    } catch {
      // Surfaced via the hook's error state.
    }
  }

  function handleFindParts() {
    triggerHaptic('selection');
    router.push('/explore');
  }

  function handleRemove() {
    if (!vehicle) return;
    openConfirm({
      title: 'Remove vehicle?',
      message: `${headline} will be removed from your garage.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        triggerHaptic('warning');
        try {
          await removeVehicle(vehicle.id);
          router.back();
        } catch {
          // Surfaced via the hook's error state; stay on the detail screen.
        }
      },
    });
  }

  return (
    <AppView flex={1} colorName="background">
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: topInset, paddingBottom: 40 }}
      >
        <AppView gap={24}>
          <VehicleDetailHeadline headline={headline} subline={subline} />

          <VehicleDetailStats
            mileage={formatMileage(vehicle.mileage)}
            plate={vehicle.plate ?? '—'}
            color={titleCase(vehicle.color)}
          />

          <AppView px={20} gap={10}>
            <AppText
              textVariant="caption"
              family="accent"
              colorName="gray400"
              transform="uppercase"
            >
              Actions
            </AppText>

            <VehicleDetailActionRow
              icon={<ScanLine size={18} strokeWidth={2.1} color={tokens.text} />}
              label="Find compatible parts"
              hint="Filter the catalog by this vehicle"
              onPress={handleFindParts}
            />
            <VehicleDetailActionRow
              icon={<Wrench size={18} strokeWidth={2.1} color={tokens.text} />}
              label="Service log"
              hint="Coming soon"
              muted
            />
            <VehicleDetailActionRow
              icon={<Star size={18} strokeWidth={2.1} color={tokens.text} />}
              label={vehicle.isPrimary ? 'Already primary' : 'Set as primary'}
              hint={vehicle.isPrimary ? undefined : 'Default for fitment filters'}
              onPress={handleSetPrimary}
              muted={vehicle.isPrimary}
            />
            <VehicleDetailActionRow
              icon={<Pencil size={18} strokeWidth={2.1} color={tokens.text} />}
              label="Edit details"
              onPress={openEditSheet}
            />
            <VehicleDetailActionRow
              icon={<Trash2 size={18} strokeWidth={2.1} color={tokens.error} />}
              label="Remove from garage"
              onPress={handleRemove}
              destructive
            />
          </AppView>
        </AppView>
      </ScrollView>

      <AppBlurView contentHeight={VEHICLE_DETAIL_HEADER_HEIGHT}>
        <VehicleDetailHeader onBack={() => router.back()} isPrimary={vehicle.isPrimary} />
      </AppBlurView>

      <AppBottomSheet
        visible={editSheetVisible}
        onClose={closeEditSheet}
        heightFraction={0.7}
      >
        <AddVehicleWizard
          key={editSessionId}
          editing={vehicle}
          onSubmit={handleEditSubmit}
          onCancel={closeEditSheet}
        />
      </AppBottomSheet>
    </AppView>
  );
}
