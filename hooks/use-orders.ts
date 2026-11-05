/**
 * Orders React glue — all read hooks back React Query, mutations stay
 * imperative for now (createOrder side-effects: cart clear, navigation).
 */
import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  ordersTransport,
  type OrderListRequest,
  type ShippingQuoteRequest,
} from '@/services/orders-api';
import type {
  Address,
  AddressInput,
  CreateOrderInput,
  CreateOrderResult,
  OrderDetail,
  OrderListPage,
  PaymentMethod,
  PaymentMethodInput,
  ShippingOption,
} from '@/services/orders-service';

// ── Query keys ─────────────────────────────────────────────────────────

export const ordersQueryKeys = {
  list: (req: OrderListRequest) =>
    ['orders', 'list', req.page, req.pageSize, req.status] as const,
  detail: (id: string) => ['orders', 'detail', id] as const,
  addresses: () => ['account', 'addresses'] as const,
  paymentMethods: () => ['account', 'payment-methods'] as const,
  shippingQuote: (req: ShippingQuoteRequest) =>
    ['shipping', 'quote', req.addressId, req.location ?? null, req.cartKey ?? null] as const,
};

/** The machine-readable code of a failed request, when the server stated one. */
function errorCodeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

// ── useOrders (list) ───────────────────────────────────────────────────

export type OrderListState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export type UseOrdersValue = {
  state: OrderListState;
  page: OrderListPage | null;
  error: string | null;
  refresh: () => void;
};

const DEFAULT_LIST_REQUEST: OrderListRequest = { page: 1, pageSize: 20 };

export function useOrders(request: OrderListRequest = DEFAULT_LIST_REQUEST): UseOrdersValue {
  const query = useQuery({
    queryKey: ordersQueryKeys.list(request),
    queryFn: ({ signal }) => ordersTransport.listOrders(request, signal),
  });

  return useMemo<UseOrdersValue>(() => {
    let state: OrderListState;
    if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else if ((query.data?.items.length ?? 0) === 0) state = 'empty';
    else state = 'success';

    return {
      state,
      page: query.data ?? null,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    };
  }, [query]);
}

// ── useOrder (detail) ──────────────────────────────────────────────────

export type OrderDetailState = 'idle' | 'loading' | 'success' | 'not_found' | 'error';

export type UseOrderValue = {
  state: OrderDetailState;
  order: OrderDetail | null;
  error: string | null;
  refresh: () => void;
};

/** How often the tracking screen re-fetches an ACTIVE order (ms). Keeps the
 *  customer's status in sync with backend/operator changes without a WebSocket.
 *  Terminal orders stop polling to spare battery/network. */
const ACTIVE_ORDER_POLL_MS = 15_000;
const TERMINAL_STATUSES: ReadonlySet<OrderDetail['status']> = new Set(['delivered', 'cancelled']);

export function useOrder(orderId: string | null | undefined): UseOrderValue {
  const query = useQuery({
    queryKey: orderId ? ordersQueryKeys.detail(orderId) : ['orders', 'detail', 'disabled'],
    queryFn: ({ signal }) => ordersTransport.getOrder(orderId as string, signal),
    enabled: !!orderId,
    // Always refetch when the tracking screen mounts, so an order opened from
    // history never renders a stale cached status before the poll catches up.
    refetchOnMount: 'always',
    // Poll while the order is in-flight so operator/webhook status changes appear
    // within ~15s; stop once it reaches a terminal state. Foreground only.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (!status || TERMINAL_STATUSES.has(status)) return false;
      return ACTIVE_ORDER_POLL_MS;
    },
    refetchIntervalInBackground: false,
  });

  return useMemo<UseOrderValue>(() => {
    let state: OrderDetailState;
    if (!orderId) state = 'idle';
    else if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else if (!query.data) state = 'not_found';
    else state = 'success';

    return {
      state,
      order: query.data ?? null,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    };
  }, [orderId, query]);
}

// ── useCreateOrder (mutation) ──────────────────────────────────────────

export type CreateOrderPhase = 'idle' | 'placing' | 'success' | 'error';

export type UseCreateOrderValue = {
  phase: CreateOrderPhase;
  error: string | null;
  errorCode: string | null;
  result: CreateOrderResult | null;
  placeOrder: (input: CreateOrderInput) => Promise<CreateOrderResult | null>;
  reset: () => void;
};

export function useCreateOrder(): UseCreateOrderValue {
  const [result, setResult] = useState<CreateOrderResult | null>(null);

  const mutation = useMutation({
    mutationFn: (input: CreateOrderInput) => ordersTransport.createOrder(input),
    onSuccess: (r) => setResult(r),
  });

  const phase: CreateOrderPhase = mutation.isPending
    ? 'placing'
    : mutation.isError
      ? 'error'
      : mutation.isSuccess
        ? 'success'
        : 'idle';

  const placeOrder = useCallback(
    async (input: CreateOrderInput): Promise<CreateOrderResult | null> => {
      try {
        return await mutation.mutateAsync(input);
      } catch {
        return null;
      }
    },
    [mutation],
  );

  const reset = useCallback(() => {
    mutation.reset();
    setResult(null);
  }, [mutation]);

  return useMemo<UseCreateOrderValue>(
    () => ({
      phase,
      error: mutation.error instanceof Error ? mutation.error.message : null,
      errorCode: errorCodeOf(mutation.error),
      result,
      placeOrder,
      reset,
    }),
    [phase, mutation.error, result, placeOrder, reset],
  );
}

