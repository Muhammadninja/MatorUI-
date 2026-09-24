import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react-native';
import { RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GarageActiveHero from '@/components/screens-components/garage/garage-active-hero';
import GarageAddButton from '@/components/screens-components/garage/garage-add-button';
import GarageFitRow from '@/components/screens-components/garage/garage-fit-row';
import GarageHeader from '@/components/screens-components/garage/garage-header';
import GarageEmptyState from '@/components/screens-components/garage/garage-empty-state';
import GarageQuickActions from '@/components/screens-components/garage/garage-quick-actions';
import GarageModelPickerSheet, {
  type PickedModel,
} from '@/components/screens-components/garage/garage-model-picker-sheet';
import GarageQuickAddSheet from '@/components/screens-components/garage/garage-quick-add-sheet';
import GarageSkeleton from '@/components/screens-components/garage/garage-skeleton';
import GarageSwitchRow from '@/components/screens-components/garage/garage-switch-row';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useActiveVehicle } from '@/contexts/active-vehicle.context';
import { useThemeContext } from '@/contexts/theme.context';
import { useLanguageContext } from '@/contexts/language.context';
import { useUserContext } from '@/contexts/user.context';
import { useToast } from '@/hooks/use-toast';
import useGarage from '@/hooks/use-garage';
import type { Vehicle } from '@/services/garage-service';
import { formatMileage } from '@/utils/mileage';
import { DEFAULT_VEHICLE_COLOR_HEX, colorHexToEnum } from '@/utils/vehicle-color';

/**
 * Garage screen — "which car am I shopping for" answered on sight.
 *
 * Success layout (per design_handoff_mator_garage):
 *   header → active-vehicle hero → fit-filter row → 2×2 quick actions →
 *   other-vehicles switcher → dashed add-another button.
 *
 * The other four states of `useGarage()` are unchanged in spirit:
 * skeleton while loading, a retry surface on error, and the empty state for
 * guests / zero vehicles. The header stays pinned.
 *
 * The empty state carries a two-tap QUICK ADD (popular model → year) that
 * creates the vehicle here rather than handing off to the VIN screen. The
 * backend only requires make_id + model_id + year, so the VIN flow is the
 * precise path, not the only one.
 */
