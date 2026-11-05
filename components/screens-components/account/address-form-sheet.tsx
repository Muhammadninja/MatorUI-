import { Check, MapPin } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView } from 'react-native';

import { useTranslation } from 'react-i18next';

import { AddressSuggestionsList } from '@/components/screens-components/account/address-suggestions-list';
import DeliveryLocationPicker from '@/components/screens-components/account/delivery-location-picker';
import { AppBottomSheet } from '@/components/shared/app-bottom-sheet';
import { AppButton } from '@/components/shared/app-button';
import AppTextField from '@/components/shared/app-text-field';
import { AppText } from '@/components/shared/app-text';
import { AppPressableView, AppView } from '@/components/shared/app-view';
import { WheelLoader } from '@/components/shared/wheel-loader';
import { useThemeContext } from '@/contexts/theme.context';
import { useAddressSuggestions } from '@/hooks/use-address-suggestions';
import { useAppLocation } from '@/hooks/use-app-location/use-app-location';
import {
  addressSaveErrorKey,
  composeLine1,
  splitLine1,
} from '@/services/checkout-presentation';
import { ordersTransport } from '@/services/orders-api';
import type {
  Address,
  AddressInput,
  AddressSuggestion,
  DeliveryPoint,
} from '@/services/orders-service';
import { debugLog } from '@/services/debug-log';

export type AddressFormValues = AddressInput;

export type AddressFormSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Present = edit mode (fields prefilled); absent = add mode. */
  initial?: Address | null;
  /** The sheet stays open, saying why, when this rejects. */
  onSubmit: (values: AddressFormValues) => void | Promise<void>;
};

const SEARCH_LANGUAGES = ['uz', 'ru', 'en'];

type ChosenPoint = DeliveryPoint & { from: 'suggestion' | 'location' | 'map' };

/**
 * Add / edit an address via a bottom-sheet form.
 *
 * The sheet is a fixed height (`expandable={false}`) with the fields in a ScrollView and
 * the save button pinned below it, so when the keyboard opens the fields scroll under it
 * while the button stays reachable. Swipe the drag handle down to dismiss.
 *
 * Courier delivery is priced from where the address is on the ground, and the courier goes
 * to that point, which text alone does not say. The buyer can choose any place, home, work or
 * someone else's door, wherever they are themselves: on the map, or by typing the city, street
 * and house and picking the match from a list the backend returns. The app does no geocoding
 * of its own. With a point the address needs no words at all, and the backend's description of
 * that point, if it has one, only saves typing.
 *
 * Using the current location is an optional shortcut for a buyer who is there. A tap is the
 * only thing that reads it. The coordinates are never shown. Changing the text of an address
 * with a saved point drops that point: the backend clears it on such a save, and this says so
 * before they save.
 */
