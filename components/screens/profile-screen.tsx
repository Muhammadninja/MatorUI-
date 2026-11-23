import React from 'react';
import { Image } from 'react-native';

import { useTranslation } from 'react-i18next';
import { router, useFocusEffect } from 'expo-router';
import { Heart, LogOut, MapPin, ReceiptText, Shield, User } from 'lucide-react-native';

import { OrderStatusCard } from '@/components/screens-components/orders/order-status-card';
import ProfileGuestEmpty from '@/components/screens-components/profile/profile-guest-empty';
import ScreenShell from '@/components/screens-components/screen-shell';
import { AppIconBox } from '@/components/shared/app-icon-box';
import { AppListItem } from '@/components/shared/app-list-item';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useLikesContext } from '@/contexts/likes.context';
import { debugLog } from '@/services/debug-log';
import { useResetToExplore } from '@/hooks/use-app-navigation';
import { useToast } from '@/hooks/use-toast';
import useGarage from '@/hooks/use-garage';
import { useOrders } from '@/hooks/use-orders';
import { useUserContext, type UserProfile } from '@/contexts/user.context';

const SECTION_RADIUS = 16;
const AVATAR = 60;
/** Teal outline icon on a pale teal square. */
const ROW_ICON = {
  size: 40,
  iconSize: 20,
  strokeWidth: 2,
  rounded: 12,
  backgroundColorName: 'brandSoft',
  colorName: 'brand',
} as const;
/** Row padding + icon + gap, so dividers start at the text column. */
const ROW_DIVIDER_INSET = 16 + ROW_ICON.size + 12;
/** Row padding above and below the 40pt icon: rows are 60pt, down from 72. */
const ROW_PADDING_Y = 10;

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

/** Build the account rows with translated copy. `t` comes from the caller so
 *  the labels re-resolve when the language changes.
 *
 *  Titles only, no sub-lines: "Order history / View your orders" and
 *  "Shipping addresses / Manage delivery addresses" spent a second line
 *  restating the first, which doubled the reading on the screen without
 *  telling anyone anything. The icon + title + chevron carry it. */
function buildAccountItems(t: (key: string) => string): AccountItem[] {
  return [
    {
      key: 'edit-profile',
      title: t('profile.editProfileTitle'),
      leading: <AppIconBox {...ROW_ICON} Icon={User} />,
      rightChevron: true,
      onPress: () => router.push('/edit-profile'),
    },
    {
      key: 'orders',
      title: t('profile.orderHistoryTitle'),
      leading: <AppIconBox {...ROW_ICON} Icon={ReceiptText} />,
      rightChevron: true,
      onPress: () => router.push('/order-history'),
    },
    {
      key: 'addresses',
      title: t('profile.addressesTitle'),
      leading: <AppIconBox {...ROW_ICON} Icon={MapPin} />,
      rightChevron: true,
      onPress: () => router.push('/shipping-addresses'),
    },
    {
      key: 'liked',
      title: t('profile.likedTitle'),
      leading: <AppIconBox {...ROW_ICON} Icon={Heart} />,
      rightChevron: true,
      onPress: () => router.push('/liked'),
    },
    {
      key: 'settings',
      title: t('profile.settingsTitle'),
      leading: <AppIconBox {...ROW_ICON} Icon={Shield} />,
      rightChevron: true,
      onPress: () => router.push('/settings-security'),
    },
  ];
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { tokens } = useThemeContext();
  const toast = useToast();
  const { profile, isAuthenticated, isHydrating, signOut, refreshProfile } = useUserContext();
  const resetToExplore = useResetToExplore();
  const accountItems = React.useMemo(() => buildAccountItems(t), [t]);

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
    toast.info(t('profile.signedOutToast'));
    // Start navigation over: `router.replace('/explore')` only switched tabs,
    // so the next person landed on the previous account's last Explore page,
    // and stale nested params outlived any pop.
    resetToExplore();
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
        <AppView gap="lg" pt="md">
          {/* 64px avatar, name, contact line. */}
          <ProfileHeader profile={profile} />

          {/* One card, three columns, hairlines between — real counts (0 = the
           *  honest empty state). Three separate bordered boxes framed each
           *  number individually and made a summary read as three widgets. */}
          <AppView px="lg">
            <AppView
              row
              rounded={SECTION_RADIUS}
              colorName="card"
              borderWidth={1}
              borderName="border"
              style={{ overflow: 'hidden', paddingVertical: 14 }}
            >
              <StatCell label={t('profile.statOrders')} value={String(orderCount)} />
              <StatDivider />
              <StatCell label={t('profile.statVehicles')} value={String(vehicles.length)} />
              <StatDivider />
              <StatCell label={t('profile.statSaved')} value={String(likedIds.size)} />
            </AppView>
          </AppView>

          {/* The current order, when there is one, above the menu that lists them all. */}
          <OrderStatusCard testID="profile-order-status" px="lg" />

          {/* Handoff §17 rows, minus the sub-lines (see buildAccountItems). */}
          <AppView gap={10} px="lg">
            <AppView
              rounded={SECTION_RADIUS}
              colorName="card"
              borderWidth={1}
              borderName="border"
              style={{ overflow: 'hidden' }}
            >
              {accountItems.map(({ key, ...item }, index) => (
                <AppListItem
                  key={key}
                  {...item}
                  titleWeight="medium"
                  size="md"
                  py={ROW_PADDING_Y}
                  dividerInset={ROW_DIVIDER_INSET}
                  _isFirst={index === 0}
                  _isLast={index === accountItems.length - 1}
                  _parentRounded={SECTION_RADIUS}
                  divider={index !== accountItems.length - 1}
                  colorName="card"
                />
              ))}
            </AppView>
          </AppView>

          {/* Separate from the menu and quiet: an outlined row with a red icon,
           *  not red text floating on the page. */}
          <AppView px="lg">
            <AppPressableView
              testID="profile-sign-out"
              onPress={handleSignOut}
              accessibilityRole="button"
              accessibilityLabel={t('profile.signOut')}
              androidRipple={false}
              pressedOpacity={0.7}
              rounded={SECTION_RADIUS}
              colorName="card"
              borderWidth={1}
              borderName="border"
              row
              center
              gap={8}
              style={{ minHeight: 52, paddingHorizontal: 16 }}
            >
              <LogOut size={20} strokeWidth={2} color={tokens.error} />
              <AppText weight="semibold" style={{ fontSize: 15, lineHeight: 20, color: tokens.text }}>
                {t('profile.signOut')}
              </AppText>
            </AppPressableView>
          </AppView>
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}

