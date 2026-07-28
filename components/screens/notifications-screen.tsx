import { useFocusEffect } from 'expo-router';
import { BellOff } from 'lucide-react-native';
import { useCallback, useRef } from 'react';

import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import { useNotifications } from '@/hooks/use-notifications';
import { toastService } from '@/services/toast-service';
import type { NotificationTone } from '@/services/notifications-service';

/**
 * Notifications — feed backed by the real notifications transport
 * (`useNotifications`). Faithful to the prototype's `scNotifications` row
 * layout (leading colored dot | title + time | body | trailing unread dot),
 * plus loading / empty states and tap-to-mark-read.
 */

function useDotColor(tokens: ReturnType<typeof useThemeContext>['tokens']) {
  return (tone: NotificationTone): string => {
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
  const { state, notifications, unreadCount, markRead, markAllRead, refresh } = useNotifications();
  const dotColor = useDotColor(tokens);

  // Refetch whenever the screen is focused so a new order/delivery update from
  // the backend shows the moment the user opens (or returns to) this screen.
  // `refresh` isn't referentially stable, so call it through a ref.
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  useFocusEffect(
    useCallback(() => {
      void refreshRef.current();
    }, []),
  );

  const handleMarkAll = () => {
    markAllRead();
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
              onPress={handleMarkAll}
              pressedOpacity={0.6}
              accessibilityRole="button"
              accessibilityLabel="Mark all notifications as read"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <AppText family="accent" weight="bold" style={{ fontSize: 12.5, color: tokens.text }}>
                Mark all read
              </AppText>
            </AppPressableView>
          ) : undefined
        }
      />

      {state === 'loading' ? (
        <AppView flex={1} center>
          <WheelLoader size={28} color={tokens.textMuted} />
        </AppView>
      ) : notifications.length === 0 ? (
        <AppView flex={1} center px="xl" gap={12}>
          <BellOff size={30} strokeWidth={2} color={tokens.textMuted} />
          <AppView align="center" gap={4}>
            <AppText family="heading" weight="bold" style={{ fontSize: 17, color: tokens.text }}>
              You&apos;re all caught up
            </AppText>
            <AppText
              family="default"
              style={{ fontSize: 13, color: tokens.textMuted, textAlign: 'center', maxWidth: 280 }}
            >
              Order updates, price drops, and back-in-stock alerts will show up here.
            </AppText>
          </AppView>
        </AppView>
      ) : (
        <AppScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 0, paddingBottom: 32, paddingHorizontal: 20 }}
          padding={0}
        >
          {notifications.map((n) => {
            const dot = dotColor(n.tone);
            return (
              <AppPressableView
                key={n.id}
                onPress={() => n.unread && markRead(n.id)}
                androidRipple={false}
                pressedOpacity={n.unread ? 0.6 : 1}
                accessibilityRole="button"
                accessibilityLabel={`${n.title}. ${n.unread ? 'Unread. Tap to mark read.' : 'Read.'}`}
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
                  style={{ width: 10, height: 10, borderRadius: 999, backgroundColor: dot, marginTop: 5, flexShrink: 0 }}
                />

                {/* Content */}
                <AppView style={{ flex: 1 }}>
                  <AppView row justify="space-between" gap={8}>
                    <AppText family="accent" weight="bold" style={{ fontSize: 14.5, color: tokens.text }}>
                      {n.title}
                    </AppText>
                    <AppText family="default" style={{ fontSize: 11.5, color: tokens.textMuted, flexShrink: 0 }}>
                      {n.time}
                    </AppText>
                  </AppView>

                  <AppText
                    family="default"
                    style={{ fontSize: 13, color: tokens.textMuted, marginTop: 3, lineHeight: 18 }}
                  >
                    {n.body}
                  </AppText>
                </AppView>

                {/* Trailing unread dot */}
                {n.unread ? (
                  <AppView
                    style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: tokens.brandBg, marginTop: 6, flexShrink: 0 }}
                  />
                ) : (
                  <AppView style={{ width: 8, flexShrink: 0 }} />
                )}
              </AppPressableView>
            );
          })}
        </AppScrollView>
      )}
    </AppView>
  );
}
