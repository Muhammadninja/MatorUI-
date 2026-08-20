import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react-native';
import { RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GarageActiveHero from '@/components/screens-components/garage/garage-active-hero';
import GarageAddButton from '@/components/screens-components/garage/garage-add-button';
import GarageFitRow from '@/components/screens-components/garage/garage-fit-row';
import GarageHeader from '@/components/screens-components/garage/garage-header';
import GaragePlaceholderTile from '@/components/screens-components/garage/garage-placeholder-tile';
import GarageQuickActions from '@/components/screens-components/garage/garage-quick-actions';
import GarageSkeleton from '@/components/screens-components/garage/garage-skeleton';
import GarageSwitchRow from '@/components/screens-components/garage/garage-switch-row';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useToast } from '@/hooks/use-toast';
import useGarage from '@/hooks/use-garage';
import type { Vehicle } from '@/services/garage-service';

/**
 * Garage screen — "which car am I shopping for" answered on sight.
 *
 * Success layout (per design_handoff_mator_garage):
 *   header → active-vehicle hero → fit-filter row → 2×2 quick actions →
 *   other-vehicles switcher → dashed add-another button.
 *
 * The other four states of `useGarage()` are unchanged in spirit:
 * skeleton while loading, a retry surface on error, and the ghost-slot
 * placeholder for guests / zero vehicles. The header stays pinned.
 */
export default function GarageScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { isAuthenticated } = useUserContext();
  const { state, vehicles, primaryVehicle, secondaryVehicles, error, refresh, setPrimary } =
    useGarage();

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

  const setActive = async (vehicle: Vehicle) => {
    if (vehicle.id === primaryVehicle?.id) return;
    const name = `${vehicle.year} ${vehicle.make} ${vehicle.model}`;
    try {
      await setPrimary(vehicle.id);
      toast.info(t('garage.nowActive', { vehicle: name }));
    } catch {
      toast.danger(t('garage.setPrimaryFailed'));
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
        // Guest: no garage to load. Ghost "slot" placeholder → auth on tap.
        <AppScrollView showsVerticalScrollIndicator={false} padding={0}
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40 }}
        >
          <GaragePlaceholderTile onAdd={openAdd} />
        </AppScrollView>
      ) : state === 'loading' || state === 'idle' ? (
        <AppScrollView showsVerticalScrollIndicator={false} padding={0}
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40 }}
        >
          <GarageSkeleton />
        </AppScrollView>
      ) : state === 'error' ? (
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
          <AppButton title={t('common.retry')} kind="secondary" size="sm" onPress={refresh} />
        </AppView>
      ) : state === 'empty' ? (
        // Zero vehicles: ghost "slot" placeholder cueing a car belongs here.
        <AppScrollView
          showsVerticalScrollIndicator={false}
          padding={0}
          contentContainerStyle={{ paddingTop: 12, paddingHorizontal: 20, paddingBottom: 40 }}
          refreshControl={
            <RefreshControl
              refreshing={false}
              onRefresh={refresh}
              tintColor={tokens.textMuted}
              colors={[tokens.brandBg]}
            />
          }
        >
          <GaragePlaceholderTile onAdd={openAdd} />
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
              refreshing={false}
              onRefresh={refresh}
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

          <GarageFitRow />

          <GarageQuickActions
            onUpdateMileage={() => (primaryVehicle ? openEdit(primaryVehicle.id) : openAdd())}
            onPastOrders={() => router.push('/order-history')}
            onScanVin={openAdd}
            onSavedParts={() => router.push('/liked')}
            mileageLabel={
              primaryVehicle?.mileage != null
                ? `${primaryVehicle.mileage.toLocaleString('en-US')} ${t('garage.mileageUnit')}`
                : undefined
            }
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
                  <GarageSwitchRow key={v.id} vehicle={v} onSetActive={setActive} />
                ))}
              </AppView>
            </>
          ) : null}

          <GarageAddButton onPress={openAdd} />
        </AppScrollView>
      )}
    </AppView>
  );
}
