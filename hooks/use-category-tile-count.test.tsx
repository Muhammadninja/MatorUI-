/**
 * useSyncCategoryTileCount — the Explore tile shows the same number as the
 * category list it opens (owner report 2026-11-27: tile 64, list 65).
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, create } from 'react-test-renderer';
import { describe, expect, test, vi } from 'vitest';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('@/services/categories-service', () => ({ fetchRootCategories: vi.fn() }));

import { CATEGORIES_QUERY_KEY, useSyncCategoryTileCount } from './use-categories';
import type { CategoryTileData } from '@/services/categories-service';

const tile = (id: string, count?: number) => ({ id, name: id, label: id, count, color: '#000', iconKey: id }) as CategoryTileData;

function run(categoryId: string | undefined, total: number, ready: boolean, rows: CategoryTileData[]) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(CATEGORIES_QUERY_KEY, rows);
  function Probe() {
    useSyncCategoryTileCount(categoryId, total, ready);
    return null;
  }
  act(() => {
    create(
      <QueryClientProvider client={client}>
        <Probe />
      </QueryClientProvider>,
    );
  });
  return client.getQueryData<CategoryTileData[]>(CATEGORIES_QUERY_KEY);
}

describe('useSyncCategoryTileCount', () => {
  test('the tile takes the loaded list total', () => {
    const rows = run('engine-system', 65, true, [tile('engine-system', 64), tile('brake-system', 30)]);
    expect(rows?.map((r) => r.count)).toEqual([65, 30]);
  });

  test('nothing changes before the list has answered', () => {
    const rows = run('engine-system', 0, false, [tile('engine-system', 64)]);
    expect(rows?.[0].count).toBe(64);
  });

  test('a tile without a count line stays without one', () => {
    const rows = run('other', 8, true, [tile('other')]);
    expect(rows?.[0].count).toBeUndefined();
  });

  test('no category (a vehicle-system bucket) writes no tile', () => {
    const rows = run(undefined, 5, true, [tile('engine-system', 64)]);
    expect(rows?.[0].count).toBe(64);
  });
});