export default function GarageScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { isAuthenticated } = useUserContext();
  const { language } = useLanguageContext();
  // Flipping `isPrimary` alone is NOT enough to change the car the catalog
  // filters by. The active-vehicle context pins a chosen vehicle and, on a
  // garage update, prefers that pin over whichever row carries `isPrimary`
  // (active-vehicle.context.tsx). Without moving the pin too, "Set active"
  // toasted success while every fit check kept using the previous car.
  const { setPrimaryVehicle } = useActiveVehicle();
  const { state, vehicles, primaryVehicle, secondaryVehicles, error, refresh, setPrimary, addVehicle } =
    useGarage();

  /** Pull-to-refresh in flight. Tracked here rather than read off the hook's
   *  `isLoading`, which the state machine turns into 'loading' — that would
   *  swap a populated garage for the skeleton on every pull. */
  const [refreshing, setRefreshing] = useState(false);

  /** Route 2, step 1: the model picker is open. */
  const [pickingModel, setPickingModel] = useState(false);
  /** Route 2, step 2: the make/model awaiting a year. */
  const [quickPick, setQuickPick] = useState<PickedModel | null>(null);
  const [quickAdding, setQuickAdding] = useState(false);

  const openDetail = (id: string) => router.push({ pathname: '/vehicle-detail', params: { id } });
  const openEdit = (id: string) =>
    router.push({ pathname: '/vehicle-detail', params: { id, edit: '1' } });
  const openAdd = () => {
    // Guests can browse but adding needs an account — route to the auth sheet
    // (gate=1) so they land back here afterwards.
    if (!isAuthenticated) {
      router.push('/sign-in?gate=1');
      return;
    }
    router.push('/add-vehicle');
  };

  // Route 2, step 1: open the model picker. Guests hit the auth gate first —
  // same rule as the VIN route, applied before the sheet opens so they never
  // pick a car only to be bounced.
  const startAddByDetails = () => {
    if (!isAuthenticated) {
      router.push('/sign-in?gate=1');
      return;
    }
    setPickingModel(true);
  };

  // Route 2, step 2: model chosen → hand off to the year sheet.
  const onModelPicked = (model: PickedModel) => {
    setPickingModel(false);
    setQuickPick(model);
  };

  // Route 2, step 3: year chosen -> create.
  //
  // `make_id` / `model_id` come straight from the reference catalog the picker
  // read, which is the same table `POST /v1/garage/vehicles` validates against.
  // The old path matched display NAMES back to ids through
  // `resolveCatalogIds`, which silently failed for every make the backend has
  // not seeded and for ids the two catalogs spell differently.
  const completeQuickAdd = async (year: number) => {
    const picked = quickPick;
    if (!picked || quickAdding) return;
    const label = `${year} ${picked.makeName} ${picked.modelName}`.replace(/\s+/g, ' ').trim();

    setQuickAdding(true);
    try {
      await addVehicle({
        make: picked.makeName,
        model: picked.modelName,
        year,
        brandId: picked.makeId,
        modelId: picked.modelId,
        color: colorHexToEnum(DEFAULT_VEHICLE_COLOR_HEX),
        colorHex: DEFAULT_VEHICLE_COLOR_HEX,
        // First car in an empty garage is the one being shopped for.
        setAsPrimary: vehicles.length === 0,
      });
      setQuickPick(null);
      toast.success(t('garage.quickAddSuccess', { vehicle: label }));
    } catch {
      toast.danger(t('garage.quickAddFailed'));
    } finally {
      setQuickAdding(false);
    }
  };

  const setActive = async (vehicle: Vehicle) => {
    if (vehicle.id === primaryVehicle?.id) return;
    const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    try {
      // Backend FIRST so a rejection surfaces: `setPrimaryVehicle` swallows its
      // own backend error by design (it keeps an optimistic local pin), which
      // would make the failure toast below unreachable. Once the server has
      // accepted, move the pin with `skipBackend` so the flip isn't sent twice.
      await setPrimary(vehicle.id);
      await setPrimaryVehicle(vehicle.id, { skipBackend: true });
      toast.info(t('garage.nowActive', { vehicle: name }));
    } catch {
      toast.danger(t('garage.setPrimaryFailed'));
    }
  };

  /** Pull-to-refresh. Owns its own flag so the spinner actually spins for the
   *  duration of the request instead of vanishing on the same frame. */
  const onPullRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  // "Shop parts that fit" → the bestsellers list scoped to the active vehicle
  // (searched by make/model). Falls back to the Explore tab when, somehow,
  // there's no primary vehicle to scope by.
  const shopPartsThatFit = () => {
    if (!primaryVehicle) {
      router.navigate('/explore');
      return;
    }
    router.navigate({
      pathname: '/vehicle-parts',
      params: {
        make: primaryVehicle.make,
        model: primaryVehicle.model,
        year: String(primaryVehicle.year),
        label: `${primaryVehicle.make} ${primaryVehicle.model}`,
      },
    });
  };

  const isSuccess = isAuthenticated && state === 'success';
  const headerSubtitle = isSuccess
    ? `${vehicles.length} ${vehicles.length === 1 ? t('garage.vehicleSingular') : t('garage.vehiclePlural')} · ${t('garage.fitCheckedAuto')}`
    : undefined;

  return (
    <AppView flex={1} colorName="background">
      {/* Pinned header — stays put across every state. The + add button only
       *  shows once there's a garage to add to (success); empty/guest states
       *  cue "add" through the placeholder tile, so the header + is omitted. */}
      <AppView colorName="background" style={{ paddingTop: insets.top + 8 }}>
        <GarageHeader subtitle={headerSubtitle} onAddPress={isSuccess ? openAdd : undefined} />
      </AppView>

      {!isAuthenticated ? (
        // Guest: no garage to load. Same empty state as a signed-in empty
        // garage — every action inside routes to auth first.
        <AppScrollView showsVerticalScrollIndicator={false} padding={0}
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40 }}
        >
          <GarageEmptyState onAddByVin={openAdd} onAddByDetails={startAddByDetails} />
        </AppScrollView>
      ) : (state === 'loading' || state === 'idle') && vehicles.length === 0 ? (
        // Skeleton only when there is nothing to show yet. A refresh over a
        // populated garage also flips `state` to 'loading', and swapping real
        // content for a skeleton mid-pull reads as the screen breaking.
        <AppScrollView showsVerticalScrollIndicator={false} padding={0}
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40 }}
        >
          <GarageSkeleton />
        </AppScrollView>
      ) : state === 'error' ? (
        // Scrollable so pull-to-refresh works here too: on a flaky connection
        // the reflex is to pull, and a non-scrolling view swallows it.
        <AppScrollView
          showsVerticalScrollIndicator={false}
          padding={0}
          contentContainerStyle={{ flexGrow: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              tintColor={tokens.textMuted}
              colors={[tokens.brandBg]}
            />
          }
        >
            <AppView flex={1} center px={20} gap={14}>
            <AlertCircle size={34} strokeWidth={2} color={tokens.error} />
            <AppView gap={4} align="center">
              <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
                {t('garage.errorTitle')}
              </AppText>
              <AppText
                family="default"
                style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
              >
                {error ?? t('garage.errorGeneric')}
              </AppText>
            </AppView>
            <AppButton
              title={t('common.retry')}
              kind="secondary"
              size="sm"
              onPress={onPullRefresh}
            />
          </AppView>
        </AppScrollView>
      ) : state === 'empty' ? (
        // Zero vehicles: the full empty state, quick add included.
        <AppScrollView
          showsVerticalScrollIndicator={false}
          padding={0}
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              tintColor={tokens.textMuted}
              colors={[tokens.brandBg]}
            />
          }
        >
          <GarageEmptyState
            onAddByVin={openAdd}
            onAddByDetails={startAddByDetails}
            busy={quickAdding}
          />
        </AppScrollView>
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          padding={0}
          contentContainerStyle={{
            paddingTop: 12,
            paddingHorizontal: 20,
            paddingBottom: 40,
            gap: 14,
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onPullRefresh}
              tintColor={tokens.textMuted}
              colors={[tokens.brandBg]}
            />
          }
        >
          {primaryVehicle ? (
            <GarageActiveHero
              vehicle={primaryVehicle}
              onShopParts={shopPartsThatFit}
              onOpenDetail={openDetail}
            />
          ) : null}

          <GarageFitRow vehicle={primaryVehicle} />

          <GarageQuickActions
            onUpdateMileage={() => (primaryVehicle ? openEdit(primaryVehicle.id) : openAdd())}
            onPastOrders={() => router.push('/order-history')}
            onAddByVin={openAdd}
            onSavedParts={() => router.push('/liked')}
            mileageLabel={formatMileage(
              primaryVehicle?.mileage,
              t('garage.mileageUnit'),
              language,
            )}
          />

          {secondaryVehicles.length > 0 ? (
            <>
              <AppView row align="flex-end" justify="space-between" style={{ marginTop: 2 }}>
                <AppText family="heading" weight="bold" colorName="text" style={{ fontSize: 17 }}>
                  {t('garage.otherVehicles')}
                </AppText>
                <AppText family="accent" weight="semibold" colorName="textMuted" style={{ fontSize: 12 }}>
                  {t('garage.tapToSwitch')}
                </AppText>
              </AppView>
              <AppView gap={10}>
                {secondaryVehicles.map((v) => (
                  <GarageSwitchRow
                    key={v.id}
                    vehicle={v}
                    onSetActive={setActive}
                    onOpenDetail={openDetail}
                  />
                ))}
              </AppView>
            </>
          ) : null}

          <GarageAddButton onPress={openAdd} />
        </AppScrollView>
      )}

      {/* Both sheets are mounted outside the state branches on purpose: a
       *  successful create flips `state` from 'empty' to 'success', which
       *  would unmount a sheet owned by the empty branch mid-dismiss. */}
      <GarageModelPickerSheet
        visible={pickingModel}
        onClose={() => setPickingModel(false)}
        onPick={onModelPicked}
      />
      <GarageQuickAddSheet
        model={quickPick}
        onClose={() => setQuickPick(null)}
        // Back reopens the model picker rather than dropping the user out of
        // the flow, so changing your mind about the model costs one tap.
        onBack={() => {
          setQuickPick(null);
          setPickingModel(true);
        }}
        onPickYear={completeQuickAdd}
        busy={quickAdding}
      />
    </AppView>
  );
}
