import { router } from 'expo-router';
import { ArrowLeft, Box, ChevronRight } from 'lucide-react-native';

import ScreenShell from '@/components/screens-components/screen-shell';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';

const STATUS_COLOR: Record<string, string> = {
  Delivered: '#0f9d58',
  'In Transit': '#f4b400',
  Processing: '#4285f4',
  Cancelled: '#db4437',
};

const ORDERS = [
  {
    id: 'ORD-8821',
    date: 'May 28, 2026',
    status: 'Delivered',
    items: 3,
    total: '$486.00',
    summary: 'Garrett GTX3582R + 2 items',
  },
  {
    id: 'ORD-8790',
    date: 'May 14, 2026',
    status: 'In Transit',
    items: 1,
    total: '$1,249.00',
    summary: 'KW Coilovers V3 Suspension Kit',
  },
  {
    id: 'ORD-8741',
    date: 'Apr 30, 2026',
    status: 'Delivered',
    items: 2,
    total: '$920.00',
    summary: 'Vossen HF-5 Wheels + 1 item',
  },
  {
    id: 'ORD-8703',
    date: 'Apr 12, 2026',
    status: 'Cancelled',
    items: 1,
    total: '$340.00',
    summary: 'Brembo GT Big Brake Kit',
  },
  {
    id: 'ORD-8682',
    date: 'Mar 27, 2026',
    status: 'Delivered',
    items: 4,
    total: '$2,100.00',
    summary: 'Full suspension overhaul bundle',
  },
];

export default function OrderHistoryScreen() {
  const { tokens } = useThemeContext();

  return (
    <ScreenShell>
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <AppView mt={14} gap={20}>
          {/* Header */}
          <AppView px={16} gap={14}>
            <AppView row align="center" style={{ flexDirection: 'row', alignItems: 'center' }}>
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
                Order History
              </AppText>

              <AppView style={{ flex: 1 }} />
            </AppView>

            <AppText textVariant="bodySm" colorName="gray400">
              {ORDERS.length} orders placed in the last 12 months.
            </AppText>
          </AppView>

          {/* Orders list */}
          <AppView px={16} gap={12}>
            {ORDERS.map((order) => (
              <AppPressableView
                key={order.id}
                androidRipple={false}
                style={{
                  borderRadius: 20,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  backgroundColor: tokens.card,
                  padding: 16,
                }}
              >
                <AppView gap={10}>
                  {/* Top row */}
                  <AppView row align="center" justify="space-between">
                    <AppView row align="center" gap={8}>
                      <AppView
                        center
                        rounded={10}
                        style={{
                          width: 34,
                          height: 34,
                          backgroundColor: tokens.backgroundSecondary,
                        }}
                      >
                        <Box size={16} strokeWidth={2.1} color={tokens.icon} />
                      </AppView>
                      <AppView gap={2}>
                        <AppText textVariant="bodySemibold" weight="semibold">
                          {order.id}
                        </AppText>
                        <AppText textVariant="bodyXs" colorName="gray400">
                          {order.date}
                        </AppText>
                      </AppView>
                    </AppView>
                    <ChevronRight size={16} strokeWidth={2.2} color={tokens.gray400} />
                  </AppView>

                  {/* Divider */}
                  <AppView
                    style={{ height: 1, backgroundColor: tokens.divider, marginHorizontal: -2 }}
                  />

                  {/* Bottom row */}
                  <AppView row align="center" justify="space-between">
                    <AppView gap={3}>
                      <AppText textVariant="bodyXs" colorName="gray400">
                        {order.summary}
                      </AppText>
                      <AppView row align="center" gap={6}>
                        <AppView
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 99,
                            backgroundColor: STATUS_COLOR[order.status] ?? tokens.gray400,
                          }}
                        />
                        <AppText
                          textVariant="caption"
                          family="accent"
                          weight="semibold"
                          style={{ color: STATUS_COLOR[order.status] ?? tokens.gray400 }}
                        >
                          {order.status}
                        </AppText>
                      </AppView>
                    </AppView>
                    <AppText textVariant="bodySemibold" weight="bold">
                      {order.total}
                    </AppText>
                  </AppView>
                </AppView>
              </AppPressableView>
            ))}
          </AppView>
        </AppView>
      </AppScrollView>
    </ScreenShell>
  );
}
