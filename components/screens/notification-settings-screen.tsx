import { router } from 'expo-router';
import { ArrowLeft, Bell, BellOff, Package, Percent, Star, Tag } from 'lucide-react-native';
import { useState } from 'react';

import ProfileSectionCard from '@/components/screens-components/profile/profile-section-card';
import ScreenShell from '@/components/screens-components/screen-shell';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export default function NotificationSettingsScreen() {
  const { tokens } = useThemeContext();

  const [masterEnabled, setMasterEnabled] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [newArrivals, setNewArrivals] = useState(true);

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
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <AppView mt={14} gap={24}>
          {/* Header */}
          <AppView px={16} gap={14}>
            <AppView row align="center">
              <AppView style={{ flex: 1, alignItems: 'flex-start' }}>
                <AppPressableView
                  row
                  align="center"
                  androidRipple={false}
                  onPress={() => router.back()}
                >
                  <ArrowLeft size={20} strokeWidth={2.2} color={tokens.text} />
                </AppPressableView>
              </AppView>

              <AppText
                textVariant="title"
                family="heading"
                weight="bold"
                style={{ textAlign: 'center' }}
              >
                Notifications
              </AppText>

              <AppView style={{ flex: 1 }} />
            </AppView>

            <AppText textVariant="bodySm" colorName="gray400">
              Control which alerts you receive and how.
            </AppText>
          </AppView>

          {/* Master toggle */}
          <ProfileSectionCard
            title="Push Notifications"
            items={[
              {
                key: 'master',
                title: masterEnabled ? 'Enabled' : 'Disabled',
                subtitle: 'Allow Matorui to send push notifications',
                leading: iconBox(masterEnabled ? Bell : BellOff),
                rightSwitchValue: masterEnabled,
                onRightSwitchChange: setMasterEnabled,
                titleColorName: 'text',
              },
            ]}
          />

          {/* Categories — disabled when master is off */}
          <ProfileSectionCard
            title="Categories"
            items={[
              {
                key: 'orders',
                title: 'Order Updates',
                subtitle: 'Shipping, delivery, and status changes',
                leading: iconBox(Package),
                rightSwitchValue: masterEnabled && orderUpdates,
              },
              {
                key: 'promos',
                title: 'Promotions',
                subtitle: 'Deals, flash sales, and discount codes',
                leading: iconBox(Percent),
                rightSwitchValue: masterEnabled && promotions,
                onRightSwitchChange: masterEnabled ? setPromotions : undefined,
                titleColorName: 'text',
              },
              {
                key: 'price-alerts',
                title: 'Price Alerts',
                subtitle: 'Drop alerts for your saved items',
                leading: iconBox(Tag),
                rightSwitchValue: masterEnabled && priceAlerts,
                onRightSwitchChange: masterEnabled ? setPriceAlerts : undefined,
                titleColorName: 'text',
              },
              {
                key: 'new-arrivals',
                title: 'New Arrivals',
                subtitle: 'Fresh drops and top featured parts',
                leading: iconBox(Star),
                rightSwitchValue: masterEnabled && newArrivals,
                onRightSwitchChange: masterEnabled ? setNewArrivals : undefined,
                titleColorName: 'text',
              },
            ]}
          />
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}
