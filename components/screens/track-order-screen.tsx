import { router } from 'expo-router';
import {
  ArrowLeft,
  Check,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Truck,
} from 'lucide-react-native';
import type { ComponentType } from 'react';

import { AppButton } from '@/components/shared/app-button';
import AppBlurView, { useBlurHeaderInset } from '@/components/shared/app-blur-view';
import AppImage from '@/components/shared/app-image';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useToast } from '@/hooks/use-toast';
import { triggerHaptic } from '@/utils/haptics';

const TRACK_ORDER_HEADER_HEIGHT = 56;

type StepKey = 'placed' | 'packed' | 'shipped' | 'out_for_delivery' | 'delivered';

type Step = {
  key: StepKey;
  label: string;
  caption: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
};

const STEPS: Step[] = [
  { key: 'placed', label: 'Order placed', caption: 'Tue · 9:42 AM', icon: Check },
  { key: 'packed', label: 'Packed', caption: 'Tue · 4:11 PM', icon: Package },
  { key: 'shipped', label: 'Shipped', caption: 'Wed · 7:28 AM', icon: Truck },
  {
    key: 'out_for_delivery',
    label: 'Out for delivery',
    caption: 'Today · 8:15 AM',
    icon: Truck,
  },
  { key: 'delivered', label: 'Delivered', caption: 'ETA 14:30 – 15:00', icon: MapPin },
];

const MOCK_ORDER = {
  id: 'M-48217',
  status: 'Out for delivery',
  etaWindow: '14:30 – 15:00',
  placedAt: 'Jun 4, 2026',
  currentStep: 'out_for_delivery' as StepKey,
  courier: {
    name: 'Marcus L.',
    company: 'Speedline Express',
    vehicle: 'Ford Transit · 8KJ-2491',
    rating: 4.9,
  },
  destination: {
    label: 'Home',
    address: '128 Marrakesh Rd, Suite 4',
    city: 'Brooklyn, NY 11211',
  },
  items: [
    { id: 'p1', title: 'Turbo Wheel Set', qty: 1, price: '$1,240' },
    { id: 'p2', title: 'Street Brake Pack', qty: 1, price: '$760' },
  ],
  totalLabel: '$2,170.00',
};

