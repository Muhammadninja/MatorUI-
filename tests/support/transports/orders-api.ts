// Test-only implementations. Never imported by application code.
import { STANDARD_DELIVERY_UZS } from '@/services/cart-math';
import type {
  Address,
  AddressInput,
  CreateOrderInput,
  CreateOrderResult,
  OrderDetail,
  OrderListPage,
  OrderListRow,
  OrderListStatus,
  OrderStatus,
  PaymentMethod,
  PaymentMethodInput,
  ShippingOption,
} from '@/services/orders-service';
import { shouldUseHttpTransport } from '@/config/api';
import { apiClient, ApiError } from '@/services/api-client';
import { debugLog } from '@/services/debug-log';

import type { OrderListRequest, ShippingQuoteRequest, OrdersTransport } from "@/services/orders-api";

// ── Mock transport ───────────────────────────────────────────────────

const MOCK_LATENCY_MS = 250;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    if (signal) {
      const onAbort = () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      };
      if (signal.aborted) onAbort();
      else signal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

const SEED_ADDRESSES: Address[] = [
  {
    id: 'addr_home',
    label: 'Home',
    name: 'Alex Marino',
    line1: '128 Marrakesh Rd, Suite 4',
    city: 'Brooklyn, NY 11211',
    isDefault: true,
  },
  {
    id: 'addr_shop',
    label: 'Shop',
    name: 'Alex Marino',
    line1: '2210 W Industrial Blvd',
    city: 'Long Island City, NY 11101',
    isDefault: false,
  },
];

const SEED_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm_mc_4242', brand: 'Mastercard', last4: '4242', exp: '09/27', isDefault: true },
  { id: 'pm_visa_1881', brand: 'Visa', last4: '1881', exp: '03/26', isDefault: false },
];

// Mirrors the real backend quote (`shipping.service.ts`): pickup is free,
// courier is the flat `DELIVERY_COURIER_UZS` fee (default 25,000).
const BASE_SHIPPING_OPTIONS: ShippingOption[] = [
  { key: 'pickup', label: 'Pickup', eta: 'Today', price: 0 },
  { key: 'courier', label: 'Courier', eta: '1-3 days', price: STANDARD_DELIVERY_UZS },
];

function detailFor(row: { id: string; total: string }, statusKey: 'in_transit' | 'delivered' | 'cancelled'): OrderDetail {
  const isInTransit = statusKey === 'in_transit';
  return {
    id: row.id,
    status: isInTransit ? 'out_for_delivery' : statusKey === 'delivered' ? 'delivered' : 'cancelled',
    statusLabel: isInTransit ? 'Out for delivery' : statusKey === 'delivered' ? 'Delivered' : 'Cancelled',
    etaWindow: isInTransit ? '14:30 - 15:00' : 'Delivered',
    placedAt: 'Jun 4, 2026',
    currentStepIndex: isInTransit ? 3 : statusKey === 'delivered' ? 4 : 0,
    steps: [
      { key: 'placed', label: 'Order placed', caption: 'Tue · 9:42 AM' },
      { key: 'packed', label: 'Packed', caption: 'Tue · 4:11 PM' },
      { key: 'shipped', label: 'Shipped', caption: 'Wed · 7:28 AM' },
      { key: 'out_for_delivery', label: 'Out for delivery', caption: 'Today · 8:15 AM' },
      { key: 'delivered', label: 'Delivered', caption: isInTransit ? 'ETA 14:30 - 15:00' : 'Today · 14:42' },
    ],
    destination: SEED_ADDRESSES[0]!,
    courier: isInTransit
      ? {
          name: 'Marcus L.',
          company: 'Speedline Express',
          vehicle: 'Ford Transit · 8KJ-2491',
          rating: 4.9,
        }
      : null,
    items: [
      { id: 'p1', title: 'Turbo Wheel Set', quantity: 1, price: '$1,240' },
      { id: 'p2', title: 'Street Brake Pack', quantity: 1, price: '$760' },
    ],
    totalLabel: row.total,
  };
}

/** Optional seed data for the mock. The app constructs `new MockOrdersTransport()`
 *  (all-empty) so screens render their real empty states; tests pass `MOCK_SEED`
 *  to exercise the account-collection read paths. Orders themselves are no longer
 *  seeded — real orders come from the HTTP transport (`GET /v1/orders`). */
export type MockOrdersSeed = {
  orders?: OrderListPage;
  details?: Record<string, OrderDetail>;
  addresses?: Address[];
  paymentMethods?: PaymentMethod[];
};

/** Account-collection fixture set — for tests only (orders are not seeded). */
export const MOCK_SEED: MockOrdersSeed = {
  addresses: SEED_ADDRESSES,
  paymentMethods: SEED_PAYMENT_METHODS,
};

export class MockOrdersTransport implements OrdersTransport {
  private orders: OrderListPage;
  private details: Record<string, OrderDetail>;
  // Instance copies so CRUD mutations don't leak into the module seeds
  // (mirrors how `orders`/`details` are cloned above).
  private addresses: Address[];
  private paymentMethods: PaymentMethod[];

  constructor(seed?: MockOrdersSeed) {
    // Default: start with NO orders / addresses / payment methods — screens show
    // their real empty states instead of mock data. Real data comes from the HTTP
    // transport (GET /v1/orders, /v1/account/*) when the `orders` domain is
    // enabled. Tests pass `MOCK_SEED` to populate the read paths.
    this.orders = seed?.orders
      ? { ...seed.orders, items: seed.orders.items.map((o) => ({ ...o })) }
      : { page: 1, pageSize: 20, total: 0, items: [] };
    this.details = { ...(seed?.details ?? {}) };
    this.addresses = seed?.addresses ? seed.addresses.map((a) => ({ ...a })) : [];
    this.paymentMethods = seed?.paymentMethods ? seed.paymentMethods.map((p) => ({ ...p })) : [];
  }

