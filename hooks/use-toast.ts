import { useMemo } from 'react';

import { toastService, type ToastInput } from '@/services/toast-service';

/**
 * Ergonomic toast API. Stable references — safe to depend on in effects
 * or pass to memoized children without triggering re-renders.
 *
 * @example
 *   const toast = useToast();
 *   toast.success('Vehicle saved');
 *   toast.danger('Network error', { description: err.message, actionLabel: 'Retry', onAction: retry });
 *   toast.info('Profile updated', { duration: 2000 });
 *
 * For API error handlers / non-React callsites, import `toastService`
 * directly from `@/services/toast-service`.
 */
export function useToast() {
  // toastService is a stable module-level singleton; memoize the wrapper
  // shape so consumers get a stable reference across renders.
  return useMemo(
    () => ({
      success: (title: string, opts?: Omit<ToastInput, 'kind' | 'title'>) =>
        toastService.success(title, opts),
      danger: (title: string, opts?: Omit<ToastInput, 'kind' | 'title'>) =>
        toastService.danger(title, opts),
      info: (title: string, opts?: Omit<ToastInput, 'kind' | 'title'>) =>
        toastService.info(title, opts),
      show: (input: ToastInput) => toastService.show(input),
      dismiss: (id: string) => toastService.dismiss(id),
      dismissAll: () => toastService.dismissAll(),
    }),
    [],
  );
}

export default useToast;
