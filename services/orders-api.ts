/**
 * Transport contract for the orders + account-data APIs. Implement once
 * for the mock environment (`MockOrdersTransport`, below), once for
 * HTTP (stub at the bottom of this file), and swap by reassigning the
 * `ordersTransport` constant.
 *
 * Mirrors `garage-api.ts` / `cart-api.ts`: same singleton-swap pattern,
 * same AbortSignal contract on reads, same "no client-side cancel on
 * mutations" stance (an aborted mutation may already be committed
 * server-side; silent local cancel would mask that).
 */
import type {
  Address,
  CreateOrderInput,
  CreateOrderResult,
  OrderDetail,
  OrderListPage,
  OrderListStatus,
  PaymentMethod,
  ShippingOption,
} from '@/services/orders-service';

export type OrderListRequest = {
  page?: number;
  pageSize?: number;
  /** Optional server-side filter by status pill. */
  status?: OrderListStatus;
};

export type ShippingQuoteRequest = {
  addressId: string;
  /** Subtotal in dollars at quote time. Lets the server flip "free
   *  shipping" thresholds without the client guessing. */
  subtotal: number;
};

export interface OrdersTransport {
  listOrders(request: OrderListRequest, signal?: AbortSignal): Promise<OrderListPage>;
  getOrder(orderId: string, signal?: AbortSignal): Promise<OrderDetail | null>;
  createOrder(input: CreateOrderInput, signal?: AbortSignal): Promise<CreateOrderResult>;
  listAddresses(signal?: AbortSignal): Promise<Address[]>;
  listPaymentMethods(signal?: AbortSignal): Promise<PaymentMethod[]>;
  getShippingQuote(
    request: ShippingQuoteRequest,
    signal?: AbortSignal,
  ): Promise<ShippingOption[]>;
}

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
    line1: '128 Marrakesh Rd, Suite 4',
    city: 'Brooklyn, NY 11211',
  },
  {
    id: 'addr_shop',
    label: 'Shop',
    line1: '2210 W Industrial Blvd',
    city: 'Long Island City, NY 11101',
  },
];

const SEED_PAYMENT_METHODS: PaymentMethod[] = [
  { id: 'pm_mc_4242', brand: 'Mastercard', last4: '4242', exp: '09/27', isDefault: true },
  { id: 'pm_visa_1881', brand: 'Visa', last4: '1881', exp: '03/26', isDefault: false },
];

const BASE_SHIPPING_OPTIONS: ShippingOption[] = [
  { key: 'standard', label: 'Standard', eta: '3-5 business days', price: 0 },
  { key: 'express', label: 'Express', eta: '1-2 business days', price: 9.99 },
  { key: 'same_day', label: 'Same day', eta: 'By 9 PM today', price: 19.99 },
];

const SEED_ORDERS: OrderListPage = {
  page: 1,
  pageSize: 20,
  total: 5,
  items: [
    {
      id: 'ORD-8821',
      date: 'May 28, 2026',
      status: 'Delivered',
      items: 3,
      total: '$486.00',
      summary: 'Garrett GTX3582R + 2 items',
    },
    {
      id: 'ORD-8790',
      date: 'May 14, 2026',
      status: 'In Transit',
      items: 1,
      total: '$1,249.00',
      summary: 'KW Coilovers V3 Suspension Kit',
    },
    {
      id: 'ORD-8741',
      date: 'Apr 30, 2026',
      status: 'Delivered',
      items: 2,
      total: '$920.00',
      summary: 'Vossen HF-5 Wheels + 1 item',
    },
    {
      id: 'ORD-8703',
      date: 'Apr 12, 2026',
      status: 'Cancelled',
      items: 1,
      total: '$340.00',
      summary: 'Brembo GT Big Brake Kit',
    },
    {
      id: 'ORD-8682',
      date: 'Mar 27, 2026',
      status: 'Delivered',
      items: 4,
      total: '$2,100.00',
      summary: 'Full suspension overhaul bundle',
    },
  ],
};

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

const ORDER_DETAILS: Record<string, OrderDetail> = {
  'ORD-8821': detailFor({ id: 'ORD-8821', total: '$486.00' }, 'delivered'),
  'ORD-8790': detailFor({ id: 'ORD-8790', total: '$1,249.00' }, 'in_transit'),
  'ORD-8741': detailFor({ id: 'ORD-8741', total: '$920.00' }, 'delivered'),
  'ORD-8703': detailFor({ id: 'ORD-8703', total: '$340.00' }, 'cancelled'),
  'ORD-8682': detailFor({ id: 'ORD-8682', total: '$2,100.00' }, 'delivered'),
};

