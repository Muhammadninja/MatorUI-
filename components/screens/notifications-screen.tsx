import { BellOff, CheckCircle2, Sparkles, Tag, Truck } from 'lucide-react-native';
import { useState } from 'react';
import type { ComponentType } from 'react';

import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

type NotificationKind = 'order' | 'price' | 'drop' | 'system';

type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  time: string;
  /** Unseen — shown with a brand dot and a slightly elevated weight. */
  unread: boolean;
};

const NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    kind: 'order',
    title: 'Your order shipped',
    message: 'Garrett GTX3582R Turbo is on the way, arriving Thu.',
    time: '2m ago',
    unread: true,
  },
  {
    id: 'n2',
    kind: 'price',
    title: 'Price drop',
    message: 'Vossen HF-5 Wheels dropped 12% from your saved list.',
    time: '1h ago',
    unread: true,
  },
  {
    id: 'n3',
    kind: 'drop',
    title: 'New featured drop',
    message: 'Five upgrade parts joined the Top Featured collection.',
    time: 'Today',
    unread: false,
  },
];

// Lucide icon + token key per kind. Kept here (not in the data) so
// changing the visual language doesn't require touching the notifications
// payload.
const KIND_META: Record<
  NotificationKind,
  { Icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>; tone: 'success' | 'warning' | 'info' | 'brand' }
> = {
  order: { Icon: Truck, tone: 'success' },
  price: { Icon: Tag, tone: 'warning' },
  drop: { Icon: Sparkles, tone: 'brand' },
  system: { Icon: CheckCircle2, tone: 'info' },
};

export default function NotificationsScreen() {
  const { tokens, scheme } = useThemeContext();
  const isDark = scheme === 'dark';
  const [items, setItems] = useState(NOTIFICATIONS);

  const unreadCount = items.filter((n) => n.unread).length;
  const markAllRead = () => {
    setItems((prev) => prev.map((n) => (n.unread ? { ...n, unread: false } : n)));
  };

  const toneColor = (tone: (typeof KIND_META)[NotificationKind]['tone']) => {
    if (tone === 'success') return tokens.success;
    if (tone === 'warning') return tokens.warning;
    if (tone === 'info') return tokens.info;
    return tokens.brand;
  };

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Notifications" fallbackHref="/profile" />
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 32, flexGrow: 1 }}
      >
        <AppView gap="lg" style={{ flex: 1 }}>
          <AppView px="lg" row align="center" justify="space-between" gap="md">
            <AppText textVariant="bodySm" colorName="gray400">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : items.length === 0
                  ? 'All caught up'
                  : 'No unread'}
            </AppText>
            {unreadCount > 0 ? (
              <AppText
                textVariant="bodyXs"
                weight="semibold"
                onPress={markAllRead}
                accessibilityRole="button"
                style={{ color: tokens.brand }}
              >
                Mark all read
              </AppText>
            ) : null}
          </AppView>

          {items.length === 0 ? (
            <AppView px="lg" style={{ flex: 1 }}>
              <EmptyCard />
            </AppView>
          ) : (
            <AppView px="lg" gap={10}>
              {items.map((n) => {
                const meta = KIND_META[n.kind];
                const accent = toneColor(meta.tone);
                return (
                  <AppView
                    key={n.id}
                    rounded={20}
                    px={14}
                    py={14}
                    style={{
                      borderWidth: 1,
                      borderColor: n.unread ? `${accent}40` : tokens.border,
                      backgroundColor: isDark ? tokens.card : tokens.white,
                    }}
                  >
                    <AppView row align="flex-start" gap="md">
                      <AppView
                        center
                        rounded={999}
                        style={{
                          width: 38,
                          height: 38,
                          backgroundColor: `${accent}1F`,
                          borderWidth: 1,
                          borderColor: `${accent}40`,
                        }}
                      >
                        <meta.Icon size={18} strokeWidth={2.1} color={accent} />
                      </AppView>
                      <AppView gap="xs" style={{ flex: 1 }}>
                        <AppView row align="center" justify="space-between" gap={10}>
                          <AppView row align="center" gap={6} style={{ flex: 1 }}>
                            <AppText
                              textVariant="bodySemibold"
                              weight={n.unread ? 'bold' : 'semibold'}
                              numberOfLines={1}
                            >
                              {n.title}
                            </AppText>
                            {n.unread ? (
                              <AppView
                                rounded={999}
                                style={{
                                  width: 7,
                                  height: 7,
                                  backgroundColor: tokens.brand,
                                }}
                              />
                            ) : null}
                          </AppView>
                          <AppText textVariant="bodyXs" colorName="gray400">
                            {n.time}
                          </AppText>
                        </AppView>
                        <AppText textVariant="bodySm" colorName="gray400" numberOfLines={2}>
                          {n.message}
                        </AppText>
                      </AppView>
                    </AppView>
                  </AppView>
                );
              })}
            </AppView>
          )}
        </AppView>
      </AppScrollView>
    </AppView>
  );
}

function EmptyCard() {
  const { tokens, scheme } = useThemeContext();
  return (
    <AppView
      flex={1}
      center
      gap="md"
      py="xxxl"
      px={20}
      rounded={20}
      style={{
        borderWidth: 1,
        borderColor: tokens.border,
        backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
      }}
    >
      <AppView
        center
        rounded={999}
        style={{
          width: 56,
          height: 56,
          backgroundColor: tokens.backgroundSecondary,
        }}
      >
        <BellOff size={22} strokeWidth={2} color={tokens.gray400} />
      </AppView>
      <AppView align="center" gap="xs">
        <AppText textVariant="bodySemibold">Nothing here yet</AppText>
        <AppText
          textVariant="bodySm"
          colorName="gray400"
          style={{ textAlign: 'center', maxWidth: 240 }}
        >
          Order updates, price drops, and featured releases will land here.
        </AppText>
      </AppView>
    </AppView>
  );
}
