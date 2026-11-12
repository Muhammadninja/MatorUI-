/**
 * The delivery map, through the real hooks and React Query, with only the native map and the
 * transport standing in. What it guards:
 *   • the point under the marker is the destination, exactly, and nothing else is;
 *   • nothing is selected until the buyer chooses, so the camera cannot become an address;
 *   • GPS and search only move the map, are optional, and can fail without stopping it;
 *   • moving the map asks nothing of the backend;
 *   • a late answer to an old search cannot replace the current one.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, map, transport, requestPosition, availability } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  map: { animateToRegion: vi.fn(), props: null as null | Record<string, any> },
  transport: {
    searchAddresses: vi.fn(),
    getDeliveryCoverage: vi.fn(),
    describePoint: vi.fn(),
  },
  requestPosition: vi.fn(),
  availability: { map: true },
}));

vi.mock('react-native', () => ({ Modal: host('modal'), ScrollView: host('scroll'), Platform: { OS: 'ios' } }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('lucide-react-native', () => ({
  ArrowLeft: () => null,
  LocateFixed: () => null,
  MapPin: () => null,
}));
vi.mock('@/components/shared/app-map', async () => {
  const { forwardRef, useImperativeHandle } = await vi.importActual<typeof import('react')>('react');
  return {
    default: forwardRef(function AppMap(props: Record<string, any>, ref) {
      useImperativeHandle(ref, () => ({ animateToRegion: map.animateToRegion }));
      map.props = props;
      return null;
    }),
  };
});
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
  useAppLocation: () => ({ requestAndGetPosition: requestPosition, isLoading: false }),
}));
vi.mock('@/services/orders-api', () => ({ ordersTransport: transport }));
vi.mock('@/services/delivery-map', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/delivery-map')>();
  return { ...actual, isMapAvailable: () => availability.map };
});

import DeliveryLocationPicker from '@/components/screens-components/account/delivery-location-picker';
import i18n from '@/services/i18n';
import type { DeliveryPoint } from '@/services/orders-service';

const SAVED: DeliveryPoint = { lat: 41.311081234, lng: 69.240562987 };
const CITY = 0.05;

/** The map as a buyer leaves it, once a move has ended. */
const region = (lat: number, lng: number, delta = CITY) => ({
  latitude: lat,
  longitude: lng,
  latitudeDelta: delta,
  longitudeDelta: delta,
});
const MATCH = {
  id: '1',
  title: 'Амира Темура 12',
  subtitle: 'Юнусабад',
  city: 'Ташкент',
  district: null,
  street: 'Амира Темура',
  house_number: '12',
  houseNumber: '12',
  lat: 39.654321,
  lng: 66.975432,
};

const settle = async () => {
  for (let i = 0; i < 4; i += 1) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }
};
const debounced = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
  await settle();
};