// ── Profile Header ────────────────────────────────────────────────────────────

function ProfileHeader({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation();
  const avatarUri = profile.avatarUrl;
  const { tokens } = useThemeContext();
  const fullName = `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim();
  const monogram =
    `${profile.firstName?.[0] ?? ''}${profile.lastName?.[0] ?? ''}`.toUpperCase() || 'M';

  // Fall back to the monogram when the avatar can't load (e.g. a dead/removed
  // Cloudinary URL) instead of a blank circle. Reset when the URL changes so a
  // re-upload gets a fresh chance to render.
  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => setImgFailed(false), [avatarUri]);
  const showAvatar = !!avatarUri && !imgFailed;
  const contact = profile.email || profile.phone || '';

  return (
    <AppView row align="center" gap={14} px="lg" style={{ paddingTop: 4, paddingBottom: 2 }}>
      {/* 60pt avatar with a soft brand ring, or a monogram when it's missing or
       *  fails to load. */}
      <AppView
        center
        rounded={999}
        style={{
          width: AVATAR,
          height: AVATAR,
          flexShrink: 0,
          overflow: 'hidden',
          backgroundColor: tokens.brandSoft,
          borderWidth: 2,
          borderColor: tokens.brandSoft,
        }}
      >
        {showAvatar ? (
          <Image
            source={{ uri: avatarUri }}
            style={{ width: AVATAR, height: AVATAR }}
            onError={(e) => {
              debugLog('profile', '✗ avatar image failed to load', {
                url: avatarUri,
                error: e.nativeEvent?.error,
              });
              setImgFailed(true);
            }}
          />
        ) : (
          <AppText
            family="heading"
            weight="bold"
            style={{ fontSize: 22, lineHeight: 26, color: tokens.brandText }}
          >
            {monogram}
          </AppText>
        )}
      </AppView>

      {/* Name + contact line, centred on the avatar; the column wraps long names. */}
      <AppView justify="center" gap={4} style={{ flex: 1, minWidth: 0 }}>
        <AppText family="heading" weight="bold" style={{ fontSize: 22, lineHeight: 26, color: tokens.text }}>
          {fullName || t('profile.namePlaceholder')}
        </AppText>
        {contact ? (
          <AppText
            textVariant="bodySm"
            style={{ color: tokens.textMuted, fontVariant: ['tabular-nums'] }}
          >
            {contact}
          </AppText>
        ) : null}
      </AppView>
    </AppView>
  );
}

// ── Stats Card ────────────────────────────────────────────────────────────────

function StatCell({ label, value }: { label: string; value: string }) {
  const { tokens } = useThemeContext();
  return (
    <AppView flex={1} align="center" gap={2} style={{ paddingHorizontal: 8 }}>
      <AppText
        family="heading"
        weight="bold"
        style={{ fontSize: 24, lineHeight: 28, color: tokens.text, fontVariant: ['tabular-nums'] }}
      >
        {value}
      </AppText>
      <AppText
        textVariant="bodyXs"
        weight="medium"
        align="center"
        // Shrinks rather than breaking a word in its narrow column at large text.
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.6}
        style={{ fontSize: 11, lineHeight: 14, color: tokens.textMuted }}
      >
        {label}
      </AppText>
    </AppView>
  );
}

/** Hairline between two stat columns, inset from the card's edges. */
function StatDivider() {
  const { tokens } = useThemeContext();
  return <AppView style={{ width: 1, marginVertical: 2, backgroundColor: tokens.divider }} />;
}