export default function TrackOrderScreen() {
  const { tokens, scheme } = useThemeContext();
  const toast = useToast();
  const topInset = useBlurHeaderInset(TRACK_ORDER_HEADER_HEIGHT);

  const currentIndex = STEPS.findIndex((s) => s.key === MOCK_ORDER.currentStep);

  const handleCall = () => {
    triggerHaptic('selection');
    toast.info('Calling courier…', { description: `${MOCK_ORDER.courier.name} · placeholder` });
  };
  const handleMessage = () => {
    triggerHaptic('selection');
    toast.info('Chat coming soon', { description: 'Courier chat will sync once backend lands.' });
  };

  return (
    <AppView flex={1} colorName="background">
      <AppScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingBottom: 40,
          paddingHorizontal: 16,
          paddingTop: topInset + 8,
        }}
      >
        <AppView gap={14}>
          {/* Status + order ID */}
          <AppView gap={6}>
            <AppView row align="center" gap={8}>
              <AppView
                rounded={36}
                px={10}
                py={4}
                style={{
                  backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
                  borderWidth: 1,
                  borderColor: tokens.success,
                }}
              >
                <AppText
                  textVariant="bodyXs"
                  weight="semibold"
                  style={{ color: tokens.success }}
                >
                  {MOCK_ORDER.status}
                </AppText>
              </AppView>
              <AppText textVariant="bodyXs" colorName="gray400">
                Order #{MOCK_ORDER.id}
              </AppText>
            </AppView>
            <AppText textVariant="h3" family="heading" weight="bold">
              Arrives {MOCK_ORDER.etaWindow}
            </AppText>
            <AppText textVariant="bodyXs" colorName="gray400">
              Placed {MOCK_ORDER.placedAt}
            </AppText>
          </AppView>

          {/* Step tracker */}
          <AppView
            rounded={24}
            px={16}
            py={16}
            gap={14}
            style={{
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            }}
          >
            <AppText textVariant="subtitle" family="accent">
              Progress
            </AppText>
            <AppView gap={0}>
              {STEPS.map((step, idx) => {
                const isDone = idx < currentIndex;
                const isCurrent = idx === currentIndex;
                const isPending = idx > currentIndex;
                const Icon = step.icon;
                const dotBg = isPending
                  ? scheme === 'dark'
                    ? tokens.gray200
                    : tokens.gray100
                  : isCurrent
                    ? tokens.secondary
                    : tokens.success;
                const iconColor = isPending ? tokens.gray400 : tokens.white;

                return (
                  <AppView key={step.key} row align="flex-start" gap={12}>
                    <AppView align="center" style={{ width: 28 }}>
                      <AppView
                        center
                        rounded={36}
                        style={{
                          width: 28,
                          height: 28,
                          backgroundColor: dotBg,
                        }}
                      >
                        <Icon size={14} strokeWidth={2.4} color={iconColor} />
                      </AppView>
                      {idx < STEPS.length - 1 ? (
                        <AppView
                          style={{
                            width: 2,
                            height: 28,
                            backgroundColor:
                              idx < currentIndex
                                ? tokens.success
                                : scheme === 'dark'
                                  ? tokens.gray200
                                  : tokens.gray100,
                          }}
                        />
                      ) : null}
                    </AppView>
                    <AppView gap={2} style={{ flex: 1, paddingBottom: 14 }}>
                      <AppText
                        textVariant="bodySm"
                        weight={isCurrent ? 'semibold' : isDone ? 'medium' : 'regular'}
                        colorName={isPending ? 'gray400' : 'text'}
                      >
                        {step.label}
                      </AppText>
                      <AppText textVariant="bodyXs" colorName="gray400">
                        {step.caption}
                      </AppText>
                    </AppView>
                  </AppView>
                );
              })}
            </AppView>
          </AppView>

          {/* Courier card */}
          <AppView
            rounded={24}
            px={16}
            py={16}
            gap={12}
            style={{
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            }}
          >
            <AppView row align="center" justify="space-between">
              <AppText textVariant="subtitle" family="accent">
                Your courier
              </AppText>
              <AppText textVariant="bodyXs" colorName="gray400">
                ★ {MOCK_ORDER.courier.rating}
              </AppText>
            </AppView>
            <AppView row align="center" gap={12}>
              <AppImage
                source={require('@/assets/images/test-image.png')}
                width={48}
                height={48}
                rounded={36}
                contentFit="cover"
                alt={MOCK_ORDER.courier.name}
              />
              <AppView gap={2} style={{ flex: 1 }}>
                <AppText textVariant="bodySemibold">{MOCK_ORDER.courier.name}</AppText>
                <AppText textVariant="bodyXs" colorName="gray400">
                  {MOCK_ORDER.courier.company}
                </AppText>
                <AppText textVariant="bodyXs" colorName="gray400">
                  {MOCK_ORDER.courier.vehicle}
                </AppText>
              </AppView>
            </AppView>
            <AppView row gap={10}>
              <AppPressableView
                onPress={handleCall}
                androidRipple
                accessibilityLabel="Call courier"
                style={{
                  flex: 1,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  paddingVertical: 10,
                  backgroundColor: scheme === 'dark' ? tokens.gray200 : tokens.gray100,
                }}
              >
                <AppView row align="center" justify="center" gap={6}>
                  <Phone size={14} strokeWidth={2.2} color={tokens.text} />
                  <AppText textVariant="bodySm" weight="semibold">
                    Call
                  </AppText>
                </AppView>
              </AppPressableView>
              <AppPressableView
                onPress={handleMessage}
                androidRipple
                accessibilityLabel="Message courier"
                style={{
                  flex: 1,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: tokens.border,
                  paddingVertical: 10,
                  backgroundColor: scheme === 'dark' ? tokens.gray200 : tokens.gray100,
                }}
              >
                <AppView row align="center" justify="center" gap={6}>
                  <MessageSquare size={14} strokeWidth={2.2} color={tokens.text} />
                  <AppText textVariant="bodySm" weight="semibold">
                    Message
                  </AppText>
                </AppView>
              </AppPressableView>
            </AppView>
          </AppView>

          {/* Delivery address */}
          <AppView
            rounded={24}
            px={16}
            py={16}
            gap={8}
            style={{
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            }}
          >
            <AppView row align="center" gap={8}>
              <MapPin size={14} strokeWidth={2.2} color={tokens.gray400} />
              <AppText textVariant="bodyXs" colorName="gray400">
                Delivering to {MOCK_ORDER.destination.label}
              </AppText>
            </AppView>
            <AppText textVariant="bodySemibold">{MOCK_ORDER.destination.address}</AppText>
            <AppText textVariant="bodySm" colorName="gray400">
              {MOCK_ORDER.destination.city}
            </AppText>
          </AppView>

          {/* Items in this order */}
          <AppView
            rounded={24}
            px={16}
            py={16}
            gap={12}
            style={{
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            }}
          >
            <AppView row align="center" justify="space-between">
              <AppText textVariant="subtitle" family="accent">
                In this delivery
              </AppText>
              <AppText textVariant="bodyXs" colorName="gray400">
                {MOCK_ORDER.totalLabel}
              </AppText>
            </AppView>
            {MOCK_ORDER.items.map((item) => (
              <AppView key={item.id} row align="center" gap={12}>
                <AppImage
                  source={require('@/assets/images/test-image.png')}
                  width={44}
                  height={44}
                  rounded={12}
                  contentFit="cover"
                  alt={item.title}
                />
                <AppView gap={2} style={{ flex: 1 }}>
                  <AppText textVariant="bodySm" weight="semibold">
                    {item.title}
                  </AppText>
                  <AppText textVariant="bodyXs" colorName="gray400">
                    Qty {item.qty}
                  </AppText>
                </AppView>
                <AppText textVariant="bodySm">{item.price}</AppText>
              </AppView>
            ))}
          </AppView>

          <AppButton
            title="View order details"
            kind="secondary"
            variant="outline"
            size="md"
            fullWidth
            onPress={() => {
              triggerHaptic('selection');
              router.push('/order-history');
            }}
          />
        </AppView>
      </AppScrollView>

      <AppBlurView contentHeight={TRACK_ORDER_HEADER_HEIGHT}>
        <AppView
          row
          align="center"
          justify="space-between"
          px={16}
          pt={8}
          pb={12}
        >
          <AppPressableView
            center
            rounded={36}
            onPress={() => router.back()}
            androidRipple
            accessibilityLabel="Back"
            style={{
              width: 36,
              height: 36,
              borderWidth: 1,
              borderColor: tokens.border,
              backgroundColor: scheme === 'dark' ? tokens.card : tokens.white,
            }}
          >
            <ArrowLeft size={18} strokeWidth={2.2} color={tokens.text} />
          </AppPressableView>

          <AppText textVariant="bodySm" weight="semibold">
            Track order
          </AppText>

          <AppView style={{ width: 36 }} />
        </AppView>
      </AppBlurView>
    </AppView>
  );
}
