import {
    Bell,
    ClipboardList,
    CreditCard,
    MapPin,
    Settings,
    ShieldCheck,
} from 'lucide-react-native';
import React from 'react';

import ProfileHeroCard from '@/components/screens-components/profile-hero-card';
import ProfilePaymentMethods from '@/components/screens-components/profile-payment-methods';
import ProfileRecentlyViewed from '@/components/screens-components/profile-recently-viewed';
import ProfileSectionCard from '@/components/screens-components/profile-section-card';
import ScreenShell from '@/components/screens-components/screen-shell';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { modalService } from '@/services/global-modal-service/global-modal.service';
import { router } from 'expo-router';

export default function ProfileScreen() {
  const { tokens } = useThemeContext();

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
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}
