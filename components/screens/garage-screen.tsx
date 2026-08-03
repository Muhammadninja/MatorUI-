import { router } from 'expo-router';
import { AlertCircle } from 'lucide-react-native';
import { RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import GarageEmptyState from '@/components/screens-components/garage/garage-empty-state';
import GarageHeader from '@/components/screens-components/garage/garage-header';
import GaragePrimaryVehicleCard from '@/components/screens-components/garage/garage-primary-vehicle-card';
import GarageSkeleton from '@/components/screens-components/garage/garage-skeleton';
import GarageVehicleTile from '@/components/screens-components/garage/garage-vehicle-tile';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import useGarage from '@/hooks/use-garage';

/**
 * Garage screen — the real, transport-abstracted garage layer.
 *
 * Renders `useGarage().state` as a five-state machine (idle/loading/
 * error/empty/success) matching the Explore-screen convention:
 * skeleton while the first fetch is in flight, a retry surface on
 * error, the designed empty state when the user has no vehicles, and
 * the primary card + secondary tiles on success. The pinned header
 * stays put across every state.
 *
 * Each card exposes a single kebab (⋮) affordance that opens the
 * vehicle detail screen; managing the active vehicle / finding parts
 * lives on that detail screen rather than inline on the cards.
 */
export default function GarageScreen() {
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useUserContext();
  const { state, primaryVehicle, secondaryVehicles, error, refresh } = useGarage();

  const openDetail = (id: string) =>
    router.push({ pathname: '/vehicle-detail', params: { id } });
  const openAdd = () => {
    // Guests can browse the garage and see the Add button, but adding a vehicle
    // needs an account — tapping Add triggers the unified phone-OTP auth sheet
    // (gate=1). After signing in they land back here and can add.
    if (!isAuthenticated) {
      router.push('/sign-in?gate=1');
      return;
    }
    router.push('/add-vehicle');
  };

  return (
    <AppView flex={1} colorName="background">
      {/* Pinned header — stays put across every state. */}
      <AppView colorName="background" style={{ paddingTop: insets.top + 8 }}>
        <GarageHeader onAddPress={openAdd} />
        <AppText
          family="default"
          colorName="textMuted"
          style={{ fontSize: 13.5, paddingHorizontal: 20, paddingBottom: 4 }}
        >
          Set an active vehicle to filter every part by exact fit.
        </AppText>
      </AppView>

      {!isAuthenticated ? (
        // Guest: no garage to load — show the same empty state (with the Add
        // button) as a signed-in user with zero vehicles. Add → auth sheet.
        <GarageEmptyState onAddVehicle={openAdd} />
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
              Couldn&apos;t load your garage
            </AppText>
            <AppText
              family="default"
              style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
            >
              {error ?? 'Something went wrong. Please try again.'}
            </AppText>
          </AppView>
          <AppButton title="Retry" kind="secondary" size="sm" onPress={refresh} />
        </AppView>
      ) : state === 'empty' ? (
        <GarageEmptyState onAddVehicle={openAdd} />
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          padding={0}
          contentContainerStyle={{
            paddingTop: 12,
            paddingHorizontal: 20,
            paddingBottom: 40,
            gap: 16,
          }}
          refreshControl={
            // A refresh on a populated cache flips `state` to 'loading',
            // which swaps this branch out for the skeleton — so the pull
            // gesture itself never needs to hold a spinner here.
            <RefreshControl
              refreshing={false}
              onRefresh={refresh}
              tintColor={tokens.textMuted}
              colors={[tokens.brandBg]}
            />
          }
        >
          {primaryVehicle ? (
            <GaragePrimaryVehicleCard
              vehicle={primaryVehicle}
              image={primaryVehicle.images?.[0]}
              onOpenDetail={openDetail}
            />
          ) : null}

          {secondaryVehicles.length > 0 ? (
            <>
              <AppText
                family="accent"
                weight="semibold"
                colorName="textMuted"
                transform="uppercase"
                style={{ fontSize: 11, letterSpacing: 0.8, marginTop: 4 }}
              >
                Also in the garage
              </AppText>
              {secondaryVehicles.map((v) => (
                <GarageVehicleTile
                  key={v.id}
                  vehicle={v}
                  onOpenDetail={openDetail}
                />
              ))}
            </>
          ) : null}
        </AppScrollView>
      )}
    </AppView>
  );
}