// ── useAddresses / usePaymentMethods (read-only collections) ───────────

type CollectionState = 'idle' | 'loading' | 'success' | 'error';

export type CollectionValue<T> = {
  state: CollectionState;
  items: T[];
  error: string | null;
  refresh: () => void;
};

export function useAddresses(): CollectionValue<Address> {
  const query = useQuery({
    queryKey: ordersQueryKeys.addresses(),
    queryFn: ({ signal }) => ordersTransport.listAddresses(signal),
  });

  return useMemo<CollectionValue<Address>>(
    () => ({
      state: query.isPending ? 'loading' : query.isError ? 'error' : 'success',
      items: query.data ?? [],
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    }),
    [query],
  );
}

export function usePaymentMethods(): CollectionValue<PaymentMethod> {
  const query = useQuery({
    queryKey: ordersQueryKeys.paymentMethods(),
    queryFn: ({ signal }) => ordersTransport.listPaymentMethods(signal),
  });

  return useMemo<CollectionValue<PaymentMethod>>(
    () => ({
      state: query.isPending ? 'loading' : query.isError ? 'error' : 'success',
      items: query.data ?? [],
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        void query.refetch();
      },
    }),
    [query],
  );
}

// ── Address CRUD mutations ─────────────────────────────────────────────
//
// Each invalidates the addresses query so the list re-fetches with the
// server's canonical shape (including the enforced single-default flag).

export function useCreateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AddressInput) => ordersTransport.createAddress(input),
    onSuccess: (created) => {
      // In the list at once: the checkout quotes and orders against this id as soon as the
      // save returns, and must not fall back on another address until the refetch lands.
      queryClient.setQueryData<Address[]>(ordersQueryKeys.addresses(), (current) => [
        ...(current ?? []).filter((address) => address.id !== created.id),
        created,
      ]);
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.addresses() });
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: AddressInput }) =>
      ordersTransport.updateAddress(id, input),
    onSuccess: (updated) => {
      // As above: a moved point has to change the quote straight away.
      queryClient.setQueryData<Address[]>(ordersQueryKeys.addresses(), (current) =>
        current?.map((address) => (address.id === updated.id ? updated : address)),
      );
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.addresses() });
    },
  });
}

export function useRemoveAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersTransport.removeAddress(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.addresses() });
    },
  });
}

export function useSetDefaultAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersTransport.setDefaultAddress(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.addresses() });
    },
  });
}

// ── Payment-method CRUD mutations ──────────────────────────────────────

export function useCreatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: PaymentMethodInput) => ordersTransport.createPaymentMethod(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.paymentMethods() });
    },
  });
}

export function useUpdatePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: PaymentMethodInput }) =>
      ordersTransport.updatePaymentMethod(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.paymentMethods() });
    },
  });
}

export function useRemovePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersTransport.removePaymentMethod(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.paymentMethods() });
    },
  });
}

export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => ordersTransport.setDefaultPaymentMethod(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ordersQueryKeys.paymentMethods() });
    },
  });
}

// ── useShippingQuote (depends on subtotal + address) ───────────────────

export type UseShippingQuoteValue = {
  state: CollectionState;
  options: ShippingOption[];
  error: string | null;
  errorCode: string | null;
  refresh: () => void;
};

export function useShippingQuote(request: ShippingQuoteRequest | null): UseShippingQuoteValue {
  const query = useQuery({
    queryKey: request
      ? ordersQueryKeys.shippingQuote(request)
      : ['shipping', 'quote', 'disabled'],
    queryFn: ({ signal }) => ordersTransport.getShippingQuote(request as ShippingQuoteRequest, signal),
    enabled: !!request,
    // A price the buyer is about to agree to: always asked for afresh on opening the
    // screen (the server caches the costly part), and a refresh that is under way counts
    // as loading, so an old price cannot be confirmed in the meantime. Retrying is the
    // buyer's call: most refusals only change when they change something.
    staleTime: 0,
    refetchOnMount: 'always',
    retry: false,
  });

  return useMemo<UseShippingQuoteValue>(
    () => ({
      state: !request
        ? 'idle'
        : query.isFetching
          ? 'loading'
          : query.isError
            ? 'error'
            : 'success',
      options: query.isError ? [] : query.data ?? [],
      error: query.error instanceof Error ? query.error.message : null,
      errorCode: errorCodeOf(query.error),
      refresh: () => {
        if (request) void query.refetch();
      },
    }),
    [request, query],
  );
}
