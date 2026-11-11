/**
 * Choosing where an address is, with the real form and the real suggestions hook, and only
 * the transport and the map standing in. The buyer chooses on the map, or types city, street
 * and house and picks a match, from anywhere. Using the current location is an optional
 * shortcut, read only on a tap. The coordinates are never shown, and a saved point stops
 * counting as soon as the text says the address has moved.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, requestPosition, searchAddresses, describePoint, picker, locationFailure } =
  vi.hoisted(() => ({
    host:
      (type: string) =>
      ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
        React.createElement(type, p, children),
    requestPosition: vi.fn(),
    searchAddresses: vi.fn(),
    describePoint: vi.fn(),
    picker: { props: null as null | Record<string, any> },
    locationFailure: { current: null as null | 'denied' | 'unavailable' },
  }));

vi.mock('react-native', () => ({
  ScrollView: host('scroll'),
  Keyboard: { addListener: () => ({ remove: () => {} }), isVisible: () => false },
}));
vi.mock('lucide-react-native', () => ({ Check: () => null, MapPin: () => null }));
vi.mock('@/components/shared/app-bottom-sheet', () => ({ AppBottomSheet: host('sheet') }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-text-field', () => ({ default: host('field') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/shared/wheel-loader', () => ({ WheelLoader: host('loader') }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: {} }) }));
vi.mock('@/hooks/use-app-location/use-app-location', () => ({
  useAppLocation: () => ({
    requestAndGetPosition: requestPosition,
    isLoading: false,
    lastFailure: () => locationFailure.current,
  }),
}));
vi.mock('@/services/debug-log', () => ({ debugLog: vi.fn() }));
vi.mock('@/services/orders-api', () => ({ ordersTransport: { searchAddresses, describePoint } }));
vi.mock('@/components/screens-components/account/delivery-location-picker', () => ({
  default: (props: Record<string, any>) => {
    picker.props = props;
    return null;
  },
}));

import AddressFormSheet from '@/components/screens-components/account/address-form-sheet';
import i18n from '@/services/i18n';
import type { Address, AddressSuggestion } from '@/services/orders-service';

const SAVED: Address = {
  id: 'addr_1',
  label: 'Дом',
  line1: 'Навои 1',
  city: 'Ташкент',
  lat: 41.311081,
  lng: 69.240562,
};
const NOT_LOCATED: Address = { ...SAVED, lat: null, lng: null };

const MATCH: AddressSuggestion = {
  id: '1',
  title: 'Амира Темура 12',
  subtitle: 'Юнусабад, Ташкент',
  city: 'Ташкент',
  district: 'Юнусабад',
  street: 'Амира Темура',
  houseNumber: '12',
  lat: 39.654321,
  lng: 66.975432,
};
/** What the backend sends when the house is not in the data: the street itself. */
const STREET_ONLY: AddressSuggestion = { ...MATCH, id: '2', title: 'Амира Темура', houseNumber: null };

