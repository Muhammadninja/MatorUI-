import React from 'react';
import { Image } from 'react-native';

import { router } from 'expo-router';
import {
  Bell,
  CreditCard,
  History,
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
import { useToast } from '@/hooks/use-toast';
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
    subtitle: '12 past orders',
    leading: <AppIconBox Icon={ReceiptText} rounded={11} />,
    rightChevron: true,
    onPress: () => router.push('/order-history'),
  },
  {
    key: 'addresses',
    title: 'Shipping addresses',
    subtitle: '2 saved',
    leading: <AppIconBox Icon={MapPin} rounded={11} />,
    rightChevron: true,
    onPress: () => router.push('/shipping-addresses'),
  },
  {
    key: 'payments',
    title: 'Payment methods',
    subtitle: 'Visa ···· 4821',
    leading: <AppIconBox Icon={CreditCard} rounded={11} />,
    rightChevron: true,
    onPress: () => router.push('/payment-methods'),
  },
  {
    key: 'recently-viewed',
    title: 'Recently viewed',
    subtitle: 'Pick up where you left off',
    leading: <AppIconBox Icon={History} rounded={11} />,
    rightChevron: true,
    onPress: () => router.push('/recently-viewed'),
  },
  {
    key: 'notifications',
    title: 'Notifications',
    subtitle: 'Push, email & SMS',
    leading: <AppIconBox Icon={Bell} rounded={11} />,
    rightChevron: true,
    onPress: () => router.push('/notification-settings'),
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
  const { profile, isAuthenticated, isHydrating, signOut } = useUserContext();

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

          {/* Handoff §17: 3-equal stats cards — Orders · Vehicles · Saved */}
          <AppView row gap="sm" px="lg">
            <StatCard label="Orders" value="12" />
            <StatCard label="Vehicles" value="2" />
            <StatCard label="Saved" value="$1.2k" />
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

          {/* Handoff §17: ghost "Sign out" */}
          <AppView px="lg">
            <AppButton
              title="Sign out"
              variant="ghost"
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
        {profile.avatarUrl ? (
          <Image source={{ uri: profile.avatarUrl }} style={{ width: 64, height: 64 }} />
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
          {profile.email}
        </AppText>

        {/* "★ Mator Pro member" pill — accolade gold tint */}
        <AppView
          row
          align="center"
          gap={5}
          style={{
            marginTop: 5,
            alignSelf: 'flex-start',
            backgroundColor: tokens.backgroundSecondary,
            borderWidth: 1,
            borderColor: tokens.border,
            borderRadius: 999,
            paddingHorizontal: 9,
            paddingVertical: 3,
          }}
        >
          <AppText style={{ fontSize: 11, color: tokens.accolade }}>★</AppText>
          <AppText
            family="accent"
            weight="bold"
            style={{ fontSize: 11, color: tokens.text }}
          >
            Mator Pro member
          </AppText>
        </AppView>
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
