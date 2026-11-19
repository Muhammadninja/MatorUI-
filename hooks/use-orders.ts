/**
 * Orders React glue — all read hooks back React Query, mutations stay
 * imperative for now (createOrder side-effects: cart clear, navigation).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient, type MutateOptions } from '@tanstack/react-query';

import { useUserContext } from '@/contexts/user.context';
import { getAuthRequestEpoch } from '@/services/api-client';
import { clearPendingOrderAttempt, loadPendingOrderAttempt, savePendingOrderAttempt, type PendingOrderAttempt } from '@/services/order-attempt-storage';
import { isActiveOrder } from '@/services/order-groups';

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

/** What the server put beside its code in a refusal, when it said more. */
function errorDetailsOf(error: unknown): unknown {
  const body = (error as { response?: unknown } | null)?.response;
  return body && typeof body === 'object' ? (body as { details?: unknown }).details ?? null : null;
}

/** Account suffixes preserve existing prefix invalidation while isolating cached PII. */
function useAccountScope() {
  const { profile, isAuthenticated, isHydrating } = useUserContext();
  const ownerId = !isHydrating && isAuthenticated ? profile?.id ?? null : null;
  const epoch = getAuthRequestEpoch();
  const scope = useRef({ ownerId, epoch });
  if (scope.current.ownerId !== ownerId || scope.current.epoch !== epoch) {
    scope.current = { ownerId, epoch };
  }
  const captured = scope.current;
  return { ownerId, canRead: () => ownerId !== null && scope.current === captured &&
    captured.epoch === getAuthRequestEpoch() };
}

/** The machine-readable code of a failed request, when the server stated one. */
function errorCodeOf(error: unknown): string | null {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
}

/**
 * These 409 responses mean the backend rejected this order before creating it.
 * Other conflicts can mean an idempotency replay is still running or that a key
 * was reused, so keep the recovery record for those until the backend confirms.
 */
function isDefinitiveOrderRefusal(error: unknown): boolean {
  const code = errorCodeOf(error);
  if (['ORDER_TOTAL_CHANGED', 'PART_UNAVAILABLE', 'DELIVERY_PRICE_CHANGED', 'DELIVERY_QUOTE_STALE'].includes(code ?? '')) return true;
  // The server settled this key (409 REUSED/EXPIRED: an order already exists under it;
  // 400 INVALID: it can never be accepted). Keeping it would block checkout for good.
  if (['IDEMPOTENCY_KEY_REUSED', 'IDEMPOTENCY_KEY_EXPIRED', 'INVALID_IDEMPOTENCY_KEY'].includes(code ?? '')) return true;
  const status = (error as { status?: unknown } | null)?.status;
  if (status === 400 || status === 422) return true;
  return false;
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

/** How often the list is read again while an order is under way, so the status card on
 *  Home and Profile follows operator and payment changes. Foreground only. */
const ACTIVE_LIST_POLL_MS = 60_000;

export function useOrders(request: OrderListRequest = DEFAULT_LIST_REQUEST): UseOrdersValue {
  const { ownerId, canRead } = useAccountScope();
  const query = useQuery({
    queryKey: [...ordersQueryKeys.list(request), ownerId],
    enabled: ownerId !== null,
    queryFn: ({ signal }) => ordersTransport.listOrders(request, signal),
    refetchInterval: (q) =>
      q.state.data?.items.some((row) => isActiveOrder(row)) ? ACTIVE_LIST_POLL_MS : false,
    refetchIntervalInBackground: false,
  });

  return useMemo<UseOrdersValue>(() => {
    let state: OrderListState;
    if (!ownerId) state = 'idle';
    else if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else if ((query.data?.items.length ?? 0) === 0) state = 'empty';
    else state = 'success';

    return {
      state,
      page: ownerId ? query.data ?? null : null,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        if (canRead()) void query.refetch();
      },
    };
  }, [query, ownerId, canRead]);
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
  const { ownerId, canRead } = useAccountScope();
  const query = useQuery({
    queryKey: [...(orderId ? ordersQueryKeys.detail(orderId) : ['orders', 'detail', 'disabled']), ownerId],
    queryFn: ({ signal }) => ordersTransport.getOrder(orderId as string, signal),
    enabled: ownerId !== null && !!orderId,
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
    if (!ownerId) state = 'idle';
    else if (!orderId) state = 'not_found';
    else if (query.isPending) state = 'loading';
    else if (query.isError) state = 'error';
    else if (!query.data) state = 'not_found';
    else state = 'success';

    return {
      state,
      order: ownerId ? query.data ?? null : null,
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        if (orderId && canRead()) void query.refetch();
      },
    };
  }, [orderId, query, ownerId, canRead]);
}