export default function AddressFormSheet({ visible, onClose, initial, onSubmit }: AddressFormSheetProps) {
  const { t, i18n } = useTranslation();
  const { tokens } = useThemeContext();
  const location = useAppLocation();
  const [text, setText] = useState({ city: '', street: '', house: '' });
  const [landmark, setLandmark] = useState('');
  const [chosen, setChosen] = useState<ChosenPoint | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [outsideCoverage, setOutsideCoverage] = useState(false);
  const [dataCredit, setDataCredit] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Only the latest point's description counts, however the answers arrive. */
  const describeRequest = useRef(0);
  const latestText = useRef(text);
  latestText.current = text;

  // Reset the form whenever the sheet (re)opens, from the edited address or empty.
  useEffect(() => {
    if (!visible) return;
    const { street, house } = splitLine1(initial?.line1 ?? '');
    setText({ city: initial?.city ?? '', street, house });
    setLandmark(initial?.landmark ?? '');
    // A saved point with no words: adding words names that place, it does not move it.
    const wordless =
      initial && !initial.line1 && !initial.city && initial.lat != null && initial.lng != null;
    setChosen(wordless ? { lat: initial.lat!, lng: initial.lng!, from: 'location' } : null);
    setMapOpen(false);
    setOutsideCoverage(false);
    setDataCredit(null);
    setSubmitted(false);
    setLocateFailed(false);
    setSaveError(null);
    describeRequest.current += 1;
  }, [visible, initial]);

  const line1 = composeLine1(text.street, text.house);
  const city = text.city.trim();
  const textUnchanged = !!initial && line1 === initial.line1 && city === initial.city;
  const savedPoint: DeliveryPoint | null =
    initial?.lat != null && initial.lng != null ? { lat: initial.lat, lng: initial.lng } : null;
  const hasLocation = !!chosen || (textUnchanged && !!savedPoint);
  const canSave = Boolean((line1 && city) || hasLocation) && !outsideCoverage;

  const language =
    SEARCH_LANGUAGES.find((candidate) => i18n.language?.startsWith(candidate)) ?? 'uz';
  const street = text.street.trim();
  const house = text.house.trim();
  const query = useMemo(
    () =>
      visible && !hasLocation && street
        ? {
            street,
            house: house || undefined,
            city: city || undefined,
            lang: language,
            mode: submitted ? ('search' as const) : ('autocomplete' as const),
          }
        : null,
    [visible, hasLocation, street, house, city, language, submitted],
  );
  const suggestions = useAddressSuggestions(query);

  const edit = (key: keyof typeof text) => (value: string) => {
    setText((current) => ({ ...current, [key]: value }));
    // A match stands for the text it was picked for. A point chosen on the map or by GPS
    // stands by itself: words only describe it.
    setChosen((current) => (current?.from === 'suggestion' ? null : current));
    setSubmitted(false);
    setSaveError(null);
  };

  /**
   * Once a point is chosen, ask once what is known about it: whether couriers go there, and
   * its address, to save typing. Not while the map moves, and never required: with no answer
   * the point is still the destination. It fills in only what the buyer has left empty.
   */
  const describeChosenPoint = async (point: DeliveryPoint) => {
    describeRequest.current += 1;
    const request = describeRequest.current;
    setOutsideCoverage(false);
    setDataCredit(null);
    try {
      const { address, withinCoverage, attribution } = await ordersTransport.describePoint(
        point,
        language,
      );
      if (request !== describeRequest.current) return;
      setOutsideCoverage(withinCoverage === false);
      const typedSoFar = latestText.current;
      if (!address || typedSoFar.street.trim() || typedSoFar.house.trim() || typedSoFar.city.trim()) {
        return;
      }
      setText({
        street: address.street ?? '',
        house: address.houseNumber ?? '',
        city: address.city ?? address.district ?? '',
      });
      setDataCredit(attribution);
    } catch {
      // Only a convenience. The save will say if the point cannot be used.
    }
  };

  const confirmMapPoint = (point: DeliveryPoint) => {
    setMapOpen(false);
    setChosen({ ...point, from: 'map' });
    setSaveError(null);
    void describeChosenPoint(point);
  };

  const pick = (suggestion: AddressSuggestion) => {
    // A match can be the street alone, when the house is not in the data: keep the house the
    // buyer typed, or the courier never learns it.
    setText({
      street: suggestion.street ?? suggestion.title,
      house: suggestion.houseNumber ?? house,
      city: suggestion.city ?? city,
    });
    setChosen({ lat: suggestion.lat, lng: suggestion.lng, from: 'suggestion' });
    setOutsideCoverage(false);
    setSaveError(null);
  };

  const useCurrentLocation = async () => {
    setLocateFailed(false);
    setSaveError(null);
    const coords = await location.requestAndGetPosition();
    if (coords) {
      const point = { lat: coords.latitude, lng: coords.longitude };
      setChosen({ ...point, from: 'location' });
      void describeChosenPoint(point);
    } else {
      setLocateFailed(true);
    }
  };

  const handleSave = async () => {
    if (!canSave || saving) return;
    // A name the buyer did not give is regenerated, so it cannot go on naming the old street.
    const pinned = t('account.pinnedLocationLabel');
    const autoNamed =
      !initial?.label || initial.label === initial.line1 || initial.label === pinned;
    const payload: AddressFormValues = {
      label: autoNamed ? line1 || pinned : initial.label,
      name: initial?.name ?? '',
      line1,
      city,
      landmark,
      ...(chosen ? { lat: chosen.lat, lng: chosen.lng } : {}),
    };
    // Log what the user entered before it goes to the backend, so the values are
    // visible in the console (tag `[mator:address]`). Not where they are.
    debugLog('address', `form submit (${initial ? 'edit' : 'add'})`, {
      label: payload.label,
      line1: payload.line1,
      city: payload.city,
      hasLocation,
    });
    setSaving(true);
    setSaveError(null);
    try {
      await onSubmit(payload);
      onClose();
    } catch (error) {
      const code = (error as { code?: unknown } | null)?.code;
      setSaveError(t(addressSaveErrorKey(typeof code === 'string' ? code : null)));
    } finally {
      setSaving(false);
    }
  };

  const field = {
    containerRounded: 12 as const,
    containerColorName: 'backgroundSecondary' as const,
    containerBorderName: 'border' as const,
  };

  return (
    <AppBottomSheet visible={visible} onClose={onClose} expandable={false} heightFraction={0.8}>
      <AppView flex={1} px={20} pb={6}>
        <AppText family="heading" weight="bold" style={{ fontSize: 20, lineHeight: 26, marginBottom: 6 }} colorName="text">
          {initial ? t('account.editAddress') : t('account.addAddress')}
        </AppText>

        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ gap: 14, paddingTop: 6, paddingBottom: 14 }}
        >
          <AppTextField testID="address-field-city" label={t('account.city')} placeholder={t('account.cityPlaceholder')} value={text.city} onChangeText={edit('city')} autoCapitalize="words" {...field} />
          <AppTextField testID="address-field-street" label={t('account.street')} placeholder={t('account.streetPlaceholder')} value={text.street} onChangeText={edit('street')} onSubmitEditing={() => setSubmitted(true)} returnKeyType="search" autoCapitalize="words" {...field} />
          <AppTextField testID="address-field-house" label={t('account.house')} placeholder={t('account.housePlaceholder')} value={text.house} onChangeText={edit('house')} onSubmitEditing={() => setSubmitted(true)} returnKeyType="search" {...field} />

          <AddressSuggestionsList suggestions={suggestions} onPick={pick} />

          <AppView gap={4}>
            <AppButton
              testID="address-open-map"
              title={hasLocation ? t('account.changeOnMap') : t('account.chooseOnMap')}
              kind="secondary"
              size="sm"
              fullWidth
              onPress={() => setMapOpen(true)}
            />
            <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
              {t('account.anyPlaceHint')}
            </AppText>
          </AppView>

          <AppView gap={6} testID="address-location">
            <AppPressableView
              testID="address-use-location"
              onPress={useCurrentLocation}
              disabled={location.isLoading}
              accessibilityRole="button"
              accessibilityLabel={hasLocation ? t('account.updateLocation') : t('account.useCurrentLocation')}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <AppView row align="center" gap={8}>
                {location.isLoading ? (
                  <WheelLoader size={18} color={tokens.text} />
                ) : hasLocation ? (
                  <Check size={18} strokeWidth={2.4} color={tokens.success} />
                ) : (
                  <MapPin size={18} strokeWidth={2} color={tokens.text} />
                )}
                <AppText family="accent" weight="bold" style={{ fontSize: 13.5, color: tokens.text, flex: 1 }}>
                  {hasLocation ? t('account.locationSet') : t('account.useCurrentLocation')}
                </AppText>
                {hasLocation ? (
                  <AppText family="accent" weight="bold" style={{ fontSize: 13, color: tokens.textMuted }}>
                    {t('account.updateLocation')}
                  </AppText>
                ) : null}
              </AppView>
            </AppPressableView>
            {locateFailed ? (
              <AppText family="default" style={{ fontSize: 12.5, color: tokens.error }}>
                {t('account.locationFailed')}
              </AppText>
            ) : hasLocation ? null : (
              <AppText family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
                {t('account.locationHint')}
              </AppText>
            )}
          </AppView>

          {canSave && !hasLocation && suggestions.state !== 'loading' ? (
            <AppText testID="address-not-located" family="default" style={{ fontSize: 12.5, color: tokens.textMuted }}>
              {t('account.addressNotLocatedHint')}
            </AppText>
          ) : null}

          {outsideCoverage ? (
            <AppText testID="address-outside-coverage" family="default" style={{ fontSize: 13, color: tokens.error }}>
              {t('account.addressOutsideCoverage')}
            </AppText>
          ) : null}

          <AppTextField testID="address-field-landmark" label={t('account.landmark')} placeholder={t('account.landmarkPlaceholder')} value={landmark} onChangeText={setLandmark} maxLength={200} {...field} />

          {dataCredit ? (
            <AppText testID="address-data-credit" family="default" style={{ fontSize: 11, color: tokens.textMuted }}>
              {dataCredit}
            </AppText>
          ) : null}

          {saveError ? (
            <AppText testID="address-save-error" family="default" style={{ fontSize: 13, color: tokens.error }}>
              {saveError}
            </AppText>
          ) : null}
        </ScrollView>

        <AppButton testID="address-save-btn" title={initial ? t('account.saveChanges') : t('account.addAddress')} kind="brand" size="lg" fullWidth disabled={!canSave || saving} onPress={handleSave} />
      </AppView>

      <DeliveryLocationPicker
        visible={mapOpen}
        initialPoint={chosen ?? savedPoint}
        onCancel={() => setMapOpen(false)}
        onConfirm={confirmMapPoint}
      />
    </AppBottomSheet>
  );
}
