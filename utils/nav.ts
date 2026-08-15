/**
 * Navigation helpers that pair a route push with a data prefetch, so the target
 * screen renders from cache instead of a spinner. Keep these thin — they only
 * warm data + navigate; screens still own their own loading/error states.
 */
import { router } from 'expo-router';

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