// ── useCreateOrder (mutation) ──────────────────────────────────────────

export type CreateOrderPhase = 'idle' | 'placing' | 'success' | 'error';

export type UseCreateOrderValue = {
  phase: CreateOrderPhase;
  error: string | null;
  errorCode: string | null;
  errorDetails: unknown;
  result: CreateOrderResult | null;
  recoveryReady: boolean;
  hasPendingAttempt: boolean;
  placeOrder: (input: CreateOrderInput) => Promise<CreateOrderResult | null>;
  reset: () => void;
};

/** 8–128 letters, digits, `_` — the backend's `Idempotency-Key` alphabet. */
function newOrderKey(): string {
  return `ord_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function useCreateOrder(): UseCreateOrderValue {
  const { ownerId, canRead } = useAccountScope();
  const [snapshot, setSnapshot] = useState<{
    ownerId: string | null; attempt?: object; phase: CreateOrderPhase; error: string | null; errorCode: string | null; errorDetails?: unknown; result: CreateOrderResult | null;
  }>({ ownerId, phase: 'idle', error: null, errorCode: null, result: null });
  const session = useRef<{
    ownerId: string | null; pending: Promise<CreateOrderResult | null> | null; result: CreateOrderResult | null;
    key?: PendingOrderAttempt & { intent: string; recovered: boolean }; hydrated: boolean;
  }>({ ownerId, pending: null, result: null, hydrated: false });
  if (session.current.ownerId !== ownerId) session.current = { ownerId, pending: null, result: null, hydrated: ownerId === null };

  useEffect(() => {
    const attempt = session.current;
    let active = true;
    if (!ownerId) {
      attempt.hydrated = true;
      return () => { active = false; };
    }
    void loadPendingOrderAttempt(ownerId).then((key) => {
      if (!active || session.current !== attempt) return;
      if (key) attempt.key = { ...key, intent: JSON.stringify(key.input), recovered: true };
      attempt.hydrated = true;
      setSnapshot((current) => current.ownerId === ownerId ? { ...current } : current);
    }).catch(() => {
      // Fail closed: never send a fresh key when recovery state could not be read.
      if (!active || session.current !== attempt) return;
      attempt.hydrated = false;
      setSnapshot((current) => current.ownerId === ownerId ? { ...current } : current);
    });
    return () => { active = false; };
  }, [ownerId]);

  const placeOrder = useCallback((input: CreateOrderInput): Promise<CreateOrderResult | null> => {
    if (!canRead()) return Promise.resolve(null);
    const attempt = session.current;
    if (!attempt.hydrated) {
      setSnapshot({ ownerId, attempt, phase: 'error', error: 'Checkout recovery is still loading. Try again shortly.', errorCode: 'ORDER_ATTEMPT_RECOVERY_PENDING', result: null });
      return Promise.resolve(null);
    }
    if (!attempt.key && input.items.length === 0) return Promise.resolve(null);
    // Only the first caller may continue into hosted payment/navigation.
    if (attempt.pending) return Promise.resolve(null);
    // Keep the successful order while hosted payment/navigation is in progress.
    if (attempt.result) return Promise.resolve(null);
    // A failed request may have committed. Its original parameters and key
    // remain bound together until the server confirms the replay.
    const { totalLabel: _display, idempotencyKey: _key, ...selection } = input;
    const intent = JSON.stringify(selection);
    // An uncertain attempt owns its key even if the screen's inputs changed or
    // the process restarted. Only a confirmed response clears durable recovery.
    if (!attempt.key) {
      attempt.key = { intent, key: newOrderKey(), createdAt: Date.now(), input: selection, recovered: false };
    }
    const attemptInput = attempt.key.input;
    const recovered = attempt.key.recovered || intent !== attempt.key.intent;
    if (attempt.key.createdAt + 30 * 24 * 60 * 60 * 1000 <= Date.now()) {
      setSnapshot({ ownerId, attempt, phase: 'error', error: 'This checkout recovery window expired. Check order history before starting another checkout.', errorCode: 'ORDER_ATTEMPT_EXPIRED', result: null });
      return Promise.resolve(null);
    }
    const keyed = { ...attemptInput, idempotencyKey: attempt.key.key };
    setSnapshot({ ownerId, attempt, phase: 'placing', error: null, errorCode: null, result: null });
    const pending = Promise.resolve().then(() => {
      if (session.current !== attempt || !canRead()) throw new Error('Order session changed');
      return savePendingOrderAttempt(ownerId!, attempt.key!).then(() => ordersTransport.createOrder(keyed));
    }).then(async (result) => {
      if (session.current !== attempt || !canRead()) return null;
      await clearPendingOrderAttempt(ownerId!);
      attempt.result = result;
      const completed = recovered ? { ...result, recoveredAttempt: attemptInput } : result;
      setSnapshot({ ownerId, attempt, phase: 'success', error: null, errorCode: null, result: completed });
      return completed;
    }).catch(async (error: unknown) => {
      if (session.current === attempt && canRead()) {
        if (isDefinitiveOrderRefusal(error)) {
          try {
            await clearPendingOrderAttempt(ownerId!);
            if (session.current === attempt && canRead()) attempt.key = undefined;
          } catch {
            // If durable cleanup fails, keep the key and fail closed on retry.
          }
        }
        if (session.current === attempt && canRead()) {
          setSnapshot({ ownerId, attempt, phase: 'error', error: error instanceof Error ? error.message : 'Order failed', errorCode: errorCodeOf(error), errorDetails: errorDetailsOf(error), result: null });
        }
      }
      return null;
    }).finally(() => { if (attempt.pending === pending) attempt.pending = null; });
    attempt.pending = pending;
    return pending;
  }, [ownerId, canRead]);

  const reset = useCallback(() => {
    // Resetting UI must not unlock an in-flight order submission.
    if (!canRead() || session.current.pending || !session.current.hydrated) return;
    const previous = session.current;
    if (previous.result && ownerId) void clearPendingOrderAttempt(ownerId);
    session.current = { ownerId, pending: null, result: null, hydrated: previous.hydrated, ...(!previous.result && previous.key ? { key: previous.key } : {}) };
    setSnapshot({ ownerId, phase: 'idle', error: null, errorCode: null, result: null });
  }, [ownerId, canRead]);

  const visible = snapshot.ownerId === ownerId && (!snapshot.attempt || snapshot.attempt === session.current) ? snapshot : { phase: 'idle' as const, error: null, errorCode: null, result: null };
  return {
    phase: visible.phase, error: visible.error, errorCode: visible.errorCode, result: visible.result,
    errorDetails: ('errorDetails' in visible ? visible.errorDetails : null) ?? null,
    recoveryReady: session.current.hydrated,
    hasPendingAttempt: Boolean(session.current.key),
    placeOrder, reset,
  };
}

// ── useCancelOrder ─────────────────────────────────────────────────────

/** Cancel an order, then re-read it: on a refusal too, since its status has moved on. */
export function useCancelOrder(orderId: string | null | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => ordersTransport.cancelOrder(orderId as string),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

/** Re-read every order query, so what is shown is the backend's current status. */
export function useRefreshOrders() {
  const queryClient = useQueryClient();
  return useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  }, [queryClient]);
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
  const { ownerId, canRead } = useAccountScope();
  const query = useQuery({
    queryKey: [...ordersQueryKeys.addresses(), ownerId],
    enabled: ownerId !== null,
    queryFn: ({ signal }) => ordersTransport.listAddresses(signal),
  });

  return useMemo<CollectionValue<Address>>(
    () => ({
      state: !ownerId ? 'idle' : query.isPending ? 'loading' : query.isError ? 'error' : 'success',
      items: ownerId ? query.data ?? [] : [],
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        if (canRead()) void query.refetch();
      },
    }),
    [query, ownerId, canRead],
  );
}

export function usePaymentMethods(): CollectionValue<PaymentMethod> {
  const { ownerId, canRead } = useAccountScope();
  const query = useQuery({
    queryKey: [...ordersQueryKeys.paymentMethods(), ownerId],
    enabled: ownerId !== null,
    queryFn: ({ signal }) => ordersTransport.listPaymentMethods(signal),
  });

  return useMemo<CollectionValue<PaymentMethod>>(
    () => ({
      state: !ownerId ? 'idle' : query.isPending ? 'loading' : query.isError ? 'error' : 'success',
      items: ownerId ? query.data ?? [] : [],
      error: query.error instanceof Error ? query.error.message : null,
      refresh: () => {
        if (canRead()) void query.refetch();
      },
    }),
    [query, ownerId, canRead],
  );
}

// ── Address CRUD mutations ─────────────────────────────────────────────
//
// Each invalidates the addresses query so the list re-fetches with the
// server's canonical shape (including the enforced single-default flag).

function useAddressMutation<Input>(
  write: (input: Input) => Promise<Address>,
  updateCache: (current: Address[] | undefined, saved: Address) => Address[] | undefined,
) {
  const { ownerId, canRead } = useAccountScope();
  const queryClient = useQueryClient();
  type Request = { input: Input; ownerId: string | null; canRead: () => boolean };
  const mutation = useMutation<Address, Error, Request>({
    mutationFn: async (request) => {
      if (!request.canRead()) throw new DOMException('Address session changed', 'AbortError');
      const saved = await write(request.input);
      if (!request.canRead()) throw new DOMException('Address session changed', 'AbortError');
      return saved;
    },
    onSuccess: (saved, request) => {
      if (!request.canRead()) return;
      const key = [...ordersQueryKeys.addresses(), request.ownerId];
      // Publish the saved point to its owner's readers before the background refetch.
      queryClient.setQueryData<Address[]>(key, (current) => updateCache(current, saved));
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  const optionsFor = (options?: MutateOptions<Address, Error, Input>) => options && {
    onSuccess: (data: Address, request: Request, result: unknown, context: Parameters<NonNullable<typeof options.onSuccess>>[3]) =>
      options.onSuccess?.(data, request.input, result, context),
    onError: (error: Error, request: Request, result: unknown, context: Parameters<NonNullable<typeof options.onError>>[3]) =>
      options.onError?.(error, request.input, result, context),
    onSettled: (data: Address | undefined, error: Error | null, request: Request, result: unknown, context: Parameters<NonNullable<typeof options.onSettled>>[4]) =>
      options.onSettled?.(data, error, request.input, result, context),
  };
  return {
    ...mutation,
    variables: mutation.variables?.input,
    mutate: (input: Input, options?: MutateOptions<Address, Error, Input>) =>
      mutation.mutate({ input, ownerId, canRead }, optionsFor(options)),
    mutateAsync: (input: Input, options?: MutateOptions<Address, Error, Input>) =>
      mutation.mutateAsync({ input, ownerId, canRead }, optionsFor(options)),
  };
}

export function useCreateAddress() {
  return useAddressMutation(
    (input: AddressInput) => ordersTransport.createAddress(input),
    (current, created) => [...(current ?? []).filter((address) => address.id !== created.id), created],
  );
}

export function useUpdateAddress() {
  return useAddressMutation(
    ({ id, input }: { id: string; input: AddressInput }) => ordersTransport.updateAddress(id, input),
    (current, updated) => current?.map((address) => address.id === updated.id ? updated : address),
  );
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
  const { ownerId, canRead } = useAccountScope();
  const query = useQuery({
    queryKey: [...(request
      ? ordersQueryKeys.shippingQuote(request)
      : ['shipping', 'quote', 'disabled']), ownerId],
    queryFn: ({ signal }) => ordersTransport.getShippingQuote(request as ShippingQuoteRequest, signal),
    enabled: ownerId !== null && !!request,
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
      state: !ownerId || !request
        ? 'idle'
        : query.isFetching
          ? 'loading'
          : query.isError
            ? 'error'
            : 'success',
      options: ownerId && !query.isError ? query.data ?? [] : [],
      error: query.error instanceof Error ? query.error.message : null,
      errorCode: errorCodeOf(query.error),
      refresh: () => {
        if (request && canRead()) void query.refetch();
      },
    }),
    [request, query, ownerId, canRead],
  );
}
