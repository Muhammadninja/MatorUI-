import { FlashList, type FlashListProps } from '@shopify/flash-list';
import { memo } from 'react';

/**
 * Virtualized list. Use everywhere you'd reach for FlatList — orders,
 * search results, catalog, garage. Materially faster on Android than
 * FlatList for any list past ~30 items.
 *
 * API mirrors FlashListProps so existing FlatList code mostly drops in:
 *   - `data`, `renderItem`, `keyExtractor` — identical
 *
 * FlashList v2 auto-sizes; no `estimatedItemSize` needed.
 *
 * Memoized at the component boundary; consumers should still memoize
 * their own `renderItem` to maximize recycle hits.
 */

export type AppListProps<T> = FlashListProps<T>;

function AppListInner<T>(props: AppListProps<T>) {
  return <FlashList {...props} />;
}

export default memo(AppListInner) as typeof AppListInner;
