import {
    Bell,
    ClipboardList,
    CreditCard,
    MapPin,
    Settings,
    ShieldCheck,
} from 'lucide-react-native';
import React from 'react';

import ProfileGuestEmpty from '@/components/screens-components/profile/profile-guest-empty';
import ProfileHeroCard from '@/components/screens-components/profile/profile-hero-card';
import ProfilePaymentMethods from '@/components/screens-components/profile/profile-payment-methods';
import ProfileRecentlyViewed from '@/components/screens-components/profile/profile-recently-viewed';
import ProfileSectionCard from '@/components/screens-components/profile/profile-section-card';
import ScreenShell from '@/components/screens-components/screen-shell';
import { AppButton } from '@/components/shared/app-button';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useUserContext } from '@/contexts/user.context';
import { useToast } from '@/hooks/use-toast';
import { modalService } from '@/services/global-modal-service/global-modal.service';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { tokens } = useThemeContext();
  const { isAuthenticated } = useUserContext();
  const toast = useToast();

  if (!isAuthenticated) {
    return (
      <ScreenShell>
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 32 }}
        >
          <ProfileGuestEmpty />
        </AppScrollView>
      </ScreenShell>
    );
  }

  function iconBox(
    Icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }>,
  ) {
    return (
      <AppView
        center
        rounded={12}
        style={{ width: 34, height: 34, backgroundColor: tokens.backgroundSecondary }}
      >
        <Icon size={16} strokeWidth={2.1} color={tokens.icon} />
      </AppView>
    );
  }

  return (
    <ScreenShell>
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <AppView gap={22}>
          <AppView px={16}>
            <ProfileHeroCard />
          </AppView>

          <ProfilePaymentMethods />

          <ProfileSectionCard
            title="Account"
            items={[
              {
                key: 'orders',
                title: 'Order History',
                leading: iconBox(ClipboardList),
                rightChevron: true,
                titleColorName: 'text',
                onPress: () => router.push('/order-history'),
              },
              {
                key: 'address',
                title: 'Shipping Addresses',
                leading: iconBox(MapPin),
                rightChevron: true,
                titleColorName: 'text',
                onPress: () => router.push('/shipping-addresses'),
              },
              {
                key: 'security',
                title: 'Settings & Security',
                leading: iconBox(Settings),
                rightChevron: true,
                titleColorName: 'text',
                onPress: () => router.push('/settings-security'),
              },
            ]}
          />

          <ProfileSectionCard
            title="Preferences"
            items={[
              {
                key: 'notifications',
                title: 'Notifications',
                leading: iconBox(Bell),
                rightText: 'On',
                rightChevron: true,
                titleColorName: 'text',
                onPress: () => router.push('/notification-settings'),
              },
              {
                key: 'payments-pref',
                title: 'Payment methods',
                leading: iconBox(CreditCard),
                rightChevron: true,
                titleColorName: 'text',
                onPress: () => router.push('/payment-methods'),
              },
              {
                key: 'privacy',
                title: 'Privacy & Security',
                leading: iconBox(ShieldCheck),
                rightChevron: true,
                titleColorName: 'text',
                onPress: () => modalService.openModal('privacySheet'),
              },
            ]}
          />

          <ProfileRecentlyViewed />

          {/* Toast playground — dev-only sanity checks for the toast system */}
          <AppView px={16} gap={10}>
            <AppText
              textVariant="caption"
              family="accent"
              weight="semibold"
              colorName="gray400"
              transform="uppercase"
              style={{ letterSpacing: 1.2 }}
            >
              Toast playground
            </AppText>
            <AppView row gap={8}>
              <AppButton
                title="Success"
                kind="success"
                size="sm"
                containerStyle={{ flex: 1 }}
                onPress={() =>
                  toast.success('Saved successfully', {
                    description: 'Your changes are now live.',
                  })
                }
              />
              <AppButton
                title="Info"
                kind="warning"
                size="sm"
                containerStyle={{ flex: 1 }}
                onPress={() =>
                  toast.info('Heads up', {
                    description: 'Connection is slow but holding.',
                  })
                }
              />
              <AppButton
                title="Danger"
                kind="error"
                size="sm"
                containerStyle={{ flex: 1 }}
                onPress={() =>
                  toast.danger('Something broke', {
                    description: 'Tap to retry the last action.',
                    actionLabel: 'Retry',
                    onAction: () => toast.success('Retried'),
                  })
                }
              />
            </AppView>
          </AppView>
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}
