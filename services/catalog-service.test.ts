import { beforeEach, expect, test, vi } from 'vitest';

const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('@/services/api-client', () => ({
  apiClient: { get },
  ApiError: class ApiError extends Error {
    status = 0;
  },
}));

import { fetchCatalogList } from './catalog-service';

beforeEach(() => get.mockReset());

test('keeps manufacturer part number separate from OEM and GM references', async () => {
  get.mockResolvedValue({
    items: [
      {
        id: 'part-1',
        title: 'Oil filter',
        manufacturer_part_number: 'MANN-W-712/95',
        part_brand_name: 'MANN-FILTER',
        part_number_type: 'OEM',
        oem_numbers: ['12605566', '55594651'],
        gm_numbers: ['GM-ALT-1'],
        images: [],
        price_uzs: 100000,
      },
    ],
    total: 1,
    page: 1,
    page_size: 24,
  });

  const { items } = await fetchCatalogList({ page: 1, pageSize: 24 });
  expect(items[0]).toMatchObject({
    manufacturerPartNumber: 'MANN-W-712/95',
    oem: '12605566',
    oemNumbers: ['12605566', '55594651'],
    gm: undefined,
  });
});

test('marks photography as planned only when the API explicitly opts in', async () => {
  get.mockResolvedValue({
    items: [
      { id: 'planned', title: 'Planned', photo_planned: true },
      { id: 'unknown', title: 'Unknown' },
      { id: 'false', title: 'Not planned', photo_planned: false },
    ],
    total: 3,
    page: 1,
    page_size: 24,
  });

  const { items } = await fetchCatalogList({ page: 1, pageSize: 24 });
  expect(items.map((item) => item.photoPlanned)).toEqual([true, false, false]);
});
