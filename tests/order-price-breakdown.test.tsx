/** Unit presentation checks only; synthetic values, no API/account writes. */
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, test, vi } from 'vitest';
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/contexts/theme.context', () => ({ useThemeContext: () => ({ tokens: { text: 'text' } }) }));
vi.mock('@/components/shared/app-view', () => ({ AppView: ({ children, ...props }: any) => <section {...props}>{children}</section> }));
vi.mock('@/components/shared/app-text', () => ({ AppText: ({ children, ...props }: any) => <span {...props}>{children}</span> }));
vi.mock('@/components/shared/app-price', () => ({ AppPrice: ({ value }: { value: string }) => <span data-price={value}>{value || '—'}</span> }));
import { OrderLinePrice, OrderPriceBreakdown } from '@/components/screens-components/orders/order-price-breakdown';
import { getOrderPricing } from '@/services/order-pricing';
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
async function mount(element: React.ReactElement) { let tree!: ReactTestRenderer; await act(async () => { tree = create(element); }); return tree; }
const complete = { subtotal_uzs: 100000, delivery_uzs: 25000, service_fee_uzs: 5000, discount_uzs: 0, total_uzs: 130000, items: [{ qty: 2, price_uzs: 50000, line_total_uzs: 100000 }] };
test('complete server breakdown renders fees, explicit zero discount and unchanged total', async () => {
  const tree = await mount(<OrderPriceBreakdown pricing={getOrderPricing(complete)} />);
  for (const key of ['subtotal', 'delivery', 'serviceFee', 'discount', 'total']) expect(tree.root.findAllByProps({ testID: `order-amount-${key}` }).length).toBeGreaterThan(0);
  expect(tree.root.findAll((node) => node.props['data-price'] === "0 UZS")).toHaveLength(1);
  expect(JSON.stringify(tree.toJSON())).toContain("130\u00A0000 UZS");
  expect(JSON.stringify(tree.toJSON())).not.toContain('breakdownUnavailable');
  await act(async () => tree.unmount());
});
test('missing fee fields do not label the unexplained difference as delivery', async () => {
  const tree = await mount(<OrderPriceBreakdown pricing={getOrderPricing({ subtotal_uzs: 100000, total_uzs: 130000 })} />);
  expect(tree.root.findAllByProps({ testID: 'order-amount-delivery' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'order-amount-serviceFee' })).toHaveLength(0);
  expect(tree.root.findAllByProps({ testID: 'order-amount-discount' })).toHaveLength(0);
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain('trackOrder.breakdownUnavailable');
  expect(tree.root.findAll((node) => node.props['data-price'] === "30\u00A0000 UZS")).toHaveLength(0);
  expect(output).toContain("130\u00A0000 UZS");
  await act(async () => tree.unmount());
});
test('inconsistent server sums are disclosed without replacing the total', async () => {
  const tree = await mount(<OrderPriceBreakdown pricing={getOrderPricing({ ...complete, total_uzs: 140000 })} />);
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain('trackOrder.amountsMismatch');
  expect(output).toContain("140\u00A0000 UZS");
  expect(output).not.toContain("130\u00A0000 UZS");
  await act(async () => tree.unmount());
});
test('line display prefers the server line total and labels a unit-only fallback', async () => {
  const tree = await mount(<OrderLinePrice line={{ quantity: 2, unitPrice: 50000, lineTotal: 100000 }} />);
  expect(JSON.stringify(tree.toJSON())).toContain("100\u00A0000 UZS");
  expect(JSON.stringify(tree.toJSON())).not.toContain("50\u00A0000 UZS");
  await act(async () => tree.update(<OrderLinePrice line={{ quantity: 2, unitPrice: 50000, lineTotal: null }} />));
  expect(JSON.stringify(tree.toJSON())).toContain('trackOrder.unitPrice');
  expect(JSON.stringify(tree.toJSON())).toContain("50\u00A0000 UZS");
  await act(async () => tree.update(<OrderLinePrice line={{ quantity: null, unitPrice: null, lineTotal: null }} />));
  expect(JSON.stringify(tree.toJSON())).toContain('—');
  expect(JSON.stringify(tree.toJSON())).not.toContain("0 UZS");
  await act(async () => tree.unmount());
});
