import { router } from 'expo-router';
import { ArrowLeft, Bell } from 'lucide-react-native';

import ScreenShell from '@/components/screens-components/screen-shell';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const NOTIFICATIONS = [
  {
    id: 'n1',
    type: 'success',
    title: 'Order update',
    message: 'Your last saved part is back in stock and ready to ship.',
    time: '2m ago',
  },
  {
    id: 'n2',
    type: 'warning',
    title: 'Price drop',
    message: 'Turbo Wheel Set is now available at a lower featured price.',
    time: '1h ago',
  },
  {
    id: 'n3',
    type: 'error',
    title: 'New featured drop',
    message: 'Fresh upgrade parts were added to the Top Featured collection.',
    time: 'Today',
  },
] as const;

export default function NotificationsScreen() {
  const { scheme, tokens } = useThemeContext();
  const ribbonColors = {
    success: tokens.success,
    warning: tokens.warning,
    error: tokens.error,
  } as const;

  return (
    <ScreenShell>
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <AppView mt={14} gap={16}>
          <AppView px={16} gap={14}>
            <AppView row align="center" style={{ flexDirection: 'row', alignItems: 'center' }}>
              <AppView style={{ flex: 1, alignItems: 'flex-start' }}>
                <AppPressableView
                  row
                  align="center"
                  androidRipple={false}
                  onPress={() => router.back()}
                  style={{ flexDirection: 'row', alignItems: 'center' }}
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

              <AppView style={{ flex: 1, alignItems: 'flex-end' }}>
                <AppView
                  center
                  rounded={36}
                  style={{
                    width: 36,
                    height: 36,
                    borderWidth: 1,
                    borderColor: tokens.border,
                    backgroundColor: scheme === 'dark' ? tokens.gray100 : tokens.background,
                  }}
                >
                  <Bell
                    size={16}
                    strokeWidth={2.1}
                    color={scheme === 'dark' ? tokens.white : tokens.gray400}
                  />
                </AppView>
              </AppView>
            </AppView>

            <AppText textVariant="bodySm" colorName="gray400">
              Track alerts, saved item changes, and featured marketplace updates.
            </AppText>
          </AppView>

          <AppView px={16} gap={10}>
            {NOTIFICATIONS.map((item) => (
              <AppView
                key={item.id}
                rounded={24}
                px={14}
                py={14}
                style={{
                  position: 'relative',
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
                }}
              >
                <AppView
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: 0,
                    height: 0,
                    borderTopWidth: 46,
                    borderLeftWidth: 46,
                    borderTopColor: ribbonColors[item.type],
                    borderLeftColor: 'transparent',
                  }}
                />
                <AppView row align="flex-start" gap={12}>
                  <AppView
                    center
                    rounded={36}
                    style={{
                      width: 36,
                      height: 36,
                      backgroundColor: scheme === 'dark' ? tokens.gray100 : tokens.gray50,
                    }}
                  >
                    <AppView
                      rounded={36}
                      style={{
                        width: 10,
                        height: 10,
                        backgroundColor: ribbonColors[item.type],
                      }}
                    />
                  </AppView>
                  <AppView gap={4} style={{ flex: 1, paddingRight: 18 }}>
                    <AppView row align="center" justify="space-between" gap={10}>
                      <AppText textVariant="bodySemibold" weight="bold">{item.title}</AppText>
                      <AppText textVariant="bodyXs" weight="bold" colorName="gray300">
                        {item.time}
                      </AppText>
                    </AppView>
                    <AppText textVariant="bodySm" weight="semibold" colorName="gray400">
                      {item.message}
                    </AppText>
                  </AppView>
                </AppView>
              </AppView>
            ))}
          </AppView>
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}
