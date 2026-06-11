import { router, useLocalSearchParams } from 'expo-router';
import { Pencil, ScanLine, Star, Trash2 } from 'lucide-react-native';
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
import VinScannerModal from '@/components/screens-components/vin-scanner/vin-scanner-modal';
import AppBlurView, { useBlurHeaderInset } from '@/components/shared/app-blur-view';
import AppBottomSheet from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import { AppInlineError } from '@/components/shared/app-inline-error';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import useGarage from '@/hooks/use-garage';
import useGarageRealtime from '@/hooks/use-garage-realtime';
import { useGlobalModal } from '@/hooks/use-global-modal';
import useVinScanner from '@/hooks/use-vin-scanner';
import { garageService } from '@/services/garage-service';
import { toastService } from '@/services/toast-service';
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
  const { vehicles, setPrimary, removeVehicle, updateVehicle, addVehicle, error, clearError } = useGarage();
  const { setPrimaryVehicle } = useActiveVehicle();
  const { openConfirm } = useGlobalModal();
  const params = useLocalSearchParams<{ id?: string }>();
  // peek=-24 means content paddingTop = insets.top + headerHeight + fadeHeight,
  // i.e. the headline starts BELOW the entire blur strip (no overlap behind the fade).
  const topInset = useBlurHeaderInset(VEHICLE_DETAIL_HEADER_HEIGHT, -24);

  const [editSheetVisible, setEditSheetVisible] = useState(false);
  const [editSessionId, setEditSessionId] = useState(0);
  /** Which action is currently mid-mutation. Used to:
   *  - show "Setting…" / "Removing…" label on the active action
   *  - mute every other action so the user can't pile up concurrent
   *    mutations (e.g. tap Remove then Set Primary before the first lands).
   *  Cleared in `finally` so a thrown mutation still re-enables the UI. */
  const [pendingAction, setPendingAction] = useState<'remove' | 'set_primary' | null>(null);
  const isAnyMutationPending = pendingAction !== null;

  const vehicle = useMemo(() => {
    if (!params.id) return undefined;
    return vehicles.find((v) => v.id === params.id) ?? garageService.getById(params.id);
  }, [params.id, vehicles]);

  // Realtime channel subscription. The transport mutates the garage
  // cache on incoming events, so the `vehicle.liveStatus` field above
  // will update automatically when a mechanic broadcasts. We tap the
  // `onEvent` callback only to play a haptic + toast for status
  // changes on THIS vehicle, so the user gets a perceptible cue when
  // their car's status changes while they're staring at the screen.
  useGarageRealtime({
    vehicleIdFilter: vehicle?.id,
    onEvent: (event) => {
      if (event.event !== 'garage.vehicle.status.updated') return;
      if (!event.status) return;
      triggerHaptic('selection');
      if (event.status.stage === 'ready') {
        toastService.success('Your car is ready', { description: event.status.label });
      } else if (event.status.stage === 'flagged') {
        toastService.danger('Mechanic flagged an issue', { description: event.status.label });
      } else {
        toastService.info(event.status.label, { description: event.status.note });
      }
    },
  });

  // VIN scanner — wired to update the vehicle's vin on success.
  const vinScanner = useVinScanner({
    acceptInvalidChecksum: true,
    onResult: async (vin) => {
      if (!vehicle) return;
      try {
        await updateVehicle(vehicle.id, { vin });
        toastService.success('VIN updated', { description: vin });
      } catch {
        // Surfaced via the hook's error state.
      }
    },
  });

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
          <AppButton
            title="Go back"
            kind="brand"
            size="sm"
            onPress={() => router.back()}
          />
        </AppView>
      </ScreenShell>
    );
  }

  const headline = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
  const subline = [vehicle.trim, vehicle.nickname].filter(Boolean).join(' · ') || 'In your garage';

  async function handleSetPrimary() {
    if (!vehicle || vehicle.isPrimary || isAnyMutationPending) return;
    triggerHaptic('success');
    setPendingAction('set_primary');
    try {
      // Route through the active-vehicle context so the parts-search
      // scope updates atomically with the backend flip. The context
      // calls `garageService.setPrimary` for us — going through both
      // here would double-flip.
      await setPrimaryVehicle(vehicle.id);
      // Explicit success confirmation. Closes the "did that work?"
      // moment after the label flips back to "Already primary".
      toastService.success('Set as primary', { description: headline });
    } catch {
      // Surfaced via the hook's error state.
    } finally {
      setPendingAction(null);
    }
  }

  function handleFindParts() {
    triggerHaptic('selection');
    router.push('/explore');
  }

  function handleRemove() {
    if (!vehicle || isAnyMutationPending) return;
    // Snapshot the vehicle data BEFORE the confirm so the undo path
    // can re-create it. Captured outside the async closure so refs
    // can't go stale. Vehicle gets a new id on undo (the original is
    // gone server-side) — semantically still "the same car" to the user.
    const undoSnapshot = {
      year: vehicle.year,
      make: vehicle.make,
      model: vehicle.model,
      trim: vehicle.trim,
      nickname: vehicle.nickname,
      vin: vehicle.vin,
      plate: vehicle.plate,
      mileage: vehicle.mileage,
      color: vehicle.color,
      setAsPrimary: vehicle.isPrimary,
    };
    const snapshotHeadline = headline;
    openConfirm({
      title: 'Remove vehicle?',
      message: `${headline} will be removed from your garage.`,
      confirmLabel: 'Remove',
      cancelLabel: 'Cancel',
      onConfirm: async () => {
        triggerHaptic('warning');
        setPendingAction('remove');
        try {
          await removeVehicle(vehicle.id);
          router.back();
          // Undo toast — gives the user 5 seconds to recover from an
          // accidental tap. Tapping "Undo" re-creates the vehicle from
          // the snapshot taken before the destructive call.
          toastService.info(`Removed ${snapshotHeadline}`, {
            description: 'Tap undo to bring it back',
            actionLabel: 'Undo',
            duration: 5000,
            onAction: async () => {
              try {
                await addVehicle(undoSnapshot);
                toastService.success('Restored', { description: snapshotHeadline });
              } catch {
                // Hook's error state surfaces; user can retry from garage.
              }
            },
          });
        } catch {
          // Surfaced via the hook's error state; stay on the detail screen.
        } finally {
          setPendingAction(null);
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
          {/* Mutation-error pill. Surfaces failures from set-primary,
           *  remove, or update so the user can dismiss and retry. The
           *  detail screen stays visible underneath — the vehicle data
           *  is still valid, only the last mutation failed. */}
          {error ? (
            <AppView px={20}>
              <AppInlineError message={error} onDismiss={clearError} />
            </AppView>
          ) : null}
          <VehicleDetailHeadline headline={headline} subline={subline} />

          <VehicleDetailStats
            mileage={formatMileage(vehicle.mileage)}
            plate={vehicle.plate ?? '—'}
            color={titleCase(vehicle.color)}
            liveStatus={vehicle.liveStatus}
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
              icon={<ScanLine size={18} strokeWidth={2} color={tokens.text} />}
              label={vehicle.vin ? `VIN · ${vehicle.vin}` : 'Scan VIN with camera'}
              hint={
                vehicle.vin
                  ? 'Tap to re-scan or replace'
                  : 'Photograph the VIN barcode for exact-fit parts'
              }
              onPress={() => {
                triggerHaptic('selection');
                vinScanner.open();
              }}
              muted={isAnyMutationPending}
            />
            <VehicleDetailActionRow
              icon={<ScanLine size={18} strokeWidth={2} color={tokens.text} />}
              label="Find compatible parts"
              hint="Filter the catalog by this vehicle"
              onPress={handleFindParts}
              muted={isAnyMutationPending}
            />
            {/* "Service log — Coming soon" row removed: shipping
             *  placeholder rows in production action lists makes the
             *  surface look unfinished. Re-add when the feature ships. */}
            <VehicleDetailActionRow
              icon={<Star size={18} strokeWidth={2} color={tokens.text} />}
              label={
                pendingAction === 'set_primary'
                  ? 'Setting…'
                  : vehicle.isPrimary
                  ? 'Already primary'
                  : 'Set as primary'
              }
              hint={vehicle.isPrimary ? undefined : 'Default for fitment filters'}
              onPress={handleSetPrimary}
              muted={vehicle.isPrimary || isAnyMutationPending}
            />
            <VehicleDetailActionRow
              icon={<Pencil size={18} strokeWidth={2} color={tokens.text} />}
              label="Edit details"
              onPress={openEditSheet}
              muted={isAnyMutationPending}
            />
            <VehicleDetailActionRow
              icon={<Trash2 size={18} strokeWidth={2} color={tokens.error} />}
              label={pendingAction === 'remove' ? 'Removing…' : 'Remove from garage'}
              onPress={handleRemove}
              destructive
              muted={isAnyMutationPending && pendingAction !== 'remove'}
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
        heightFraction={0.85}
      >
        <AddVehicleWizard
          key={editSessionId}
          editing={vehicle}
          onSubmit={handleEditSubmit}
          onCancel={closeEditSheet}
        />
      </AppBottomSheet>

      <VinScannerModal
        visible={vinScanner.isOpen}
        onClose={vinScanner.close}
        onBarcodeScanned={vinScanner.onBarcodeScanned}
      />
    </AppView>
  );
}