export class MockOrdersTransport implements OrdersTransport {
  private orders: OrderListPage;
  private details: Record<string, OrderDetail>;

  constructor(seedOrders: OrderListPage = SEED_ORDERS, seedDetails = ORDER_DETAILS) {
    this.orders = { ...seedOrders, items: [...seedOrders.items] };
    this.details = { ...seedDetails };
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
    const eta = shipping?.eta ?? '3-5 business days';
    // Real server would calculate this; mock just echoes a plausible label.
    const totalLabel = '$—.—'; // intentionally placeholder; confirmation reads from search params we pass instead
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
    return [...SEED_ADDRESSES];
  }

  async listPaymentMethods(signal?: AbortSignal): Promise<PaymentMethod[]> {
    await delay(MOCK_LATENCY_MS, signal);
    return [...SEED_PAYMENT_METHODS];
  }

  async getShippingQuote(
    request: ShippingQuoteRequest,
    signal?: AbortSignal,
  ): Promise<ShippingOption[]> {
    await delay(MOCK_LATENCY_MS, signal);
    // Real shipping API would scale by zip + weight + cart subtotal.
    // For the mock we just bump standard to free above $500 to mirror
    // the cart's free-shipping rule.
    return BASE_SHIPPING_OPTIONS.map((o) =>
      o.key === 'standard' && request.subtotal >= 500 ? { ...o, price: 0 } : o,
    );
  }
}

// ── HTTP transport (stub) ────────────────────────────────────────────

/**
 * Drop-in HTTP transport — fill in the `request` method with the
 * auth-header strategy from UserContext + env base URL.
 *
 *   GET    /v1/orders?page=&pageSize=&status=     → OrderListPage
 *   GET    /v1/orders/:orderId                    → OrderDetail
 *   POST   /v1/orders                              → CreateOrderResult
 *   GET    /v1/account/addresses                   → Address[]
 *   GET    /v1/account/payment-methods             → PaymentMethod[]
 *   POST   /v1/shipping/quote                      → ShippingOption[]
 */
import { shouldUseHttpTransport } from '@/config/api';
import { apiClient } from '@/services/api-client';

export class HttpOrdersTransport implements OrdersTransport {
  listOrders(req: OrderListRequest, signal?: AbortSignal): Promise<OrderListPage> {
    const qs = new URLSearchParams();
    if (req.page) qs.set('page', String(req.page));
    if (req.pageSize) qs.set('pageSize', String(req.pageSize));
    if (req.status) qs.set('status', req.status);
    return apiClient.get<OrderListPage>(`/v1/orders?${qs.toString()}`, { signal });
  }

  getOrder(orderId: string, signal?: AbortSignal): Promise<OrderDetail> {
    return apiClient.get<OrderDetail>(
      `/v1/orders/${encodeURIComponent(orderId)}`,
      { signal },
    );
  }

  createOrder(input: CreateOrderInput, signal?: AbortSignal): Promise<CreateOrderResult> {
    return apiClient.post<CreateOrderResult>('/v1/orders', input, { signal });
  }

  // Address + payment endpoints — wired but NOT exercised until the
  // payment/address screens are migrated off their local-state mocks
  // (intentionally the last step of the API rollout per the project plan).
  listAddresses(signal?: AbortSignal): Promise<Address[]> {
    return apiClient.get<Address[]>('/v1/account/addresses', { signal });
  }

  listPaymentMethods(signal?: AbortSignal): Promise<PaymentMethod[]> {
    return apiClient.get<PaymentMethod[]>('/v1/account/payment-methods', { signal });
  }

  getShippingQuote(
    req: ShippingQuoteRequest,
    signal?: AbortSignal,
  ): Promise<ShippingOption[]> {
    return apiClient.post<ShippingOption[]>('/v1/shipping/quote', req, { signal });
  }
}

// ── Singleton ────────────────────────────────────────────────────────

/** Flips automatically based on `EXPO_PUBLIC_API_BASE_URL`. */
export const ordersTransport: OrdersTransport = shouldUseHttpTransport()
  ? new HttpOrdersTransport()
  : new MockOrdersTransport();