describe('AddressFormSheet', () => {
  let renderer: ReactTestRenderer;
  const onSubmit = vi.fn();
  const onClose = vi.fn();

  const allText = () =>
    renderer.root
      .findAll((node) => node.type === 'text')
      .flatMap((node) => node.children.filter((c): c is string => typeof c === 'string'))
      .join(' | ');
  const hostNode = (id: string) =>
    renderer.root.find((node) => node.props.testID === id && typeof node.type === 'string');
  const exists = (id: string) =>
    renderer.root.findAll((node) => node.props.testID === id && typeof node.type === 'string').length > 0;
  const type = (id: 'city' | 'street' | 'house', value: string) =>
    act(() => {
      hostNode(`address-field-${id}`).props.onChangeText(value);
    });
  /** Past the debounce, with the answer in. React holds updates until each act ends. */
  const searched = async () => {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    for (let i = 0; i < 4; i += 1) {
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
    }
  };
  const pick = (index: number) =>
    act(() => {
      hostNode(`address-suggestion-${index}`).props.onPress();
    });
  const useLocation = () =>
    act(async () => {
      await hostNode('address-use-location').props.onPress();
    });
  const save = () =>
    act(async () => {
      await hostNode('address-save-btn').props.onPress();
    });
  const saveButton = () => hostNode('address-save-btn');
  const fieldValue = (id: 'city' | 'street' | 'house') => hostNode(`address-field-${id}`).props.value;
  const openMap = () =>
    act(() => {
      hostNode('address-open-map').props.onPress();
    });
  /** The buyer confirms a point on the map, and the form hears back about it. */
  const confirmOnMap = async (lat: number, lng: number) => {
    openMap();
    await act(async () => {
      picker.props!.onConfirm({ lat, lng });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  };
  const ui = (initial?: Address | null, visible = true) => (
    <QueryClientProvider client={client}>
      <AddressFormSheet visible={visible} onClose={onClose} initial={initial} onSubmit={onSubmit} />
    </QueryClientProvider>
  );
  let client: QueryClient;
  const mount = async (initial?: Address) => {
    await act(async () => {
      renderer = create(ui(initial));
    });
  };

  beforeAll(async () => {
    await i18n.changeLanguage('ru');
  });
  beforeEach(() => {
    vi.clearAllMocks();
    locationFailure.current = null;
    client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    searchAddresses.mockResolvedValue({ items: [MATCH], attribution: null });
    describePoint.mockResolvedValue({ address: null, withinCoverage: true, attribution: null });
    onSubmit.mockResolvedValue(undefined);
  });
  afterEach(() => act(() => renderer.unmount()));

  describe('typing an address', () => {
    test('has a field each for the city, the street and the house', async () => {
      await mount();
      expect(exists('address-field-city')).toBe(true);
      expect(exists('address-field-street')).toBe(true);
      expect(exists('address-field-house')).toBe(true);
    });

    test('asks the backend for matches to what was typed, in the app language', async () => {
      await mount();
      type('city', 'Ташкент');
      type('street', 'Амира Темура');
      type('house', '12');
      await searched();

      expect(searchAddresses).toHaveBeenCalledTimes(1);
      expect(searchAddresses.mock.calls[0]![0]).toEqual({
        street: 'Амира Темура',
        house: '12',
        city: 'Ташкент',
        lang: 'ru',
        mode: 'autocomplete',
      });
    });

    test('waits for a pause and a real word, rather than searching on every keystroke', async () => {
      await mount();
      type('street', 'Ам');
      await searched();
      expect(searchAddresses).not.toHaveBeenCalled();

      type('street', 'Ами');
      type('street', 'Амир');
      type('street', 'Амира');
      await searched();
      expect(searchAddresses).toHaveBeenCalledTimes(1);
      expect(searchAddresses.mock.calls[0]![0].street).toBe('Амира');
    });

    test('lists what came back, and shows the credit the data needs', async () => {
      searchAddresses.mockResolvedValue({
        items: [MATCH, STREET_ONLY],
        attribution: '© OpenStreetMap contributors',
      });
      await mount();
      type('street', 'Амира Темура');
      await searched();

      expect(exists('address-suggestion-0')).toBe(true);
      expect(exists('address-suggestion-1')).toBe(true);
      expect(allText()).toContain('Амира Темура 12');
      expect(allText()).toContain('Юнусабад, Ташкент');
      expect(allText()).toContain('© OpenStreetMap contributors');
    });

    test('says when nothing matches, and the address can still be typed and saved', async () => {
      searchAddresses.mockResolvedValue({ items: [], attribution: null });
      await mount();
      type('city', 'Ташкент');
      type('street', 'Несуществующая');
      await searched();

      expect(allText()).toContain('Ничего не найдено');
      expect(saveButton().props.disabled).toBe(false);
    });

    test('says when the search fails, and blocks nothing', async () => {
      searchAddresses.mockRejectedValue(new Error('down'));
      await mount();
      type('city', 'Ташкент');
      type('street', 'Амира Темура');
      await searched();

      expect(allText()).toContain('Поиск адреса сейчас недоступен');
      expect(saveButton().props.disabled).toBe(false);
    });

    test('warns that a typed address alone cannot be priced for a courier', async () => {
      searchAddresses.mockResolvedValue({ items: [], attribution: null });
      await mount();
      type('city', 'Ташкент');
      type('street', 'Амира Темура');
      await searched();

      expect(exists('address-not-located')).toBe(true);
    });
  });

  describe('picking a match: delivery to somewhere the buyer is not', () => {
    test('fills the fields and saves the match with its point, reading no location at all', async () => {
      await mount();
      type('street', 'Амира');
      await searched();

      pick(0);
      expect(fieldValue('street')).toBe('Амира Темура');
      expect(fieldValue('house')).toBe('12');
      expect(fieldValue('city')).toBe('Ташкент');
      expect(allText()).toContain('Точка доставки выбрана');

      await save();

      expect(requestPosition).not.toHaveBeenCalled();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({
        line1: 'Амира Темура 12',
        city: 'Ташкент',
        lat: 39.654321,
        lng: 66.975432,
      });
    });

    test('a street-level match keeps the house the buyer typed, or the courier never learns it', async () => {
      searchAddresses.mockResolvedValue({ items: [STREET_ONLY], attribution: null });
      await mount();
      type('street', 'Амира Темура');
      type('house', '99');
      await searched();

      pick(0);
      await save();

      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ line1: 'Амира Темура 99' });
    });

    test('stops searching once picked', async () => {
      await mount();
      type('street', 'Амира');
      await searched();
      pick(0);
      await searched();

      expect(exists('address-suggestion-0')).toBe(false);
      expect(searchAddresses).toHaveBeenCalledTimes(1);
    });

    test('changing the text afterwards drops the pick and searches again', async () => {
      await mount();
      type('street', 'Амира');
      await searched();
      pick(0);

      type('house', '13');
      expect(allText()).not.toContain('Точка доставки выбрана');
      await searched();

      expect(searchAddresses).toHaveBeenCalledTimes(2);
      await save();
      expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('lat');
    });
  });

  describe('choosing on the map', () => {
    const PIN = { lat: 39.654321987, lng: 66.975432123 };

    test('opens only when asked, from where the address is', async () => {
      await mount(SAVED);
      expect(picker.props!.visible).toBe(false);

      openMap();

      expect(picker.props!.visible).toBe(true);
      expect(picker.props!.initialPoint).toEqual({ lat: SAVED.lat, lng: SAVED.lng });
      expect(requestPosition).not.toHaveBeenCalled();
    });

    test('with no point yet, it starts from nothing', async () => {
      await mount();
      openMap();
      expect(picker.props!.initialPoint).toBeNull();
    });

    test('saves the exact point confirmed, and needs no words at all', async () => {
      await mount();
      expect(saveButton().props.disabled).toBe(true);

      await confirmOnMap(PIN.lat, PIN.lng);

      expect(picker.props!.visible).toBe(false);
      expect(allText()).toContain('Точка доставки выбрана');
      expect(saveButton().props.disabled).toBe(false);
      await save();
      expect(onSubmit.mock.calls[0]![0]).toEqual({
        label: 'Выбранная точка',
        name: '',
        line1: '',
        city: '',
        landmark: '',
        ...PIN,
      });
    });

    test('backing out changes nothing', async () => {
      await mount();
      openMap();
      act(() => {
        picker.props!.onCancel();
      });

      expect(picker.props!.visible).toBe(false);
      expect(saveButton().props.disabled).toBe(true);
      expect(describePoint).not.toHaveBeenCalled();
    });

    test('asks once about the confirmed point, never before', async () => {
      await mount();
      openMap();
      expect(describePoint).not.toHaveBeenCalled();

      await confirmOnMap(PIN.lat, PIN.lng);

      expect(describePoint).toHaveBeenCalledTimes(1);
      expect(describePoint).toHaveBeenCalledWith(PIN, 'ru');
    });

    test('fills in an address the backend knows, with the credit its data needs', async () => {
      describePoint.mockResolvedValue({
        address: { city: 'Ташкент', district: 'Чиланзар', street: 'Сеул', houseNumber: '5' },
        withinCoverage: true,
        attribution: 'Map data © OpenStreetMap contributors, licensed under the ODbL.',
      });
      await mount();

      await confirmOnMap(PIN.lat, PIN.lng);

      expect(fieldValue('street')).toBe('Сеул');
      expect(fieldValue('house')).toBe('5');
      expect(fieldValue('city')).toBe('Ташкент');
      expect(allText()).toContain('OpenStreetMap');
      await save();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({
        label: 'Сеул 5',
        line1: 'Сеул 5',
        city: 'Ташкент',
        ...PIN,
      });
    });

    test('never overwrites what the buyer typed', async () => {
      describePoint.mockResolvedValue({
        address: { city: 'Ташкент', district: null, street: 'Сеул', houseNumber: null },
        withinCoverage: true,
        attribution: 'credit',
      });
      await mount();
      type('street', 'Мой дом');

      await confirmOnMap(PIN.lat, PIN.lng);

      expect(fieldValue('street')).toBe('Мой дом');
      expect(allText()).not.toContain('credit');
    });

    test('a point with no known address is still the destination', async () => {
      await mount();
      await confirmOnMap(PIN.lat, PIN.lng);

      expect(fieldValue('street')).toBe('');
      expect(saveButton().props.disabled).toBe(false);
    });

    test('not getting an answer at all is no obstacle', async () => {
      describePoint.mockRejectedValue(new Error('down'));
      await mount();

      await confirmOnMap(PIN.lat, PIN.lng);

      expect(saveButton().props.disabled).toBe(false);
      await save();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject(PIN);
    });

    describe('when the buyer chooses again before the answer comes', () => {
      const answers: ((value: unknown) => void)[] = [];
      const known = (street: string, withinCoverage = true) => ({
        address: { city: 'Ташкент', district: null, street, houseNumber: null },
        withinCoverage,
        attribution: null,
      });
      const answer = (index: number, value: unknown) =>
        act(async () => {
          answers[index]!(value);
        });

      beforeEach(async () => {
        answers.length = 0;
        describePoint.mockImplementation(() => new Promise((resolve) => answers.push(resolve)));
        await mount();
        await confirmOnMap(41.3, 69.2);
        await confirmOnMap(41.4, 69.3);
      });

      test('the old point does not fill in the address of the new one', async () => {
        await answer(0, known('Старая'));
        expect(fieldValue('street')).toBe('');

        await answer(1, known('Новая'));
        expect(fieldValue('street')).toBe('Новая');
      });

      test('nor does a late answer replace it', async () => {
        await answer(1, known('Новая'));
        await answer(0, known('Старая'));
        expect(fieldValue('street')).toBe('Новая');
      });

      test('the old point being outside the area says nothing about the new one', async () => {
        await answer(0, known('Старая', false));

        expect(allText()).not.toContain('Это место вне зоны доставки');
        expect(saveButton().props.disabled).toBe(false);
      });
    });

    test('a place outside the delivery area says so at once, and cannot be saved', async () => {
      describePoint.mockResolvedValue({ address: null, withinCoverage: false, attribution: null });
      await mount();

      await confirmOnMap(55.75, 37.61);

      expect(allText()).toContain('Это место вне зоны доставки');
      expect(saveButton().props.disabled).toBe(true);
      await save();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    test('choosing another place clears that', async () => {
      describePoint.mockResolvedValueOnce({ address: null, withinCoverage: false, attribution: null });
      await mount();
      await confirmOnMap(55.75, 37.61);

      await confirmOnMap(41.3, 69.2);

      expect(allText()).not.toContain('Это место вне зоны доставки');
      expect(saveButton().props.disabled).toBe(false);
    });

    test('with no area configured it cannot say, and the save goes ahead', async () => {
      describePoint.mockResolvedValue({ address: null, withinCoverage: null, attribution: null });
      await mount();
      await confirmOnMap(41.3, 69.2);
      expect(saveButton().props.disabled).toBe(false);
    });

    test('words added afterwards only describe the point: it stays', async () => {
      await mount();
      await confirmOnMap(PIN.lat, PIN.lng);

      type('street', 'Навои');
      type('city', 'Самарканд');

      expect(allText()).toContain('Точка доставки выбрана');
      await searched();
      expect(searchAddresses).not.toHaveBeenCalled();
      await save();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ line1: 'Навои', ...PIN });
    });

    test('changes a saved point, keeping the words', async () => {
      await mount(SAVED);

      await confirmOnMap(PIN.lat, PIN.lng);
      await save();

      expect(onSubmit.mock.calls[0]![0]).toMatchObject({
        label: 'Дом',
        line1: 'Навои 1',
        city: 'Ташкент',
        ...PIN,
      });
    });

    test('is the way forward when a search finds nothing or is down', async () => {
      searchAddresses.mockRejectedValue(new Error('down'));
      await mount();
      type('street', 'Амира');
      await searched();
      expect(allText()).toContain('Поиск адреса сейчас недоступен');

      await confirmOnMap(PIN.lat, PIN.lng);

      await save();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject(PIN);
    });
  });

  describe('a hint for the courier', () => {
    test('goes with the address, and needs a point or a street like any other', async () => {
      await mount();
      await act(async () => {
        hostNode('address-field-landmark').props.onChangeText('Синие ворота');
      });
      expect(saveButton().props.disabled).toBe(true);

      await confirmOnMap(41.3, 69.2);
      await save();

      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ landmark: 'Синие ворота', lat: 41.3 });
    });

    test('is shown when editing, and changing it does not move the address', async () => {
      await mount({ ...SAVED, landmark: 'Старый ориентир' });
      expect(hostNode('address-field-landmark').props.value).toBe('Старый ориентир');

      await act(async () => {
        hostNode('address-field-landmark').props.onChangeText('Новый ориентир');
      });

      expect(allText()).toContain('Сохранённая точка доставки');
      await save();
      const payload = onSubmit.mock.calls[0]![0];
      expect(payload.landmark).toBe('Новый ориентир');
      expect(payload).not.toHaveProperty('lat');
    });
  });

  describe('searching', () => {
    test('pressing search on the keyboard runs a full search at once', async () => {
      await mount();
      type('street', 'Амира');
      act(() => {
        hostNode('address-field-street').props.onSubmitEditing();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(searchAddresses.mock.lastCall![0]).toMatchObject({ street: 'Амира', mode: 'search' });
    });

    test('sends what was typed, and nothing about the buyer', async () => {
      await mount({ ...NOT_LOCATED, name: 'Иван Иванов' });
      await searched();

      expect(Object.keys(searchAddresses.mock.calls[0]![0]).sort()).toEqual([
        'city',
        'house',
        'lang',
        'mode',
        'street',
      ]);
    });
  });

  describe('the current location, which is optional', () => {
    test('opening the form reads no location', async () => {
      await mount();
      expect(requestPosition).not.toHaveBeenCalled();
      expect(allText()).toContain('Использовать моё текущее местоположение');
      expect(allText()).toContain('Необязательно');
    });

    test('saving without it sends none: never the current position behind their back', async () => {
      await mount();
      type('street', 'Навои 1');
      type('city', 'Ташкент');
      await save();

      expect(requestPosition).not.toHaveBeenCalled();
      const payload = onSubmit.mock.calls[0]![0];
      expect(payload).toMatchObject({ line1: 'Навои 1', city: 'Ташкент' });
      expect(payload).not.toHaveProperty('lat');
      expect(payload).not.toHaveProperty('lng');
    });

    test('tapping states it, says so, and saves it with the address', async () => {
      await mount();
      type('street', 'Навои 1');
      type('city', 'Ташкент');
      requestPosition.mockResolvedValue({ latitude: 41.3, longitude: 69.2 });

      await useLocation();

      expect(allText()).toContain('Указано ваше текущее местоположение');
      await save();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ lat: 41.3, lng: 69.2 });
    });

    test('with it the address needs no words at all: a pin with no street is a real place', async () => {
      await mount();
      expect(saveButton().props.disabled).toBe(true);
      requestPosition.mockResolvedValue({ latitude: 41.3, longitude: 69.2 });

      await useLocation();
      expect(saveButton().props.disabled).toBe(false);
      await save();

      expect(onSubmit.mock.calls[0]![0]).toEqual({
        label: 'Выбранная точка',
        name: '',
        line1: '',
        city: '',
        landmark: '',
        lat: 41.3,
        lng: 69.2,
      });
    });

    test('describing where they stand does not move them', async () => {
      await mount();
      requestPosition.mockResolvedValue({ latitude: 41.3, longitude: 69.2 });
      await useLocation();

      type('street', 'Навои');
      await save();

      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ line1: 'Навои', lat: 41.3, lng: 69.2 });
    });

    test('a refused or failed location says so, and the address can still be saved', async () => {
      await mount();
      type('street', 'Навои 1');
      type('city', 'Ташкент');
      requestPosition.mockResolvedValue(null);

      await useLocation();

      expect(allText()).toContain('Не удалось определить местоположение');
      await save();
      expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('lat');
    });

    test('refused access is told apart from a device that cannot find itself', async () => {
      await mount();
      requestPosition.mockResolvedValue(null);
      locationFailure.current = 'denied';

      await useLocation();

      expect(hostNode('address-location-note').props.children).toBe(
        'Нет доступа к геолокации. Разрешите его в настройках телефона или укажите точку на карте.',
      );
    });

    describe('a saved point whose refresh fails (the contradiction seen on device)', () => {
      test.each([
        ['denied', 'Нет доступа к геолокации, поэтому точка не обновлена.'],
        ['unavailable', 'Не удалось определить местоположение, поэтому точка не обновлена.'],
      ] as const)(
        '%s: still says the saved point is set, and that it was kept',
        async (failure, note) => {
          await mount(SAVED);
          requestPosition.mockResolvedValue(null);
          locationFailure.current = failure;

          await useLocation();

          expect(hostNode('address-location-status').props.children).toBe(
            'Сохранённая точка доставки',
          );
          expect(hostNode('address-location-note').props.children).toBe(note);
          // One note at most: never "set" beside a bare "could not determine".
          expect(
            renderer.root.findAll(
              (n) => n.props.testID === 'address-location-note' && typeof n.type === 'string',
            ),
          ).toHaveLength(1);
          expect(allText()).not.toContain('Проверьте, что геолокация включена');
          await save();
          expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('lat');
        },
      );
    });

    test('a pin with no words is shown as the saved point, not as a fresh GPS reading', async () => {
      await mount({ ...SAVED, line1: '', city: '' });
      expect(hostNode('address-location-status').props.children).toBe('Сохранённая точка доставки');
      expect(exists('address-location-note')).toBe(false);
    });

    test('never shows the coordinates', async () => {
      await mount(SAVED);
      expect(allText()).not.toMatch(/41\.3|69\.2/);

      requestPosition.mockResolvedValue({ latitude: 41.3, longitude: 69.2 });
      await useLocation();
      expect(allText()).not.toMatch(/41\.3|69\.2/);
    });
  });

  describe('what cannot be saved', () => {
    test.each([
      ['nothing', '', ''],
      ['no city', 'Навои 1', ''],
      ['no street', '', 'Ташкент'],
    ])('%s, with no point either', async (_, street, city) => {
      await mount();
      type('street', street);
      type('city', city);

      expect(saveButton().props.disabled).toBe(true);
      await save();
      expect(onSubmit).not.toHaveBeenCalled();
    });

    test.each([
      ['DELIVERY_OUTSIDE_COVERAGE', 'Это место вне зоны доставки'],
      ['DELIVERY_ADDRESS_COORDINATES_INVALID', 'Не удалось определить это место'],
      ['ANYTHING_ELSE', 'Не удалось сохранить адрес'],
    ])('a save refused with %s stays open and says so', async (code, words) => {
      onSubmit.mockRejectedValue(Object.assign(new Error('server words'), { code }));
      await mount();
      type('street', 'Амира');
      await searched();
      pick(0);

      await save();

      expect(allText()).toContain(words);
      expect(allText()).not.toContain('server words');
      expect(onClose).not.toHaveBeenCalled();
    });

    test('a save that works closes the form', async () => {
      await mount();
      type('street', 'Амира');
      await searched();
      pick(0);
      await save();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('editing an address', () => {
    test('splits what it holds into the fields', async () => {
      await mount(SAVED);
      expect(fieldValue('street')).toBe('Навои');
      expect(fieldValue('house')).toBe('1');
      expect(fieldValue('city')).toBe('Ташкент');
    });

    test('with a point: shows it as set, searches nothing, and an unchanged save leaves it to the server', async () => {
      await mount(SAVED);
      expect(allText()).toContain('Сохранённая точка доставки');
      await searched();
      expect(searchAddresses).not.toHaveBeenCalled();

      await save();

      expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('lat');
    });

    test('with no point: searches for it straight away, so it can be chosen', async () => {
      await mount(NOT_LOCATED);
      await searched();

      expect(searchAddresses.mock.calls[0]![0]).toMatchObject({ street: 'Навои', house: '1', city: 'Ташкент' });
      pick(0);
      await save();
      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ lat: 39.654321, lng: 66.975432 });
    });

    test('moving the text unsets the point at once, which the server also does on saving', async () => {
      await mount(SAVED);

      type('street', 'Бабура');

      expect(allText()).not.toContain('Сохранённая точка доставки');
      expect(allText()).toContain('Использовать моё текущее местоположение');
      await save();
      expect(onSubmit.mock.calls[0]![0]).not.toHaveProperty('lat');
    });

    test('a point chosen after moving the text is the one saved', async () => {
      await mount(SAVED);
      type('street', 'Бабура');
      requestPosition.mockResolvedValue({ latitude: 41.29, longitude: 69.25 });

      await useLocation();
      expect(allText()).toContain('Указано ваше текущее местоположение');
      await save();

      expect(onSubmit.mock.calls[0]![0]).toMatchObject({ line1: 'Бабура 1', lat: 41.29, lng: 69.25 });
    });

    test('a name the buyer gave stays; one taken from the old street goes with it', async () => {
      await mount(SAVED);
      type('street', 'Бабура');
      await save();
      expect(onSubmit.mock.calls[0]![0].label).toBe('Дом');

      act(() => renderer.unmount());
      await mount({ ...SAVED, label: 'Навои 1' });
      type('street', 'Бабура');
      await save();
      expect(onSubmit.mock.calls[1]![0].label).toBe('Бабура 1');
    });

    test('naming a pin that had no words keeps the pin: it has not moved', async () => {
      await mount({ ...SAVED, label: 'Выбранная точка', line1: '', city: '' });

      type('street', 'Навои');
      type('city', 'Ташкент');
      await save();

      expect(onSubmit.mock.calls[0]![0]).toMatchObject({
        label: 'Навои',
        line1: 'Навои',
        lat: 41.311081,
        lng: 69.240562,
      });
    });

    test('a point chosen in one sitting does not survive into the next', async () => {
      await mount();
      requestPosition.mockResolvedValue({ latitude: 41.3, longitude: 69.2 });
      await useLocation();

      await act(async () => {
        renderer.update(ui(null, false));
      });
      await act(async () => {
        renderer.update(ui(null, true));
      });

      expect(allText()).not.toContain('Указано ваше текущее местоположение');
    });
  });
});
