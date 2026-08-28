/**
 * Category drill navigation — the "does this node have children?" branch shared
 * by the systems screen and the subcategory screen.
 *
 * On tap we ask the reference tree for the node's ACTIVE children
 * (`GET /v1/reference/categories?parentId=<id>`, via `fetchReferenceCategories`):
 *   • children present → push the subcategory screen (drill one level deeper);
 *   • leaf (no children) → push the parts list, exactly as the old flat flow did.
 *
 * The vehicle context (make / model / brandId) is threaded through both routes so
 * the scope is never lost as the buyer drills. On mock/offline builds the fetcher
 * returns `[]`, so every node behaves as a leaf — the old direct-to-parts flow.
 */

import { router } from 'expo-router';
import { useCallback, useState } from 'react';

import { fetchReferenceCategories } from '@/services/reference-catalog';
import { triggerHaptic } from '@/utils/haptics';

export type DrillContext = {
  make?: string;
  model?: string;
  brandId?: string;
};

/** A category tappable in the drill flow — only the id and the *localized*
 *  display label are needed. Never pass the internal English `name`: this
 *  string is threaded straight into the next screen's header. */
export type DrillNode = { id: string; label: string };

export function useCategoryDrill(ctx: DrillContext) {
  // The id currently being resolved, so the tapped row can show a spinner and
  // further taps are ignored until it settles (a category read is one request).
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const drill = useCallback(
    async (node: DrillNode) => {
      if (resolvingId) return;
      triggerHaptic('selection');
      setResolvingId(node.id);

      let hasChildren = false;
      try {
        const children = await fetchReferenceCategories(node.id);
        hasChildren = children.length > 0;
      } catch {
        // A failed lookup should never trap the buyer — fall through to parts.
        hasChildren = false;
      }
      setResolvingId(null);

      const base = { make: ctx.make, model: ctx.model, brandId: ctx.brandId };
      if (hasChildren) {
        router.push({
          pathname: '/catalog/subcategories',
          params: { parentId: node.id, parentLabel: node.label, ...base },
        });
      } else {
        router.push({
          pathname: '/catalog/parts',
          params: { categoryId: node.id, categoryLabel: node.label, ...base },
        });
      }
    },
    [ctx.make, ctx.model, ctx.brandId, resolvingId],
  );

  return { drill, resolvingId };
}