  async listOrders(
    request: OrderListRequest,
    signal?: AbortSignal,
  ): Promise<OrderListPage> {
    await delay(MOCK_LATENCY_MS, signal);
    const filtered = request.status
      ? this.orders.items.filter((o) => o.status === request.status)
      : this.orders.items;
    const page = request.page ?? 1;
    const pageSize = request.pageSize ?? this.orders.pageSize;
    const start = (page - 1) * pageSize;
    return {
      page,
      pageSize,
      total: filtered.length,
      items: filtered.slice(start, start + pageSize),
    };
  }

  async getOrder(orderId: string, signal?: AbortSignal): Promise<OrderDetail | null> {
    await delay(MOCK_LATENCY_MS, signal);
    return this.details[orderId] ?? null;
  }

  async createOrder(
    input: CreateOrderInput,
    _signal?: AbortSignal,
  ): Promise<CreateOrderResult> {
    await delay(MOCK_LATENCY_MS);
    if (input.items.length === 0) {
      throw new Error('Cart is empty');
    }
    const orderId = `M-${Math.floor(40000 + Math.random() * 60000)}`;
    const shipping = BASE_SHIPPING_OPTIONS.find((o) => o.key === input.shippingOptionKey);
    const eta = shipping?.eta ?? '1-3 days';
    // Real server calculates this authoritatively; the mock echoes the
    // client's optimistic grand-total hint so the just-placed order's
    // confirmation + track screens show a real total instead of a blank.
    const totalLabel = input.totalLabel ?? '$—.—';
    // Seed a new detail row so a subsequent track-order fetch resolves.
    this.details[orderId] = {
      ...detailFor({ id: orderId, total: totalLabel }, 'in_transit'),
      status: 'placed',
      statusLabel: 'Processing',
      currentStepIndex: 0,
    };
    return { orderId, eta, totalLabel };
  }

  async listAddresses(signal?: AbortSignal): Promise<Address[]> {
    await delay(MOCK_LATENCY_MS, signal);
    return this.addresses.map((a) => ({ ...a }));
  }

  async createAddress(input: AddressInput): Promise<Address> {
    await delay(MOCK_LATENCY_MS);
    // First address becomes the default; otherwise defer to setDefault.
    const isDefault = this.addresses.length === 0;
    const created: Address = {
      id: `addr_${Date.now().toString(36)}`,
      ...input,
      isDefault,
    };
    this.addresses.push(created);
    return { ...created };
  }

  async updateAddress(id: string, input: AddressInput): Promise<Address> {
    await delay(MOCK_LATENCY_MS);
    const idx = this.addresses.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('Address not found');
    const updated: Address = { ...this.addresses[idx]!, ...input };
    this.addresses[idx] = updated;
    return { ...updated };
  }

  async removeAddress(id: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    const removed = this.addresses.find((a) => a.id === id);
    this.addresses = this.addresses.filter((a) => a.id !== id);
    // Removing the default promotes the first remaining address.
    if (removed?.isDefault && this.addresses.length > 0) {
      this.addresses[0] = { ...this.addresses[0]!, isDefault: true };
    }
  }

  async setDefaultAddress(id: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    // Enforce a single default across the collection.
    this.addresses = this.addresses.map((a) => ({ ...a, isDefault: a.id === id }));
  }

  async listPaymentMethods(signal?: AbortSignal): Promise<PaymentMethod[]> {
    await delay(MOCK_LATENCY_MS, signal);
    return this.paymentMethods.map((p) => ({ ...p }));
  }

  async createPaymentMethod(input: PaymentMethodInput): Promise<PaymentMethod> {
    await delay(MOCK_LATENCY_MS);
    const isDefault = this.paymentMethods.length === 0;
    const created: PaymentMethod = {
      id: `pm_${Date.now().toString(36)}`,
      ...input,
      isDefault,
    };
    this.paymentMethods.push(created);
    return { ...created };
  }

  async updatePaymentMethod(id: string, input: PaymentMethodInput): Promise<PaymentMethod> {
    await delay(MOCK_LATENCY_MS);
    const idx = this.paymentMethods.findIndex((p) => p.id === id);
    if (idx === -1) throw new Error('Payment method not found');
    const updated: PaymentMethod = { ...this.paymentMethods[idx]!, ...input };
    this.paymentMethods[idx] = updated;
    return { ...updated };
  }

  async removePaymentMethod(id: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    const removed = this.paymentMethods.find((p) => p.id === id);
    this.paymentMethods = this.paymentMethods.filter((p) => p.id !== id);
    if (removed?.isDefault && this.paymentMethods.length > 0) {
      this.paymentMethods[0] = { ...this.paymentMethods[0]!, isDefault: true };
    }
  }

  async setDefaultPaymentMethod(id: string): Promise<void> {
    await delay(MOCK_LATENCY_MS);
    this.paymentMethods = this.paymentMethods.map((p) => ({
      ...p,
      isDefault: p.id === id,
    }));
  }

  async getShippingQuote(
    _request: ShippingQuoteRequest,
    signal?: AbortSignal,
  ): Promise<ShippingOption[]> {
    await delay(MOCK_LATENCY_MS, signal);
    // Mirrors the real backend's flat quote (shipping.service.ts): pickup is
    // free, courier is a flat fee — no subtotal-based threshold exists there.
    return BASE_SHIPPING_OPTIONS;
  }
}
