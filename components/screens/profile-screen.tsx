import { router } from 'expo-router';
import {
    Bell,
    ClipboardList,
    CreditCard,
    MapPin,
    Settings,
    ShieldCheck,
} from 'lucide-react-native';

import ProfileGuestEmpty from '@/components/screens-components/profile/profile-guest-empty';
import ProfileHeroCard from '@/components/screens-components/profile/profile-hero-card';
import ProfilePaymentMethods from '@/components/screens-components/profile/profile-payment-methods';
import ProfileRecentlyViewed from '@/components/screens-components/profile/profile-recently-viewed';
import ProfileSectionCard from '@/components/screens-components/profile/profile-section-card';
import ScreenShell from '@/components/screens-components/screen-shell';
import { AppIconBox } from '@/components/shared/app-icon-box';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppView } from '@/components/shared/app-view';
import { useUserContext } from '@/contexts/user.context';
import { modalService } from '@/services/global-modal-service/global-modal.service';

export default function ProfileScreen() {
  const { isAuthenticated } = useUserContext();

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

  return (
    <ScreenShell>
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <AppView gap="lg">
          <AppView px="lg">
            <ProfileHeroCard />
          </AppView>

          <ProfilePaymentMethods />

          <ProfileSectionCard
            title="Account"
            items={[
              {
                key: 'orders',
                title: 'Order History',
                leading: <AppIconBox Icon={ClipboardList} />,
                rightChevron: true,
                onPress: () => router.push('/order-history'),
              },
              {
                key: 'address',
                title: 'Shipping Addresses',
                leading: <AppIconBox Icon={MapPin} />,
                rightChevron: true,
                onPress: () => router.push('/shipping-addresses'),
              },
              {
                key: 'security',
                title: 'Settings & Security',
                leading: <AppIconBox Icon={Settings} />,
                rightChevron: true,
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
                leading: <AppIconBox Icon={Bell} />,
                rightText: 'On',
                rightChevron: true,
                onPress: () => router.push('/notification-settings'),
              },
              {
                key: 'payments-pref',
                title: 'Payment methods',
                leading: <AppIconBox Icon={CreditCard} />,
                rightChevron: true,
                onPress: () => router.push('/payment-methods'),
              },
              {
                key: 'privacy',
                title: 'Privacy & Security',
                leading: <AppIconBox Icon={ShieldCheck} />,
                rightChevron: true,
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