describe('DeliveryLocationPicker', () => {
  let renderer: ReactTestRenderer;
  const onConfirm = vi.fn();
  const onCancel = vi.fn();

  const hostNode = (id: string) =>
    renderer.root.find((node) => node.props.testID === id && typeof node.type === 'string');
  const exists = (id: string) =>
    renderer.root.findAll((node) => node.props.testID === id && typeof node.type === 'string').length > 0;
  const allText = () =>
    renderer.root
      .findAll((node) => node.type === 'text')
      .flatMap((node) => node.children.filter((c): c is string => typeof c === 'string'))
      .join(' | ');
  const confirmButton = () => hostNode('delivery-map-confirm');
  const confirm = () =>
    act(() => {
      confirmButton().props.onPress();
    });
  const tap = (latitude: number, longitude: number) =>
    act(() => {
      map.props!.onPress({ nativeEvent: { coordinate: { latitude, longitude } } });
    });
  const mapMoved = (lat: number, lng: number, delta?: number) =>
    act(() => {
      map.props!.onRegionChangeComplete(region(lat, lng, delta));
    });
  const type = (value: string) =>
    act(() => {
      hostNode('delivery-map-search').props.onChangeText(value);
    });
  const locate = () =>
    act(async () => {
      await hostNode('delivery-map-locate').props.onPress();
    });
  const mount = async (initialPoint: DeliveryPoint | null = null) => {
    const client = new QueryClient({ defaultOptions: { queries: { gcTime: 0 } } });
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={client}>
          <DeliveryLocationPicker visible initialPoint={initialPoint} onCancel={onCancel} onConfirm={onConfirm} />
        </QueryClientProvider>,
      );
    });
    await settle();
  };

  beforeAll(async () => {
    await i18n.changeLanguage('ru');
  });
  beforeEach(() => {
    vi.clearAllMocks();
    availability.map = true;
    transport.getDeliveryCoverage.mockResolvedValue({ configured: false, bounds: null, polygons: null });
    transport.searchAddresses.mockResolvedValue({ items: [MATCH], attribution: 'credit' });
  });
  afterEach(() => act(() => renderer.unmount()));

  test('draws nothing until it is opened', async () => {
    await act(async () => {
      renderer = create(
        <QueryClientProvider client={new QueryClient()}>
          <DeliveryLocationPicker visible={false} initialPoint={null} onCancel={onCancel} onConfirm={onConfirm} />
        </QueryClientProvider>,
      );
    });
    expect(map.props).toBeDefined();
    expect(exists('delivery-location-picker')).toBe(false);
    expect(transport.getDeliveryCoverage).not.toHaveBeenCalled();
  });

  describe('opening', () => {
    test('on a saved point: at that point, ready to confirm, exactly as it was', async () => {
      await mount(SAVED);

      expect(map.props!.initialRegion).toMatchObject({ latitude: SAVED.lat, longitude: SAVED.lng });
      expect(confirmButton().props.disabled).toBe(false);
      confirm();
      expect(onConfirm).toHaveBeenCalledWith(SAVED, null);
    });

    test('with nothing saved: selects nothing, so the camera cannot become an address', async () => {
      await mount();

      expect(confirmButton().props.disabled).toBe(true);
      confirm();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    test('the map reporting where it starts is not the buyer choosing', async () => {
      await mount();
      const { latitude, longitude, latitudeDelta } = map.props!.initialRegion;

      mapMoved(latitude, longitude, latitudeDelta);

      expect(confirmButton().props.disabled).toBe(true);
    });

    test('goes to the delivery area when one is configured, still selecting nothing', async () => {
      transport.getDeliveryCoverage.mockResolvedValue({
        configured: true,
        bounds: { minLat: 41.2, minLng: 69.1, maxLat: 41.4, maxLng: 69.4 },
      });
      await mount();

      expect(map.animateToRegion).toHaveBeenCalledTimes(1);
      expect(map.animateToRegion.mock.calls[0]![0]).toMatchObject({
        latitude: expect.closeTo(41.3),
        longitude: expect.closeTo(69.25),
      });
      expect(confirmButton().props.disabled).toBe(true);
    });

    test('even when the area is small enough to choose from, the camera is not a choice', async () => {
      transport.getDeliveryCoverage.mockResolvedValue({
        configured: true,
        bounds: { minLat: 41.3, minLng: 69.2, maxLat: 41.34, maxLng: 69.24 },
      });
      await mount();
      const [camera] = map.animateToRegion.mock.lastCall!;

      mapMoved(camera.latitude, camera.longitude, camera.latitudeDelta);

      expect(camera.latitudeDelta).toBeLessThanOrEqual(0.1);
      expect(confirmButton().props.disabled).toBe(true);
      confirm();
      expect(onConfirm).not.toHaveBeenCalled();

      // Only once the buyer moves the map is there a place to confirm.
      mapMoved(camera.latitude + 0.01, camera.longitude, camera.latitudeDelta);
      expect(confirmButton().props.disabled).toBe(false);
    });

    test('works with no answer about the area', async () => {
      transport.getDeliveryCoverage.mockRejectedValue(new Error('down'));
      await mount();

      tap(41.3, 69.2);

      expect(confirmButton().props.disabled).toBe(false);
    });

    test('reads no location by itself', async () => {
      await mount();
      expect(requestPosition).not.toHaveBeenCalled();
      expect(map.props!.showsUserLocation).toBeFalsy();
    });
  });

  describe('choosing', () => {
    test('moving the map chooses the point now under the marker', async () => {
      await mount();

      mapMoved(41.3, 69.2);
      confirm();

      expect(onConfirm).toHaveBeenCalledWith({ lat: 41.3, lng: 69.2 }, null);
    });

    test('tapping anywhere chooses exactly that place, and brings it under the marker', async () => {
      await mount();

      tap(41.311081234, 69.240562987);

      expect(map.animateToRegion.mock.lastCall![0]).toMatchObject({
        latitude: 41.311081234,
        longitude: 69.240562987,
      });
      confirm();
      expect(onConfirm).toHaveBeenCalledWith({ lat: 41.311081234, lng: 69.240562987 }, null);
    });

    test('a tap stays exact when the map settles a hair away from it', async () => {
      await mount();
      tap(41.311081234, 69.240562987);

      mapMoved(41.31108125, 69.24056301, 0.02);
      confirm();

      expect(onConfirm).toHaveBeenCalledWith({ lat: 41.311081234, lng: 69.240562987 }, null);
    });

    test('a move the buyer cuts short counts where they left it, not where it was heading', async () => {
      await mount();
      tap(41.3, 69.2);

      // They drag straight away: the map never reaches the tap, and says nothing more.
      mapMoved(41.35, 69.25);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 850));
      });

      confirm();
      expect(onConfirm).toHaveBeenCalledWith({ lat: 41.35, lng: 69.25 }, null);
    });

    test('the buyer can keep moving it: the last place counts', async () => {
      await mount();
      tap(41.3, 69.2);
      mapMoved(41.3, 69.2);

      mapMoved(41.35, 69.25);
      confirm();

      expect(onConfirm).toHaveBeenCalledWith({ lat: 41.35, lng: 69.25 }, null);
    });

    test('a tap on a zoomed-out map zooms in, and keeps a closer zoom as it is', async () => {
      await mount();

      tap(41.3, 69.2);
      expect(map.animateToRegion.mock.lastCall![0].latitudeDelta).toBeLessThanOrEqual(0.02);

      mapMoved(41.3, 69.2, 0.004);
      tap(41.31, 69.21);
      expect(map.animateToRegion.mock.lastCall![0].latitudeDelta).toBe(0.004);
    });

    test('a point cannot be confirmed from too far out to see where it is', async () => {
      await mount();

      mapMoved(40, 65, 5);

      expect(confirmButton().props.disabled).toBe(true);
      expect(allText()).toContain('Приблизьте карту');

      mapMoved(40, 65, 0.05);

      expect(confirmButton().props.disabled).toBe(false);
      expect(allText()).not.toContain('Приблизьте карту');
    });

    test('moving the map asks nothing of the backend', async () => {
      await mount();
      transport.getDeliveryCoverage.mockClear();

      for (let step = 0; step < 20; step += 1) mapMoved(41.3 + step / 1000, 69.2);
      await debounced();

      expect(transport.searchAddresses).not.toHaveBeenCalled();
      expect(transport.describePoint).not.toHaveBeenCalled();
      expect(transport.getDeliveryCoverage).not.toHaveBeenCalled();
    });

    test('backing out chooses nothing', async () => {
      await mount(SAVED);
      mapMoved(41.35, 69.25);

      act(() => {
        hostNode('delivery-map-back').props.onPress();
      });

      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('with the delivery area known', () => {
    // A triangle, so a point can be inside the box and outside the area.
    const AREA = [
      [
        [
          [69.1, 41.2],
          [69.5, 41.2],
          [69.1, 41.5],
          [69.1, 41.2],
        ],
      ],
    ];
    beforeEach(() => {
      transport.getDeliveryCoverage.mockResolvedValue({
        configured: true,
        bounds: { minLat: 41.2, minLng: 69.1, maxLat: 41.5, maxLng: 69.5 },
        polygons: AREA,
      });
    });

    test('a point inside can be confirmed', async () => {
      await mount();
      tap(41.25, 69.2);

      expect(confirmButton().props.disabled).toBe(false);
      expect(exists('delivery-map-outside')).toBe(false);
      confirm();
      expect(onConfirm).toHaveBeenCalledWith({ lat: 41.25, lng: 69.2 }, null);
    });

    test('a point outside says so at once, and cannot be confirmed', async () => {
      await mount();
      tap(41.45, 69.45); // in the box, outside the triangle

      expect(allText()).toContain('Это место вне зоны доставки');
      expect(confirmButton().props.disabled).toBe(true);
      confirm();
      expect(onConfirm).not.toHaveBeenCalled();
    });

    test('moving back inside clears that', async () => {
      await mount();
      tap(41.45, 69.45);
      mapMoved(41.45, 69.45, 0.02);
      expect(confirmButton().props.disabled).toBe(true);

      mapMoved(41.25, 69.2);

      expect(exists('delivery-map-outside')).toBe(false);
      expect(confirmButton().props.disabled).toBe(false);
    });

    test('a search result or GPS outside it is held to the same area', async () => {
      await mount();
      requestPosition.mockResolvedValue({ latitude: 41.47, longitude: 69.58 });

      await locate();

      expect(confirmButton().props.disabled).toBe(true);
      expect(allText()).toContain('Это место вне зоны доставки');
    });

    test('a saved point now outside it must be moved before confirming', async () => {
      await mount({ lat: 41.45, lng: 69.45 });
      expect(confirmButton().props.disabled).toBe(true);
    });

    test('checking asks nothing of the backend', async () => {
      await mount();
      tap(41.45, 69.45);
      mapMoved(41.45, 69.45, 0.02);
      mapMoved(41.25, 69.2);
      expect(transport.describePoint).not.toHaveBeenCalled();
    });
  });

  test('with the area unknown, the choice is left to the backend', async () => {
    transport.getDeliveryCoverage.mockRejectedValue(new Error('down'));
    await mount();

    tap(55.75, 37.61);

    expect(exists('delivery-map-outside')).toBe(false);
    expect(confirmButton().props.disabled).toBe(false);
  });

  describe('using GPS, which is optional', () => {
    test('centres the map on the buyer when asked, and that is then the point', async () => {
      await mount();
      requestPosition.mockResolvedValue({ latitude: 41.3, longitude: 69.2 });

      await locate();

      expect(requestPosition).toHaveBeenCalledTimes(1);
      expect(map.animateToRegion.mock.lastCall![0]).toMatchObject({ latitude: 41.3, longitude: 69.2 });
      confirm();
      expect(onConfirm).toHaveBeenCalledWith({ lat: 41.3, lng: 69.2 }, null);
    });

    test('does not hold the buyer there: another place can be chosen, however far', async () => {
      await mount();
      requestPosition.mockResolvedValue({ latitude: 41.3, longitude: 69.2 });
      await locate();
      mapMoved(41.3, 69.2);

      tap(39.65, 66.96);
      confirm();

      expect(onConfirm).toHaveBeenCalledWith({ lat: 39.65, lng: 66.96 }, null);
    });

    test('failing says so, and the map goes on working', async () => {
      await mount();
      requestPosition.mockResolvedValue(null);

      await locate();

      expect(allText()).toContain('Не удалось определить местоположение');
      tap(41.3, 69.2);
      expect(confirmButton().props.disabled).toBe(false);
    });
  });

  describe('searching, which is optional', () => {
    test('moves the marker to the match the buyer picks, exactly', async () => {
      await mount();
      type('Амира');
      await debounced();

      act(() => {
        hostNode('address-suggestion-0').props.onPress();
      });

      expect(map.animateToRegion.mock.lastCall![0]).toMatchObject({
        latitude: MATCH.lat,
        longitude: MATCH.lng,
      });
      confirm();
      // The found place goes with the point, so the address can show its name.
      expect(onConfirm).toHaveBeenCalledWith({ lat: MATCH.lat, lng: MATCH.lng }, MATCH);
      expect(allText()).toContain('Амира Темура 12');
    });

    test('moving off a found place leaves its name behind', async () => {
      await mount();
      type('Амира');
      await debounced();
      act(() => {
        hostNode('address-suggestion-0').props.onPress();
      });
      act(() => {
        map.props!.onPress({ nativeEvent: { coordinate: { latitude: 41.3, longitude: 69.2 } } });
      });
      confirm();
      expect(onConfirm).toHaveBeenCalledWith({ lat: 41.3, lng: 69.2 }, null);
    });

    test('shows the credit the data needs', async () => {
      await mount();
      type('Амира');
      await debounced();
      expect(allText()).toContain('credit');
    });

    test('debounces typing, and sends the text and no more', async () => {
      await mount();

      type('Ами');
      type('Амир');
      type('Амира');
      await debounced();

      expect(transport.searchAddresses).toHaveBeenCalledTimes(1);
      expect(transport.searchAddresses.mock.calls[0]![0]).toEqual({
        street: 'Амира',
        lang: 'ru',
        mode: 'autocomplete',
      });
    });

    test('tells it where the map is looking, roughly, once it is looking somewhere', async () => {
      await mount();
      tap(41.311081, 69.240562);

      type('Амира');
      await debounced();

      expect(transport.searchAddresses.mock.calls[0]![0]).toMatchObject({
        nearLat: 41.31,
        nearLng: 69.24,
      });
    });

    test('moving the map does not search again', async () => {
      await mount();
      tap(41.3, 69.2);
      type('Амира');
      await debounced();
      expect(transport.searchAddresses).toHaveBeenCalledTimes(1);

      mapMoved(41.5, 69.5);
      await debounced();

      expect(transport.searchAddresses).toHaveBeenCalledTimes(1);
    });

    test('submitting searches at once, as a full search', async () => {
      await mount();
      type('Амира');
      act(() => {
        hostNode('delivery-map-search').props.onSubmitEditing();
      });
      await settle();

      expect(transport.searchAddresses.mock.lastCall![0]).toMatchObject({
        street: 'Амира',
        mode: 'search',
      });
    });

    test('matches for what was typed before go as soon as the text changes', async () => {
      await mount();
      type('Амира');
      await debounced();
      expect(allText()).toContain('Амира Темура 12');

      type('Навои');

      expect(allText()).not.toContain('Амира Темура 12');
      expect(allText()).toContain('Ищем адрес');
    });

    test('a late answer to an old search does not replace the current one', async () => {
      const answers: Record<string, (value: unknown) => void> = {};
      transport.searchAddresses.mockImplementation(
        ({ street }: { street: string }) =>
          new Promise((resolve) => {
            answers[street] = resolve;
          }),
      );
      await mount();

      type('Навои');
      await debounced();
      type('Амира');
      await debounced();

      await act(async () => {
        answers['Амира']!({ items: [{ ...MATCH, title: 'Амира Темура 12' }], attribution: null });
      });
      await settle();
      await act(async () => {
        answers['Навои']!({ items: [{ ...MATCH, id: '9', title: 'Навои 9' }], attribution: null });
      });
      await settle();

      expect(allText()).toContain('Амира Темура 12');
      expect(allText()).not.toContain('Навои 9');
    });

    test('finding nothing says so, and the map goes on working', async () => {
      transport.searchAddresses.mockResolvedValue({ items: [], attribution: null });
      await mount();
      type('Несуществующая');
      await debounced();

      expect(allText()).toContain('Ничего не найдено');
      tap(41.3, 69.2);
      expect(confirmButton().props.disabled).toBe(false);
    });

    test('search being down says so, and the map goes on working', async () => {
      transport.searchAddresses.mockRejectedValue(new Error('down'));
      await mount();
      type('Амира');
      await debounced();

      expect(allText()).toContain('Поиск адреса сейчас недоступен');
      tap(41.3, 69.2);
      confirm();
      expect(onConfirm).toHaveBeenCalledWith({ lat: 41.3, lng: 69.2 }, null);
    });
  });

  test('says nothing about a route, a distance or a time', async () => {
    await mount(SAVED);
    expect(allText()).not.toMatch(/\bкм\b|\bkm\b|\bмин\b|маршрут|route/i);
    expect(allText()).not.toMatch(/41\.31|69\.24/);
  });

  describe('on an Android build with no map key', () => {
    beforeEach(() => {
      availability.map = false;
      map.props = null;
    });

    test('does not draw the map, which would crash, and says why', async () => {
      await mount();

      expect(map.props).toBeNull();
      expect(allText()).toContain('Карта на этом устройстве недоступна');
    });

    test('search can still choose the place', async () => {
      await mount();
      type('Амира');
      await debounced();

      act(() => {
        hostNode('address-suggestion-0').props.onPress();
      });
      confirm();

      expect(onConfirm).toHaveBeenCalledWith({ lat: MATCH.lat, lng: MATCH.lng }, MATCH);
    });
  });
});
