import { ArrowLeft, LocateFixed, MapPin } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, ScrollView } from 'react-native';
import type MapView from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddressSuggestionsList } from '@/components/screens-components/account/address-suggestions-list';
import { AppButton } from '@/components/shared/app-button';
import AppMap from '@/components/shared/app-map';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import { useAddressSuggestions } from '@/hooks/use-address-suggestions';
import { useAppLocation, type LocationFailure } from '@/hooks/use-app-location/use-app-location';
import { useDeliveryCoverage } from '@/hooks/use-delivery-coverage';
import { isWithinCoverage } from '@/services/delivery-coverage';
import {
  centerOf,
  isCenteredOn,
  isCloseEnoughToChoose,
  isMapAvailable,
  OVERVIEW_REGION,
  regionAround,
  regionOfBounds,
  roughCenter,
  MAX_CONFIRM_DELTA,
  STREET_DELTA,
  TAP_DELTA,
  type MapRegion,
} from '@/services/delivery-map';
import type { AddressSuggestion, DeliveryPoint } from '@/services/orders-service';

export type DeliveryLocationPickerProps = {
  visible: boolean;
  /** The point to start from, when the address has one. */
  initialPoint: DeliveryPoint | null;
  onCancel: () => void;
  onConfirm: (point: DeliveryPoint) => void;
};

const SEARCH_LANGUAGES = ['uz', 'ru', 'en'];
const MOVE_MS = 350;
/** Long enough for a camera move to end, after which a map event means the buyer moved it. */
const MOVE_SETTLE_MS = MOVE_MS + 450;
const MARKER_SIZE = 40;

/**
 * Choosing where a courier goes, on the map: home, work, someone else's door, anywhere. The
 * marker is fixed at the centre, so the point under it is the destination: moving the map
 * moves it, and tapping a place brings that place under it. GPS and address search are only
 * ways of moving the map. Either can fail and the map still works, and neither is compared
 * with what the buyer chooses.
 *
 * Nothing is selected until the buyer chooses something, so the camera's starting view can
 * never become someone's delivery address, and a point can only be confirmed from close
 * enough to see where it is, and inside the delivery area. The area is the one the backend
 * enforces, which it sends with its coverage. Nothing about a route is drawn, and nothing is
 * asked of the backend while the map moves.
 */
export default function DeliveryLocationPicker({
  visible,
  initialPoint,
  onCancel,
  onConfirm,
}: DeliveryLocationPickerProps) {
  // Only mounted while open: the map is costly, and its native view must not exist where
  // it cannot be drawn.
  if (!visible) return null;
  return (
    <Modal visible animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <PickerContent initialPoint={initialPoint} onCancel={onCancel} onConfirm={onConfirm} />
    </Modal>
  );
}

