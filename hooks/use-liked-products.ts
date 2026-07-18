import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { useLikesContext } from '@/contexts/likes.context';
import { fetchCatalogDetail, type CatalogItem } from '@/services/catalog-service';

/**
 * Liked (favorited) products for the "Liked" screen.
 *
 * The like STATE (which product ids) lives locally in `LikesContext` — the
 * backend has no favorites endpoint. Their full product DATA is hydrated from
 * the catalog backend (`GET /v1/catalog/parts/{id}`) so the screen shows real,
 * up-to-date parts. Ids that no longer resolve (deleted parts) are dropped.
 */

export type LikedProductsState = 'loading' | 'success' | 'empty' | 'error';

export function useLikedProducts() {
  const { likedIds } = useLikesContext();
  // Stable, sorted id list so the query key only changes when the set changes.
  const ids = useMemo(() => Array.from(likedIds).sort(), [likedIds]);

  const query = useQuery({
    queryKey: ['liked-products', ids],
    enabled: ids.length > 0,
    queryFn: async ({ signal }) => {
      const results = await Promise.all(
        ids.map((id) => fetchCatalogDetail(id, signal).catch(() => null)),
      );
      return results
        .filter((r): r is NonNullable<typeof r> => r != null)
        .map((r) => r.item);
    },
  });

  const items: CatalogItem[] = ids.length === 0 ? [] : query.data ?? [];

  let state: LikedProductsState;
  if (ids.length === 0) state = 'empty';
  else if (query.isPending) state = 'loading';
  else if (query.isError) state = 'error';
  else if (items.length === 0) state = 'empty';
  else state = 'success';

  return {
    state,
    items,
    error: query.error instanceof Error ? query.error.message : null,
    refresh: () => query.refetch(),
  };
}

export default useLikedProducts;
