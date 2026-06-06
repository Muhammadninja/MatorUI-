import {
  QueryClient,
  QueryClientProvider as TanstackProvider,
} from '@tanstack/react-query';
import { useMemo, type PropsWithChildren } from 'react';

/**
 * App-wide TanStack Query client. Sensible mobile defaults:
 *  - retry once on failure (network blips are common; > 1 retries
 *    feel sluggish on mobile)
 *  - 60s `staleTime` so common reads (cart, profile, search results)
 *    aren't re-fetched on every screen transition
 *  - refetch-on-reconnect ON so the app catches up after airplane mode
 *  - refetch-on-window-focus OFF — useless on RN, would re-fetch on
 *    every background → foreground
 *
 * Use this in app/_layout.tsx like:
 *
 *   <AppQueryClientProvider>
 *     <CartProvider>… your app …</CartProvider>
 *   </AppQueryClientProvider>
 */

export default function AppQueryClientProvider({ children }: PropsWithChildren) {
  const client = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            staleTime: 60_000,
            refetchOnReconnect: true,
            refetchOnWindowFocus: false,
            refetchOnMount: false,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
    [],
  );

  return <TanstackProvider client={client}>{children}</TanstackProvider>;
}
