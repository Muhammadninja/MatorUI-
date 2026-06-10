import { Bell, BellOff, Package, Percent, Star, Tag } from 'lucide-react-native';
import { useState } from 'react';
import { Switch } from 'react-native';

import ProfileSectionCard from '@/components/screens-components/profile/profile-section-card';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

export default function NotificationSettingsScreen() {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';

  const [masterEnabled, setMasterEnabled] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [newArrivals, setNewArrivals] = useState(true);

  const activeCount = masterEnabled
    ? [orderUpdates, promotions, priceAlerts, newArrivals].filter(Boolean).length
    : 0;

  function iconBox(
    Icon: React.ComponentType<{ size: number; strokeWidth: number; color: string }>,
  ) {
    return (
      <AppView
        center
        rounded={8}
        style={{ width: 34, height: 34, backgroundColor: tokens.backgroundSecondary }}
      >
        <Icon size={16} strokeWidth={2.1} color={tokens.icon} />
      </AppView>
    );
  }

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Notifications" fallbackHref="/profile" />
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 40 }}
      >
        <AppView gap={20}>
          {/* Hero master toggle — distinguished from category cards via a
           *  brand-tinted illustration and inline copy. Sets the visual
           *  hierarchy: this switch governs everything below. */}
          <AppView px={16}>
            <AppView
              rounded={20}
              px={18}
              py={18}
              gap={14}
              style={{
                borderWidth: 1,
                borderColor: masterEnabled ? `${tokens.brand}40` : tokens.border,
                backgroundColor: isDark ? tokens.card : tokens.white,
              }}
            >
              <AppView row align="center" gap={14}>
                <AppView
                  center
                  rounded={999}
                  style={{
                    width: 52,
                    height: 52,
                    backgroundColor: masterEnabled
                      ? `${tokens.brand}1F`
                      : tokens.backgroundSecondary,
                    borderWidth: 1,
                    borderColor: masterEnabled ? `${tokens.brand}40` : tokens.border,
                  }}
                >
                  {masterEnabled ? (
                    <Bell size={22} strokeWidth={2} color={tokens.brand} />
                  ) : (
                    <BellOff size={22} strokeWidth={2} color={tokens.gray400} />
                  )}
                </AppView>
                <AppView gap={3} style={{ flex: 1 }}>
                  <AppText textVariant="bodySemibold" weight="bold">
                    Push notifications
                  </AppText>
                  <AppText textVariant="bodyXs" colorName="gray400">
                    {masterEnabled
                      ? `${activeCount} of 4 categories on`
                      : 'Off — you won’t receive any alerts'}
                  </AppText>
                </AppView>
                <Switch
                  value={masterEnabled}
                  onValueChange={setMasterEnabled}
                  trackColor={{ false: tokens.border, true: tokens.brand }}
                  thumbColor={tokens.white}
                />
              </AppView>
            </AppView>
          </AppView>

          <AppView px={16}>
            <AppText textVariant="bodySm" colorName="gray400">
              Choose which alerts reach you. Push must be on for these to fire.
            </AppText>
          </AppView>

          <ProfileSectionCard
            title="Categories"
            items={[
              {
                key: 'orders',
                title: 'Order Updates',
                subtitle: 'Shipping, delivery, and status changes',
                leading: iconBox(Package),
                rightSwitchValue: masterEnabled && orderUpdates,
                onRightSwitchChange: masterEnabled ? setOrderUpdates : undefined,
              },
              {
                key: 'promos',
                title: 'Promotions',
                subtitle: 'Deals, flash sales, and discount codes',
                leading: iconBox(Percent),
                rightSwitchValue: masterEnabled && promotions,
                onRightSwitchChange: masterEnabled ? setPromotions : undefined,
              },
              {
                key: 'price-alerts',
                title: 'Price Alerts',
                subtitle: 'Drop alerts for your saved items',
                leading: iconBox(Tag),
                rightSwitchValue: masterEnabled && priceAlerts,
                onRightSwitchChange: masterEnabled ? setPriceAlerts : undefined,
              },
              {
                key: 'new-arrivals',
                title: 'New Arrivals',
                subtitle: 'Fresh drops and top featured parts',
                leading: iconBox(Star),
                rightSwitchValue: masterEnabled && newArrivals,
                onRightSwitchChange: masterEnabled ? setNewArrivals : undefined,
              },
            ]}
          />
        </AppView>
      </AppScrollView>
    </AppView>
  );
}
