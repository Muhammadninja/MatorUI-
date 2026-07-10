import { useState } from 'react';

import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { toastService } from '@/services/toast-service';

/**
 * Notifications — faithful rebuild of the prototype's `scNotifications`.
 *
 * Feed rows layout (NOT card-style):
 *   leading colored dot (10px) | title + relative time | body | unread dot (right)
 * Each row is separated by a `borderBottom: 1px solid divider`, padding `14px 0`.
 * Header: back + "Notifications" + "Mark all read" (accent, 12.5, text-colored).
 */

type NotifTone = 'info' | 'value' | 'warning' | 'success' | 'accolade';

type NotifItem = {
  id: string;
  tone: NotifTone;
  title: string;
  body: string;
  time: string;
  unread: boolean;
};

const FEED: NotifItem[] = [
  {
    id: 'n1',
    tone: 'info',
    title: 'Out for delivery',
    body: 'Order MTR-482910 arrives today by 6 PM.',
    time: '2m',
    unread: true,
  },
  {
    id: 'n2',
    tone: 'value',
    title: 'Price drop',
    body: 'Ceramic Brake Pads dropped to $64.99. You saved it.',
    time: '1h',
    unread: true,
  },
  {
    id: 'n3',
    tone: 'warning',
    title: 'Back in stock',
    body: 'AGM Battery Group 35 is available again.',
    time: '5h',
    unread: false,
  },
  {
    id: 'n4',
    tone: 'success',
    title: 'Order delivered',
    body: 'MTR-471002 was left at your front door.',
    time: '2d',
    unread: false,
  },
  {
    id: 'n5',
    tone: 'accolade',
    title: 'Welcome to Mator Pro',
    body: 'Free 2-day shipping is now active on your account.',
    time: '1w',
    unread: false,
  },
];

function useDotColor(tokens: ReturnType<typeof useThemeContext>['tokens']) {
  return (tone: NotifTone): string => {
    if (tone === 'info') return tokens.info;
    if (tone === 'value') return tokens.value;
    if (tone === 'warning') return tokens.warning;
    if (tone === 'success') return tokens.success;
    if (tone === 'accolade') return tokens.accolade;
    return tokens.brand;
  };
}

export default function NotificationsScreen() {
  const { tokens } = useThemeContext();
  const [items, setItems] = useState<NotifItem[]>(FEED);
  const dotColor = useDotColor(tokens);

  const unreadCount = items.filter((n) => n.unread).length;

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
    toastService.success('All marked read');
  };

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader
        title="Notifications"
        fallbackHref="/profile"
        right={
          unreadCount > 0 ? (
            <AppPressableView
              onPress={markAllRead}
              pressedOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText
                family="accent"
                weight="bold"
                style={{ fontSize: 12.5, color: tokens.text }}
              >
                Mark all read
              </AppText>
            </AppPressableView>
          ) : undefined
        }
      />

      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 32, paddingHorizontal: 20 }}
        padding={0}
      >
        {items.map((n) => {
          const dot = dotColor(n.tone);
          return (
            <AppView
              key={n.id}
              row
              gap={12}
              style={{
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: tokens.divider,
              }}
            >
              {/* Leading colored dot */}
              <AppView
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: dot,
                  marginTop: 5,
                  flexShrink: 0,
                }}
              />

              {/* Content */}
              <AppView style={{ flex: 1 }}>
                {/* Title row */}
                <AppView row justify="space-between" gap={8}>
                  <AppText
                    family="accent"
                    weight="bold"
                    style={{ fontSize: 14.5, color: tokens.text }}
                  >
                    {n.title}
                  </AppText>
                  <AppText
                    family="default"
                    style={{ fontSize: 11.5, color: tokens.textMuted, flexShrink: 0 }}
                  >
                    {n.time}
                  </AppText>
                </AppView>

                {/* Body */}
                <AppText
                  family="default"
                  style={{
                    fontSize: 13,
                    color: tokens.textMuted,
                    marginTop: 3,
                    lineHeight: 18,
                  }}
                >
                  {n.body}
                </AppText>
              </AppView>

              {/* Trailing unread dot */}
              {n.unread ? (
                <AppView
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: tokens.brandBg,
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <AppView style={{ width: 8, flexShrink: 0 }} />
              )}
            </AppView>
          );
        })}
      </AppScrollView>
    </AppView>
  );
}
