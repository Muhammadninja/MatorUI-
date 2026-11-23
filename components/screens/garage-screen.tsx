import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react-native';
import { RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GarageActiveHero from '@/components/screens-components/garage/garage-active-hero';
import GarageAddButton from '@/components/screens-components/garage/garage-add-button';
import GarageHeader from '@/components/screens-components/garage/garage-header';
import GarageEmptyState from '@/components/screens-components/garage/garage-empty-state';
import GarageQuickActions from '@/components/screens-components/garage/garage-quick-actions';
import GarageVehiclePickerSheet, {
  type PickedVehicle,
} from '@/components/screens-components/garage/garage-vehicle-picker-sheet';
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
import { unsupportedYearRange } from '@/services/vehicle-model-years';
import { manualVehicleRejection, vehiclePartsParams } from '@/services/manual-vehicle';
import { formatMileage } from '@/utils/mileage';
import { DEFAULT_VEHICLE_COLOR_HEX, colorHexToEnum } from '@/utils/vehicle-color';

/**
 * Garage screen — "which car am I shopping for" answered on sight.
 *
 * Success layout (per design_handoff_mator_garage, trimmed):
 *   header → active-vehicle hero → 2×2 quick actions → other-vehicles
 *   switcher → dashed add-another button.
 *
 * The handoff's fit-filter row, the header's "{n} vehicles · fit checked
 * automatically" sub-line and the tiles' static sub-copy are GONE on purpose
 * (user: the screen carried too much text to read). Between them they said the
 * same thing the hero's "Shop parts that fit" CTA already says. Do not
 * reinstate them from the handoff — the deletion is the newer decision.
 *
 * The other four states of `useGarage()` are unchanged in spirit:
 * skeleton while loading, a retry surface on error, and the empty state for
 * guests / zero vehicles. The header stays pinned.
 *
 * The empty state and the add buttons both offer a QUICK ADD sheet — make,
 * model and year in the platform's own pickers — that creates the vehicle here
 * rather than handing off to the VIN screen. The backend only requires
 * make_id + model_id + year, so the VIN flow is the precise path, not the only
 * one.
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

  /** Route 2: the make/model/year sheet is open. */
  const [pickingVehicle, setPickingVehicle] = useState(false);
  const [quickAdding, setQuickAdding] = useState(false);

  const openDetail = (id: string) => router.push({ pathname: '/vehicle-detail', params: { id } });
  const openEdit = (id: string) =>
    router.push({ pathname: '/vehicle-detail', params: { id, edit: '1' } });
  /** The VIN route. Only ever reached from an affordance that SAYS "VIN" —
   *  see `startAdd` for why. */
  const openAddByVin = () => {
    // Guests can browse but adding needs an account — route to the auth sheet
    // (gate=1) so they land back here afterwards.
    if (!isAuthenticated) {
      router.push('/sign-in?gate=1');
      return;
    }
    router.push('/add-vehicle');
  };

  /**
   * The default add route: the make/model/year sheet.
   *
   * Every unlabelled "add" affordance (the header +, the dashed button) lands
   * here, and nothing but an explicit "Add by VIN" goes to the VIN screen. The
   * + used to open the VIN screen, which made the slowest path the default:
   * walk to the car, find the plate, type 17 characters — for a create the
   * backend answers with make_id + model_id + year alone. It could also dead
   * end, on a UzAuto VIN whose model does not decode or a make the catalogue
   * has never been seeded with, and the quick sheet was unreachable once the
   * garage had a car in it.
   *
   * Guests hit the auth gate first, before the sheet opens, so they never pick
   * a car only to be bounced.
   */
  const startAdd = () => {
    if (!isAuthenticated) {
      router.push('/sign-in?gate=1');
      return;
    }
    setPickingVehicle(true);
  };

  // Explore's empty-garage hero links here with `add=1`: run the same add flow
  // once, then drop the flag so Back or a re-render doesn't reopen the sheet.
  const { add } = useLocalSearchParams<{ add?: string }>();
  useEffect(() => {
    if (add !== '1') return;
    router.setParams({ add: undefined });
    startAdd();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per link
  }, [add]);

  // Route 2, submit: make + model + year in hand -> create.
  //
  // `make_id` / `model_id` come straight from the reference catalog the picker
  // read, which is the same table `POST /v1/garage/vehicles` validates against.
  // The old path matched display NAMES back to ids through
  // `resolveCatalogIds`, which silently failed for every make the backend has
  // not seeded and for ids the two catalogs spell differently.
  const completeQuickAdd = async (picked: PickedVehicle) => {
    if (quickAdding) return;
    const { year } = picked;
    const label = `${year} ${picked.makeName} ${picked.modelName}`.replace(/\s+/g, ' ').trim();

    setQuickAdding(true);
    try {
      await addVehicle({
        make: picked.makeName,
        model: picked.modelName,
        year,
        brandId: picked.makeId ?? undefined,
        modelId: picked.modelId ?? undefined,
        // Entered by hand: the typed names, never a made-up catalog id.
        ...(picked.custom
          ? {
              customModelName: picked.modelName,
              ...(picked.makeId ? {} : { customMakeName: picked.makeName }),
            }
          : {}),
        color: colorHexToEnum(DEFAULT_VEHICLE_COLOR_HEX),
        colorHex: DEFAULT_VEHICLE_COLOR_HEX,
        // First car in an empty garage is the one being shopped for.
        setAsPrimary: vehicles.length === 0,
      });
      setPickingVehicle(false);
      toast.success(t('garage.quickAddSuccess', { vehicle: label }));
    } catch (error) {
      // The backend rejects a year the model was not built in; say which years
      // it was, instead of a generic "try again" that would fail the same way.
      const range = unsupportedYearRange(error);
      const manual = manualVehicleRejection(error);
      const model = `${picked.makeName} ${picked.modelName}`.trim();
      toast.danger(
        manual?.kind === 'inCatalog'
          ? t('garage.manualInCatalog', { model })
          : manual?.kind === 'futureYear'
            ? t('garage.manualFutureYear', { year: manual.yearTo })
            : manual?.kind === 'invalidName'
              ? t('garage.manualInvalidName')
              : range === null
                ? t('garage.quickAddFailed')
                : range.yearFrom === null
                  ? t('garage.yearUnsupportedTo', { model, to: range.yearTo })
                  : t('garage.yearUnsupported', { model, from: range.yearFrom, to: range.yearTo }),
      );
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
      toast.success(t('garage.nowActive', { vehicle: name }));
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
  // (searched by make/model), in Garage's own stack so back returns here.
  // Falls back to the Explore tab when, somehow, there's no primary vehicle.
  const shopPartsThatFit = () => {
    if (!primaryVehicle) {
      router.navigate('/explore');
      return;
    }
    router.push({
      pathname: '/garage-parts',
      params: vehiclePartsParams({
        make: primaryVehicle.make,
        model: primaryVehicle.model,
        year: primaryVehicle.year,
        label: `${primaryVehicle.make} ${primaryVehicle.model}`,
        isCustom: primaryVehicle.isCustom,
        brandId: primaryVehicle.brandId,
      }),
    });
  };

  const isSuccess = isAuthenticated && state === 'success';

  return (
    <AppView flex={1} colorName="background">
      {/* Pinned header — stays put across every state. The + add button only
       *  shows once there's a garage to add to (success); empty/guest states
       *  cue "add" through the placeholder tile, so the header + is omitted. */}
      <AppView colorName="background" style={{ paddingTop: insets.top + 8 }}>
        <GarageHeader onAddPress={isSuccess ? startAdd : undefined} />
      </AppView>

      {!isAuthenticated ? (
        // Guest: no garage to load. Same empty state as a signed-in empty
        // garage — every action inside routes to auth first.
        <AppScrollView showsVerticalScrollIndicator={false} padding={0}
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 40 }}
        >
          <GarageEmptyState onAddByVin={openAddByVin} onAddByDetails={startAdd} />
        </AppScrollView>
      ) : (state === 'loading' || state === 'idle') && vehicles.length === 0 ? (
        // Skeleton only when there is nothing to show yet. A refresh over a
        // populated garage also flips `state` to 'loading', and swapping real
        // content for a skeleton mid-pull reads as the screen breaking.
        <AppScrollView showsVerticalScrollIndicator={false} padding={0}
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 40 }}
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
            <AppView flex={1} center px={16} gap={12}>
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
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 16, paddingBottom: 40 }}
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
            onAddByVin={openAddByVin}
            onAddByDetails={startAdd}
            busy={quickAdding}
          />
        </AppScrollView>
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          padding={0}
          contentContainerStyle={{
            paddingTop: 12,
            paddingHorizontal: 16,
            paddingBottom: 40,
            gap: 12,
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

          <GarageQuickActions
            onUpdateMileage={() => (primaryVehicle ? openEdit(primaryVehicle.id) : startAdd())}
            onPastOrders={() => router.push('/order-history')}
            onAddByVin={openAddByVin}
            onSavedParts={() => router.push('/liked')}
            mileageLabel={formatMileage(
              primaryVehicle?.mileage,
              t('garage.mileageUnit'),
              language,
            )}
          />

          {secondaryVehicles.length > 0 ? (
            <>
              <AppText textVariant="h4" weight="bold" colorName="text" style={{ marginTop: 12 }}>
                {t('garage.otherVehicles')}
              </AppText>
              <AppView gap={8}>
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

          <GarageAddButton onPress={startAdd} />
        </AppScrollView>
      )}

      {/* Mounted outside the state branches on purpose: a successful create
       *  flips `state` from 'empty' to 'success', which would unmount a sheet
       *  owned by the empty branch mid-dismiss. */}
      <GarageVehiclePickerSheet
        visible={pickingVehicle}
        onClose={() => setPickingVehicle(false)}
        onSubmit={completeQuickAdd}
        // The way OUT to the precise route, so making the sheet the default
        // does not hide the VIN flow from someone who wants exact trim and
        // engine. It is the only door to it that is not labelled "VIN".
        onUseVin={() => {
          setPickingVehicle(false);
          openAddByVin();
        }}
        busy={quickAdding}
      />
    </AppView>
  );
}
