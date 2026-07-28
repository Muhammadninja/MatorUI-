import React from 'react';
import { Image } from 'react-native';

import { router, useFocusEffect } from 'expo-router';
import {
  Heart,
  MapPin,
  ReceiptText,
  Shield,
  User,
} from 'lucide-react-native';

import ProfileGuestEmpty from '@/components/screens-components/profile/profile-guest-empty';
import ScreenShell from '@/components/screens-components/screen-shell';
import { AppIconBox } from '@/components/shared/app-icon-box';
import { AppListItem } from '@/components/shared/app-list-item';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppButton } from '@/components/shared/app-button';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useLikesContext } from '@/contexts/likes.context';
import { debugLog } from '@/services/debug-log';
import { useToast } from '@/hooks/use-toast';
import useGarage from '@/hooks/use-garage';
import { useOrders } from '@/hooks/use-orders';
import { useUserContext, type UserProfile } from '@/contexts/user.context';

const SECTION_RADIUS = 16;

// ── Account list row definitions ─────────────────────────────────────────────
// Defined at module scope so the array is stable across renders.

type AccountItem = {
  key: string;
  title: string;
  subtitle?: string;
  leading: React.ReactNode;
  rightChevron: boolean;
  onPress: () => void;
};

const ACCOUNT_ITEMS: AccountItem[] = [
  {
    key: 'edit-profile',
    title: 'Edit profile',
    subtitle: 'Name, email, phone',
    leading: <AppIconBox Icon={User} rounded={11} />,
    rightChevron: true,
    onPress: () => router.push('/edit-profile'),
  },
  {
    key: 'orders',
    title: 'Order history',
    subtitle: 'View your orders',
    leading: <AppIconBox Icon={ReceiptText} rounded={11} />,
    rightChevron: true,
    onPress: () => router.push('/order-history'),
  },
  {
    key: 'addresses',
    title: 'Shipping addresses',
    subtitle: 'Manage delivery addresses',
    leading: <AppIconBox Icon={MapPin} rounded={11} />,
    rightChevron: true,
    onPress: () => router.push('/shipping-addresses'),
  },
  {
    key: 'liked',
    title: 'Liked',
    subtitle: 'Parts you saved',
    leading: <AppIconBox Icon={Heart} rounded={11} />,
    rightChevron: true,
    onPress: () => router.push('/liked'),
  },
  {
    key: 'settings',
    title: 'Settings & security',
    subtitle: 'Password, privacy',
    leading: <AppIconBox Icon={Shield} rounded={11} />,
    rightChevron: true,
    onPress: () => router.push('/settings-security'),
  },
];

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const toast = useToast();
  const { profile, isAuthenticated, isHydrating, signOut, refreshProfile } = useUserContext();

  // Re-fetch GET /v1/me every time the tab gains focus so freshly-saved fields
  // (avatar_url, name) show up without an app restart. The context was only
  // hydrated once at cold boot, so an avatar saved after that would stay stale.
  useFocusEffect(
    React.useCallback(() => {
      void refreshProfile();
    }, [refreshProfile]),
  );
  // Real counts for the stat cards (no mock numbers).
  const { vehicles } = useGarage();
  const { likedIds } = useLikesContext();
  // Order count from the live order list (GET /v1/orders). The backend is
  // cursor-paginated with no grand total, so this counts the user's recent
  // orders on the first page — EXCLUDING cancelled/expired ones (both surface as
  // the 'Cancelled' list status), so the stat reflects real orders placed.
  const { page: ordersPage } = useOrders();
  const orderCount = React.useMemo(
    () => (ordersPage?.items ?? []).filter((o) => o.status !== 'Cancelled').length,
    [ordersPage],
  );

  const handleSignOut = async () => {
    await signOut();
    toast.info('Signed out');
    router.replace('/explore');
  };

  // Brief cold-boot hydrate — avoid flashing the guest state before we know
  // whether a persisted session exists.
  if (isHydrating) {
    return <ScreenShell />;
  }

  // Guest session — mirror the standalone guest empty experience.
  if (!isAuthenticated || !profile) {
    return (
      <ScreenShell>
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <ProfileGuestEmpty />
        </AppScrollView>
      </ScreenShell>
    );
  }

  return (
    <ScreenShell>
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <AppView gap="xl" pt="md">
          {/* Handoff §17: 64px avatar, name 21/700, email, Pro pill */}
          <ProfileHeader profile={profile} />

          {/* 3-equal stats cards — real counts (0 = the honest empty state). */}
          <AppView row gap="sm" px="lg">
            <StatCard label="Orders" value={String(orderCount)} />
            <StatCard label="Vehicles" value={String(vehicles.length)} />
            <StatCard label="Saved" value={String(likedIds.size)} />
          </AppView>

          {/* Handoff §17: list rows with icon tile 11-radius + title + sub + chevron */}
          <AppView gap={10} px="lg">
            <AppView rounded={SECTION_RADIUS} colorName="card" borderWidth={1} borderName="border">
              {ACCOUNT_ITEMS.map(({ key, ...item }, index) => (
                <AppListItem
                  key={key}
                  {...item}
                  _isFirst={index === 0}
                  _isLast={index === ACCOUNT_ITEMS.length - 1}
                  _parentRounded={SECTION_RADIUS}
                  divider={index !== ACCOUNT_ITEMS.length - 1}
                  colorName="card"
                />
              ))}
            </AppView>
          </AppView>

          {/* "Sign out" as a plain text button — the default `primary` tint is
              near-white in light mode (invisible); `kind="text"` uses the theme
              text color so it reads in both light and dark. */}
          <AppView px="lg">
            <AppButton
              title="Sign out"
              variant="ghost"
              kind="text"
              size="lg"
              fullWidth
              onPress={handleSignOut}
            />
          </AppView>
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}