function PickerContent({
  initialPoint,
  onCancel,
  onConfirm,
}: Omit<DeliveryLocationPickerProps, 'visible'>) {
  const { t, i18n } = useTranslation();
  const { tokens } = useThemeContext();
  const insets = useSafeAreaInsets();
  const location = useAppLocation();
  const { bounds, polygons } = useDeliveryCoverage();
  const mapAvailable = isMapAvailable();

  const mapRef = useRef<MapView>(null);
  const [startRegion] = useState<MapRegion>(() =>
    initialPoint ? regionAround(initialPoint) : OVERVIEW_REGION,
  );
  const [selected, setSelected] = useState<DeliveryPoint | null>(initialPoint);
  const [closeEnough, setCloseEnough] = useState(
    !mapAvailable || isCloseEnoughToChoose(startRegion),
  );
  const [locateFailure, setLocateFailure] = useState<LocationFailure | null>(null);
  const [typed, setTyped] = useState('');
  const [submitted, setSubmitted] = useState(false);

  /** The buyer has chosen something, so the point under the marker now counts. */
  const chosen = useRef(!!initialPoint);
  /** Where the app itself last pointed the camera: not a choice by the buyer. */
  const camera = useRef<DeliveryPoint>(centerOf(startRegion));
  /** The exact point a camera move is on its way to, kept exact when it arrives. */
  const heading = useRef<DeliveryPoint | null>(null);
  const headingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const zoom = useRef(startRegion.latitudeDelta);
  const center = useRef<DeliveryPoint>(centerOf(startRegion));
  /** The map's own last report since the last camera move. */
  const lastRegion = useRef<MapRegion | null>(null);

  useEffect(
    () => () => {
      if (headingTimer.current) clearTimeout(headingTimer.current);
    },
    [],
  );

  // Open on the delivery area once it is known, unless the buyer has already got going.
  useEffect(() => {
    if (!bounds || chosen.current) return;
    const region = regionOfBounds(bounds);
    camera.current = centerOf(region);
    center.current = centerOf(region);
    zoom.current = region.latitudeDelta;
    setCloseEnough(isCloseEnoughToChoose(region));
    mapRef.current?.animateToRegion(region, 0);
  }, [bounds]);

  /** Brings a place under the marker, and selects exactly that place. */
  const moveTo = (point: DeliveryPoint, delta: number) => {
    chosen.current = true;
    heading.current = point;
    center.current = point;
    lastRegion.current = null;
    setSelected(point);
    setCloseEnough(!mapAvailable || delta <= MAX_CONFIRM_DELTA);
    setLocateFailure(null);
    mapRef.current?.animateToRegion(regionAround(point, delta), MOVE_MS);
    // If the buyer cuts the move short it never arrives, and there may be no further report.
    // What the map last said is then where the marker is, so that has to count.
    if (headingTimer.current) clearTimeout(headingTimer.current);
    headingTimer.current = setTimeout(() => {
      heading.current = null;
      if (lastRegion.current) applyRegion(lastRegion.current);
    }, MOVE_SETTLE_MS);
  };

  const onMapMoved = (region: MapRegion) => {
    center.current = centerOf(region);
    zoom.current = region.latitudeDelta;
    lastRegion.current = region;
    if (heading.current) {
      if (!isCenteredOn(heading.current, region)) return; // still on its way there
      heading.current = null;
    }
    applyRegion(region);
  };

  const applyRegion = (region: MapRegion) => {
    const point = centerOf(region);
    setCloseEnough(isCloseEnoughToChoose(region));
    // The first event only reports where the camera started.
    if (!chosen.current && isCenteredOn(camera.current, region)) return;
    chosen.current = true;
    // Keep an exact choice exact when the map merely settles on it.
    setSelected((current) => (current && isCenteredOn(current, region) ? current : point));
  };

  const useMyLocation = async () => {
    setLocateFailure(null);
    const coords = await location.requestAndGetPosition();
    if (coords) moveTo({ lat: coords.latitude, lng: coords.longitude }, STREET_DELTA);
    else setLocateFailure(location.lastFailure?.() ?? 'unavailable');
  };

  const pickSuggestion = (suggestion: AddressSuggestion) => {
    setTyped('');
    setSubmitted(false);
    moveTo({ lat: suggestion.lat, lng: suggestion.lng }, STREET_DELTA);
  };

  const outsideCoverage = !!selected && !!polygons && !isWithinCoverage(selected, polygons);

  const language =
    SEARCH_LANGUAGES.find((candidate) => i18n.language?.startsWith(candidate)) ?? 'uz';
  const searchText = typed.trim();
  // The map context is read when the text changes, so moving the map searches nothing.
  const query = useMemo(
    () =>
      searchText
        ? {
            street: searchText,
            lang: language,
            mode: submitted ? ('search' as const) : ('autocomplete' as const),
            ...(chosen.current || bounds ? roughCenter(center.current) : {}),
          }
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchText, language, submitted],
  );
  const suggestions = useAddressSuggestions(query);

  return (
    <AppView flex={1} colorName="background" testID="delivery-location-picker">
      <AppView flex={1}>
        {mapAvailable ? (
          <>
            <AppMap
              ref={mapRef}
              testID="delivery-map"
              initialRegion={startRegion}
              onPress={(event) => {
                const { latitude, longitude } = event.nativeEvent.coordinate;
                moveTo({ lat: latitude, lng: longitude }, Math.min(zoom.current, TAP_DELTA));
              }}
              onRegionChangeComplete={onMapMoved}
              rotateEnabled={false}
              pitchEnabled={false}
              toolbarEnabled={false}
            />
            {/* The destination. Its tip sits exactly on the centre of the map. */}
            <AppView
              testID="delivery-map-marker"
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                marginLeft: -MARKER_SIZE / 2,
                marginTop: -MARKER_SIZE,
              }}
            >
              <MapPin size={MARKER_SIZE} strokeWidth={2.2} color={tokens.brandBg} fill={tokens.background} />
            </AppView>
          </>
        ) : (
          <AppView flex={1} center px="xl">
            <AppText testID="delivery-map-unavailable" family="default" style={{ fontSize: 14, color: tokens.textMuted, textAlign: 'center' }}>
              {t('deliveryMap.unavailable')}
            </AppText>
          </AppView>
        )}

        {/* Search, floating over the map */}
        <AppView style={{ position: 'absolute', top: insets.top + 8, left: 12, right: 12, gap: 8 }}>
          <AppView row align="center" gap={8}>
            <AppPressableView
              testID="delivery-map-back"
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel={t('deliveryMap.back')}
              center
              rounded={12}
              colorName="card"
              borderWidth={1}
              borderName="border"
              style={{ width: 44, height: 44 }}
            >
              <ArrowLeft size={22} strokeWidth={2.2} color={tokens.text} />
            </AppPressableView>
            <AppView flex={1}>
              <AppTextField
                testID="delivery-map-search"
                placeholder={t('deliveryMap.searchPlaceholder')}
                value={typed}
                onChangeText={(value) => {
                  setTyped(value);
                  setSubmitted(false);
                }}
                onSubmitEditing={() => setSubmitted(true)}
                returnKeyType="search"
                autoCorrect={false}
                containerRounded={12}
              />
            </AppView>
          </AppView>
          {suggestions.state !== 'idle' ? (
            <AppView rounded={12} p={10} colorName="card" borderWidth={1} borderName="border" style={{ maxHeight: 280 }}>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <AddressSuggestionsList suggestions={suggestions} onPick={pickSuggestion} />
              </ScrollView>
            </AppView>
          ) : null}
        </AppView>

        {/* Optional: only moves the map, and only when asked. */}
        <AppPressableView
          testID="delivery-map-locate"
          onPress={useMyLocation}
          disabled={location.isLoading}
          accessibilityRole="button"
          accessibilityLabel={t('deliveryMap.useMyLocation')}
          center
          rounded={999}
          colorName="card"
          borderWidth={1}
          borderName="border"
          style={{ position: 'absolute', right: 12, bottom: 28, width: 48, height: 48 }}
        >
          {location.isLoading ? (
            <WheelLoader size={20} color={tokens.text} />
          ) : (
            <LocateFixed size={22} strokeWidth={2} color={tokens.text} />
          )}
        </AppPressableView>
      </AppView>

      <AppView px={20} gap={10} style={{ paddingTop: 12, paddingBottom: Math.max(insets.bottom, 16) }}>
        {locateFailure ? (
          <AppText testID="delivery-map-locate-failed" family="default" style={{ fontSize: 12.5, color: tokens.error }}>
            {t(locateFailure === 'denied' ? 'account.locationDenied' : 'account.locationUnavailable')}
          </AppText>
        ) : outsideCoverage ? (
          <AppText testID="delivery-map-outside" family="default" style={{ fontSize: 13, color: tokens.error }}>
            {t('account.addressOutsideCoverage')}
          </AppText>
        ) : (
          <AppText testID="delivery-map-hint" family="default" style={{ fontSize: 13, color: tokens.textMuted }}>
            {closeEnough ? t('deliveryMap.hint') : t('deliveryMap.zoomIn')}
          </AppText>
        )}
        <AppButton
          testID="delivery-map-confirm"
          title={t('deliveryMap.confirm')}
          kind="brand"
          size="lg"
          fullWidth
          disabled={!selected || !closeEnough || outsideCoverage}
          onPress={() => {
            if (selected && closeEnough && !outsideCoverage) onConfirm(selected);
          }}
        />
      </AppView>
    </AppView>
  );
}
