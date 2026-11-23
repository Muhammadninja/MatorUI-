/**
 * Navigation helpers that pair a route push with a data prefetch, so the target
 * screen renders from cache instead of a spinner. Keep these thin — they only
 * warm data + navigate; screens still own their own loading/error states.
 */
import { router, useSegments } from 'expo-router';
import { useCallback } from 'react';

import { prefetchCatalogDetail } from '@/hooks/use-catalog-detail';

/**
 * Open a product's detail screen, warming its data first. Call on press from any
 * product row/card/tile — the prefetch kicks off during the navigation
 * animation so the detail screen usually has its data by the time it mounts.
 */
export function openItemDetail(id: string): void {
  prefetchCatalogDetail(id);
  router.push({ pathname: '/item-detail/[id]', params: { id } });
}

/**
 * Open a product from an Assistant chat result. It stays in the Assistant
 * tab's stack, so back returns to the conversation; `openItemDetail` would
 * switch to Explore and strand the user on its home screen.
 */
export function openChatItemDetail(id: string): void {
  prefetchCatalogDetail(id);
  router.push({ pathname: '/chat-item/[id]', params: { id } });
}

/** Open a product from a Garage list. Same screen, kept in the Garage tab's
 *  stack for the same reason as `openChatItemDetail`. */
export function openGarageItemDetail(id: string): void {
  prefetchCatalogDetail(id);
  router.push({ pathname: '/garage-item/[id]', params: { id } });
}

/**
 * `openItemDetail` for screens that live in more than one tab (the product
 * screen itself, the vehicle parts list): opens the product inside the tab the
 * user is in, so back returns there instead of switching to Explore.
 */
export function useOpenItemDetail(): (id: string) => void {
  const segments = useSegments() as string[];
  const tab = segments[0] === '(tabs)' ? segments[1] : undefined;
  return useCallback(
    (id: string) => {
      if (tab === '(ai-chat)') openChatItemDetail(id);
      else if (tab === '(garage)') openGarageItemDetail(id);
      else openItemDetail(id);
    },
    [tab],
  );
}
