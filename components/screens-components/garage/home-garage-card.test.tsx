/**
 * Explore's selected-vehicle banner (physical Android report): "Сменить" sat
 * small on the spec line beside the year. It now sits centred under the car
 * picture, level with "Найти запчасти" on its right, in the button label's
 * type, shrinking rather than wrapping where the slot is narrow.
 */
import React from 'react';
import { act, create, type ReactTestInstance } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const { host, screen } = vi.hoisted(() => ({
  host:
    (type: string) =>
    ({ children, ...p }: Record<string, unknown> & { children?: React.ReactNode }) =>
      React.createElement(type, p, children),
  screen: { width: 393 },
}));

vi.mock('react-native', () => ({
  Pressable: host('rn-pressable'),
  useWindowDimensions: () => ({ width: screen.width, height: 800, fontScale: 1 }),
}));
vi.mock('react-native-svg', () => ({
  default: host('svg'),
  Circle: host('svg-part'),
  Defs: host('svg-part'),
  Ellipse: host('svg-part'),
  LinearGradient: host('svg-part'),
  Path: host('svg-part'),
  RadialGradient: host('svg-part'),
  Rect: host('svg-part'),
  Stop: host('svg-part'),
}));
vi.mock('expo-image', () => ({ Image: host('image') }));
vi.mock('expo-router', () => ({ router: { navigate: () => {} } }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
vi.mock('lucide-react-native', () => ({ ArrowLeftRight: host('icon'), ImagePlus: host('icon') }));
vi.mock('@/assets/hero/corvette-c8-red.webp', () => ({ default: 1 }));
vi.mock('@/components/shared/app-button', () => ({ AppButton: host('button') }));
vi.mock('@/components/shared/app-text', () => ({ AppText: host('text') }));
vi.mock('@/components/shared/app-view', () => ({
  AppView: host('view'),
  AppPressableView: host('pressable'),
}));
vi.mock('@/components/screens-components/garage/vehicle-image-placeholder', () => ({
  default: host('car'),
}));
vi.mock('@/components/screens-components/garage/vehicle-generation-choice', () => ({
  default: () => null,
}));
vi.mock('@/contexts/theme.context', () => ({
  useThemeContext: () => ({ tokens: new Proxy({}, { get: (_t, k) => `#${String(k)}` }) }),
}));
vi.mock('@/contexts/active-vehicle.context', () => ({
  useActiveVehicle: () => ({
    isHydrating: false,
    currentActiveVehicle: {
      vehicleId: 'v1',
      fitment: {},
      vehicle: { id: 'v1', make: 'Chevrolet', model: 'Nexia', year: 2021, trim: 'R3' },
    },
  }),
}));
vi.mock('@/hooks/use-garage', () => ({ useGarage: () => ({ vehicles: [] }) }));
vi.mock('@/hooks/use-vehicle-image', () => ({ useVehicleImage: () => undefined }));
vi.mock('@/hooks/use-garage-foreground-refresh', () => ({ useGarageForegroundRefresh: () => {} }));
vi.mock('@/services/vehicle-images/resolver', () => ({ resolveVehicleImage: () => null }));
vi.mock('@/services/vehicle-images/vehicle-visual', () => ({
  chooseVehicleVisual: () => ({ kind: 'placeholder' }),
}));
vi.mock('@/utils/haptics', () => ({ triggerHaptic: () => {} }));

const { default: HomeGarageCard } = await import('./home-garage-card');
const { GarageHeroCard } = await import('./garage-add-hero');

function render(width: number) {
  screen.width = width;
  let root!: ReturnType<typeof create>;
  act(() => {
    root = create(<HomeGarageCard />);
  });
  const tree = root.root;
  const byType = (type: string) => (n: ReactTestInstance) => String(n.type) === type;
  const shopParts = tree
    .findAll(byType('button'))
    .find((n) => n.props.testID === 'home-garage-shop-parts')!;
  const change = tree
    .findAll(byType('pressable'))
    .find((n) => n.props.testID === 'home-garage-change-vehicle')!;
  const actionRow = tree
    .findAll(byType('view'))
    .find((n) => n.props.row && n.findAll(byType('button')).length === 1)!;
  const slot = tree
    .findAll(byType('view'))
    .find((n) => n.props.testID === 'home-garage-card-secondary-slot')!;
  const car = tree.findAll(byType('car'))[0];
  return { tree, shopParts, change, actionRow, slot, car, byType };
}

const PADDING = 16;

/** The nearest host `view` above a node, skipping the mock components between. */
function viewAbove(n: ReactTestInstance): ReactTestInstance {
  let p = n.parent;
  while (p && String(p.type) !== 'view') p = p.parent;
  return p!;
}

/** Horizontal centres in card coordinates (the card spans the page gutters). */
function centres(width: number) {
  const { slot, car } = render(width);
  const card = width - 32;
  const carRight = viewAbove(car).props.style.right as number;
  const carCentre = card - carRight - car.props.width / 2;
  const slotRightEdge = card - PADDING - slot.props.style.marginRight;
  return { carCentre, slotCentre: slotRightEdge - slot.props.style.width / 2, slotRightEdge, card };
}

describe('Explore vehicle banner actions', () => {
  test('"Сменить" is on the shop-parts line, to the button\'s right', () => {
    const { change, actionRow, slot, byType } = render(393);
    const controls = actionRow.children.filter(
      (c): c is ReactTestInstance => typeof c !== 'string',
    );
    expect(controls[0].findAll(byType('button'))[0].props.testID).toBe('home-garage-shop-parts');
    expect(controls[controls.length - 1].props.testID).toBe(slot.props.testID);
    expect(slot.findAll(byType('pressable'))[0].props.testID).toBe(change.props.testID);
    expect(actionRow.props.align).toBe('center');
  });

  test.each([393, 360])('at %ipt its slot is centred under the car, inside the card', (width) => {
    const { carCentre, slotCentre, slotRightEdge, card } = centres(width);
    expect(Math.abs(slotCentre - carCentre)).toBeLessThan(0.5);
    expect(slotRightEdge).toBeLessThanOrEqual(card - PADDING / 2);
  });

  test('it is no longer on the spec line beside the year', () => {
    const { tree, byType } = render(393);
    const spec = tree.findAll(byType('text')).find((n) => n.props.children === '2021 · R3')!;
    // The nearest laid-out container, not the AppText mock wrapping it.
    let line = spec.parent;
    while (line && String(line.type) !== 'view') line = line.parent;
    expect(line?.findAll(byType('pressable'))).toHaveLength(0);
  });

  test('its label is the lg button label type, one line, shrinking to fit', () => {
    const { change, slot, byType } = render(393);
    const label = change.findAll(byType('text'))[0];
    expect(label.props.children).toBe('explore.changeVehicle');
    expect(label.props.textVariant).toBe('button');
    expect(label.props.weight).toBe('semibold');
    expect(label.props.numberOfLines).toBe(1);
    expect(label.props.adjustsFontSizeToFit).toBe(true);
    expect('lineHeight' in label.props.style).toBe(true);
    expect(label.props.style.lineHeight).toBeUndefined();
    expect(label.props.style.flexShrink).toBe(1);
    expect(change.props.style.minHeight).toBe(48);
    expect(change.props.style.maxWidth).toBe('100%');
    expect(slot.props.style.flexShrink).toBe(1);
  });

  test('the button keeps its own width beside it, even on a 360pt phone', () => {
    expect(render(360).shopParts.props.fullWidth).toBe(false);
    expect(render(393).shopParts.props.fullWidth).toBe(false);
  });
});

describe('approved Garage vehicle image surface', () => {
  test('approved cutouts stand on the card with no white box behind them', () => {
    const props = {
      testID: 'garage-test',
      action: { testID: 'garage-action', title: 'Parts', onPress: () => {} },
      children: <></>,
    };
    let imageRoot!: ReturnType<typeof create>;
    act(() => { imageRoot = create(<GarageHeroCard {...props} visual={{ kind: 'image', source: 1 as never }} />); });
    expect(imageRoot.root.findAll((node) => node.props.style?.backgroundColor === '#fff')).toHaveLength(0);
    act(() => { imageRoot.unmount(); });
  });

  test('no approved image: the placeholder car, with the status in the copy column', () => {
    const { tree: root } = render(393);
    expect(root.findAll((node) => String(node.type) === 'car')).toHaveLength(1);
    const status = root.find((node) => node.props.testID === 'home-garage-image-status');
    expect(status.findByType('text' as never).props.children).toBe('vehicleImage.unavailable');
    // Not inside the car slot: no absolute positioning on the status row.
    expect(status.props.style).toBeUndefined();
  });
});
