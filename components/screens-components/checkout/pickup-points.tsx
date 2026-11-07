import { AlertCircle, MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { LinkAction } from '@/components/screens-components/checkout/checkout-sections';
import AppMap from '@/components/shared/app-map';
import { AppText } from '@/components/shared/app-text';
import { AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import type { PickupPointsState } from '@/hooks/use-pickup-points';
import { isMapAvailable, regionAround } from '@/services/delivery-map';
import type { PickupPoint } from '@/services/orders-service';
import { formatCoordinates, pickupPointGap } from '@/services/pickup-points';

type Tokens = ReturnType<typeof useThemeContext>['tokens'];

/** Tall enough to tell the street, short enough to keep the checkout in view. */
const MAP_HEIGHT = 140;

/**
 * Where the buyer collects the order, shown under the pickup choice: the dealer each part is
 * bought from, once, with its address, its landmark when it has one, its place on the map
 * (or its coordinates, on a build that cannot draw a map) and the goods to collect there.
 * Only what the backend states: a dealer with no address or no place says so, and nothing
 * stands in for either. The map shows one dealer's pin and takes no touches: no route, no
 * distance, nothing about getting there.
 */
export function PickupPoints({
  tokens,
  state,
  points,
  onRetry,
}: {
  tokens: Tokens;
  state: PickupPointsState;
  points: PickupPoint[];
  onRetry: () => void;
}) {
  const { t } = useTranslation();
  if (state === 'idle') return null;
  if (state === 'loading') {
    return (
      <AppView testID="checkout-pickup-loading" row align="center" gap={8}>
        <WheelLoader size={18} color={tokens.text} />
        <AppText family="default" style={{ fontSize: 13.5, color: tokens.textMuted, flex: 1 }}>
          {t('checkout.pickupPointsLoading')}
        </AppText>
      </AppView>
    );
  }
  if (state === 'error') {
    return (
      <AppView testID="checkout-pickup-error" gap={8}>
        <AppView row align="center" gap={8}>
          <AlertCircle size={16} strokeWidth={2} color={tokens.error} />
          <AppText family="default" style={{ fontSize: 13, color: tokens.error, flex: 1 }}>
            {t('checkout.pickupPointsError')}
          </AppText>
        </AppView>
        <LinkAction label={t('common.retry')} onPress={onRetry} color={tokens.text} />
      </AppView>
    );
  }
  if (points.length === 0) return null;

  const mapAvailable = isMapAvailable();
  return (
    <AppView testID="checkout-pickup-points" gap={10}>
      <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.textMuted }}>
        {t('checkout.pickupPointsTitle')}
      </AppText>
      {points.map((point, index) => (
        <PickupPointCard
          key={point.dealerId ?? `unknown_${index}`}
          tokens={tokens}
          point={point}
          mapAvailable={mapAvailable}
        />
      ))}
    </AppView>
  );
}

function PickupPointCard({
  tokens,
  point,
  mapAvailable,
}: {
  tokens: Tokens;
  point: PickupPoint;
  mapAvailable: boolean;
}) {
  const { t } = useTranslation();
  const gap = pickupPointGap(point);
  return (
    <AppView
      testID="checkout-pickup-point"
      rounded={12}
      p={12}
      borderWidth={1}
      borderName="border"
      gap={6}
    >
      <AppView row align="center" gap={8}>
        <MapPin size={16} strokeWidth={2} color={tokens.text} />
        <AppText
          testID="checkout-pickup-dealer"
          family="default"
          weight="semibold"
          style={{ fontSize: 14.5, color: tokens.text, flex: 1 }}
        >
          {point.dealerName ?? t('checkout.pickupDealerUnknown')}
        </AppText>
      </AppView>

      {point.address ? (
        <AppText
          testID="checkout-pickup-address"
          family="default"
          style={{ fontSize: 13, color: tokens.text }}
        >
          {point.address}
        </AppText>
      ) : null}
      {point.landmark ? (
        <AppText
          testID="checkout-pickup-landmark"
          family="default"
          style={{ fontSize: 12.5, color: tokens.textMuted }}
        >
          {t('checkout.pickupLandmark', { landmark: point.landmark })}
        </AppText>
      ) : null}

      {point.location ? (
        mapAvailable ? (
          <AppView
            testID="checkout-pickup-map"
            rounded={10}
            pointerEvents="none"
            style={{ height: MAP_HEIGHT, overflow: 'hidden' }}
          >
            <AppMap
              initialRegion={regionAround(point.location)}
              markers={[
                {
                  id: point.dealerId ?? 'pickup',
                  coordinate: { latitude: point.location.lat, longitude: point.location.lng },
                  title: point.dealerName ?? undefined,
                },
              ]}
              scrollEnabled={false}
              zoomEnabled={false}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
              liteMode
            />
          </AppView>
        ) : (
          <AppText
            testID="checkout-pickup-coordinates"
            family="default"
            style={{ fontSize: 12.5, color: tokens.textMuted }}
          >
            {t('checkout.pickupCoordinates', { coordinates: formatCoordinates(point.location) })}
          </AppText>
        )
      ) : null}

      {gap ? (
        <AppView testID="checkout-pickup-gap" row align="center" gap={6}>
          <AlertCircle size={14} strokeWidth={2} color={tokens.textMuted} />
          <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted, flex: 1 }}>
            {gap === 'not_specified'
              ? t('checkout.pickupPointNotSpecified')
              : gap === 'no_address'
                ? t('checkout.pickupAddressNotSpecified')
                : t('checkout.pickupLocationNotSpecified')}
          </AppText>
        </AppView>
      ) : null}

      <AppView gap={2}>
        {point.items.map((item) => (
          <AppText
            key={item.cartItemId}
            testID="checkout-pickup-item"
            family="default"
            style={{ fontSize: 12.5, color: tokens.textMuted }}
          >
            {item.title} × {item.quantity}
          </AppText>
        ))}
      </AppView>
    </AppView>
  );
}
