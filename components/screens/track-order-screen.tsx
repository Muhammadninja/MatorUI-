import { useLocalSearchParams } from 'expo-router';
import {
  Check,
  MapPin,
  MessageSquare,
  Package,
  PackageX,
  Phone,
  Truck,
} from 'lucide-react-native';
import type { ComponentType } from 'react';
import { ActivityIndicator } from 'react-native';

import AppImage from '@/components/shared/app-image';
import AppScrollView from '@/components/shared/app-scroll-view/app-scroll-view';
import { AppSettingsHeader } from '@/components/shared/app-settings-header';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { useThemeContext } from '@/contexts/theme.context';
import { useOrder } from '@/hooks/use-orders';
import { useToast } from '@/hooks/use-toast';
import type { Courier, OrderDetail, OrderStatus } from '@/services/orders-service';
import { triggerHaptic } from '@/utils/haptics';

const STEP_ICONS: Record<OrderStatus, ComponentType<{ size?: number; strokeWidth?: number; color?: string }>> = {
  placed: Check,
  packed: Package,
  shipped: Truck,
  out_for_delivery: Truck,
  delivered: MapPin,
  cancelled: PackageX,
};

export default function TrackOrderScreen() {
  const params = useLocalSearchParams<{ orderId?: string }>();
  const orderId = typeof params.orderId === 'string' ? params.orderId : null;
  const { state, order, error, refresh } = useOrder(orderId);

  return (
    <AppView flex={1} colorName="background">
      <AppSettingsHeader title="Track order" fallbackHref="/cart" />
      {state === 'loading' || state === 'idle' ? (
        <LoadingState topInset={0} />
      ) : state === 'error' ? (
        <ErrorState topInset={0} message={error ?? 'Could not load order.'} onRetry={refresh} />
      ) : state === 'not_found' || !order ? (
        <NotFoundState topInset={0} orderId={orderId} />
      ) : (
        <OrderBody order={order} topInset={0} />
      )}
    </AppView>
  );
}

function LoadingState({ topInset }: { topInset: number }) {
  const { tokens } = useThemeContext();
  return (
    <AppView flex={1} justify="center" align="center" style={{ paddingTop: topInset }}>
      <ActivityIndicator color={tokens.text} />
    </AppView>
  );
}

function NotFoundState({ topInset, orderId }: { topInset: number; orderId: string | null }) {
  const { tokens } = useThemeContext();
  return (
    <AppView flex={1} justify="center" align="center" px={32} gap={12} style={{ paddingTop: topInset }}>
      <AppView
        center
        rounded={36}
        colorName="backgroundSecondary"
        borderName="border"
        borderWidth={1}
        style={{ width: 56, height: 56 }}
      >
        <PackageX size={22} strokeWidth={2} color={tokens.gray400} />
      </AppView>
      <AppText textVariant="bodySemibold" align="center">
        Order not found
      </AppText>
      <AppText textVariant="bodySm" colorName="gray400" align="center">
        {orderId ? `We couldn't find order ${orderId}.` : 'No order to track.'}
      </AppText>
    </AppView>
  );
}

function ErrorState({
  topInset,
  message,
  onRetry,
}: {
  topInset: number;
  message: string;
  onRetry: () => void;
}) {
  const { tokens } = useThemeContext();
  return (
    <AppView flex={1} justify="center" align="center" px={32} gap={12} style={{ paddingTop: topInset }}>
      <AppText textVariant="bodySemibold" align="center">
        Could not load order
      </AppText>
      <AppText textVariant="bodySm" colorName="gray400" align="center">
        {message}
      </AppText>
      <AppPressableView
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel="Retry"
        rounded={36}
        px={20}
        py={10}
        style={{ borderWidth: 1, borderColor: tokens.border }}
      >
        <AppText textVariant="bodySm" weight="semibold">
          Retry
        </AppText>
      </AppPressableView>
    </AppView>
  );
}