// ── Profile Header ────────────────────────────────────────────────────────────

function ProfileHeader({ profile }: { profile: UserProfile }) {
  const avatarUri = profile.avatarUrl;
  const { tokens } = useThemeContext();
  const fullName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
  const monogram =
    `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || 'M';

  return (
    <AppView row align="center" gap={14} px="lg" style={{ paddingTop: 8 }}>
      {/* 64px avatar with striped monogram per prototype */}
      <AppView
        center
        rounded={999}
        style={{
          width: 64,
          height: 64,
          flexShrink: 0,
          overflow: 'hidden',
          backgroundColor: tokens.backgroundSecondary,
          borderWidth: 1,
          borderColor: tokens.border,
        }}
      >
        {avatarUri ? (
          <Image
            source={{ uri: avatarUri }}
            style={{ width: 64, height: 64 }}
            onError={(e) =>
              debugLog('profile', '✗ avatar image failed to load', {
                url: avatarUri,
                error: e.nativeEvent?.error,
              })
            }
          />
        ) : (
          <AppText
            family="heading"
            weight="bold"
            style={{ fontSize: 22, lineHeight: 26, color: tokens.text }}
          >
            {monogram}
          </AppText>
        )}
      </AppView>

      {/* Name (21/700) + email + Pro pill */}
      <AppView style={{ flex: 1 }}>
        <AppText
          family="heading"
          weight="bold"
          style={{ fontSize: 21, lineHeight: 26, color: tokens.text }}
        >
          {fullName || 'Your Profile'}
        </AppText>
        <AppText
          family="default"
          style={{ fontSize: 13, color: tokens.textMuted, marginTop: 2 }}
        >
          {profile.email || profile.phone || ''}
        </AppText>
      </AppView>
    </AppView>
  );
}

// ── Stats Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  const { tokens } = useThemeContext();
  return (
    <AppView
      flex={1}
      align="center"
      gap={3}
      py={14}
      rounded={14}
      style={{
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: tokens.card,
      }}
    >
      <AppText
        family="heading"
        weight="bold"
        style={{ fontSize: 20, lineHeight: 24, color: tokens.text }}
      >
        {value}
      </AppText>
      <AppText
        family="default"
        style={{ fontSize: 11.5, color: tokens.textMuted, marginTop: 2 }}
      >
        {label}
      </AppText>
    </AppView>
  );
}