function OrderBody({ order, topInset }: { order: OrderDetail; topInset: number }) {
  const { tokens, scheme } = useThemeContext();
  const toast = useToast();
  const courier = order.courier;

  const handleCall = () => {
    triggerHaptic('selection');
    if (courier?.phone) {
      toast.info('Calling courier…', { description: `${courier.name} · ${courier.phone}` });
    } else {
      toast.info('Calling courier…', { description: courier?.name ?? 'Courier unavailable' });
    }
  };
  const handleMessage = () => {
    triggerHaptic('selection');
    toast.info('Chat coming soon', { description: 'Courier chat will sync once backend lands.' });
  };

  const statusColor = order.status === 'cancelled' ? tokens.error : tokens.success;

  return (
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
                borderColor: statusColor,
              }}
            >
              <AppText
                textVariant="bodyXs"
                weight="semibold"
                style={{ color: statusColor }}
              >
                {order.statusLabel}
              </AppText>
            </AppView>
            <AppText textVariant="bodyXs" colorName="gray400">
              Order #{order.id}
            </AppText>
          </AppView>
          <AppText textVariant="h3" family="heading" weight="bold">
            {order.status === 'delivered'
              ? `Delivered ${order.etaWindow}`
              : order.status === 'cancelled'
                ? 'Order cancelled'
                : `Arrives ${order.etaWindow}`}
          </AppText>
          <AppText textVariant="bodyXs" colorName="gray400">
            Placed {order.placedAt}
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
          <AppView row align="center" justify="space-between">
            <AppText textVariant="subtitle" family="accent">
              Progress
            </AppText>
            <AppView row align="center" gap={6}>
              <MapPin size={12} strokeWidth={2.2} color={tokens.gray400} />
              <AppText textVariant="bodyXs" colorName="gray400">
                {order.destination.label}
              </AppText>
            </AppView>
          </AppView>
          <AppView gap={0}>
            {order.steps.map((step, idx) => {
              const isDone = idx < order.currentStepIndex;
              const isCurrent = idx === order.currentStepIndex;
              const isPending = idx > order.currentStepIndex;
              const Icon = STEP_ICONS[step.key] ?? Check;
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
                      style={{ width: 28, height: 28, backgroundColor: dotBg }}
                    >
                      <Icon size={14} strokeWidth={2.4} color={iconColor} />
                    </AppView>
                    {idx < order.steps.length - 1 ? (
                      <AppView
                        style={{
                          width: 2,
                          height: 28,
                          backgroundColor:
                            idx < order.currentStepIndex
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

          {/* Destination footer — the address is where the progress line ends */}
          <AppView style={{ height: 1, backgroundColor: tokens.divider, marginHorizontal: -16 }} />
          <AppView row align="center" gap={10}>
            <AppView
              center
              rounded={36}
              style={{
                width: 28,
                height: 28,
                backgroundColor: scheme === 'dark' ? tokens.gray200 : tokens.gray100,
              }}
            >
              <MapPin size={14} strokeWidth={2.2} color={tokens.text} />
            </AppView>
            <AppView gap={1} style={{ flex: 1 }}>
              <AppText textVariant="bodySm" weight="semibold">
                {order.destination.line1}
              </AppText>
              <AppText textVariant="bodyXs" colorName="gray400">
                {order.destination.city}
              </AppText>
            </AppView>
          </AppView>
        </AppView>

        {/* Courier card — only when a courier is assigned */}
        {courier ? (
          <CourierCard courier={courier} onCall={handleCall} onMessage={handleMessage} />
        ) : null}

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
              {order.totalLabel}
            </AppText>
          </AppView>
          {order.items.map((item) => (
            <AppView key={item.id} row align="center" gap={12}>
              <AppImage
                source={
                  item.imageUrl
                    ? { uri: item.imageUrl }
                    : require('@/assets/images/test-image.png')
                }
                width={44}
                height={44}
                rounded={8}
                contentFit="cover"
                alt={item.title}
              />
              <AppView gap={2} style={{ flex: 1 }}>
                <AppText textVariant="bodySm" weight="semibold">
                  {item.title}
                </AppText>
                <AppText textVariant="bodyXs" colorName="gray400">
                  Qty {item.quantity}
                </AppText>
              </AppView>
              <AppText textVariant="bodySm">{item.price}</AppText>
            </AppView>
          ))}
        </AppView>
      </AppView>
    </AppScrollView>
  );
}

function CourierCard({
  courier,
  onCall,
  onMessage,
}: {
  courier: Courier;
  onCall: () => void;
  onMessage: () => void;
}) {
  const { tokens, scheme } = useThemeContext();
  return (
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
          ★ {courier.rating}
        </AppText>
      </AppView>
      <AppView row align="center" gap={12}>
        <AppImage
          source={
            courier.avatarUrl
              ? { uri: courier.avatarUrl }
              : require('@/assets/images/test-image.png')
          }
          width={48}
          height={48}
          rounded={36}
          contentFit="cover"
          alt={courier.name}
        />
        <AppView gap={2} style={{ flex: 1 }}>
          <AppText textVariant="bodySemibold">{courier.name}</AppText>
          <AppText textVariant="bodyXs" colorName="gray400">
            {courier.company}
          </AppText>
          <AppText textVariant="bodyXs" colorName="gray400">
            {courier.vehicle}
          </AppText>
        </AppView>
      </AppView>
      <AppView row gap={10}>
        <AppPressableView
          onPress={onCall}
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
          onPress={onMessage}
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
  );
}
