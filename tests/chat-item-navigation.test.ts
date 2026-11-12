import { beforeEach, expect, test, vi } from 'vitest';

const push = vi.fn();
vi.mock('expo-router', () => ({ router: { push: (...args: unknown[]) => push(...args) } }));
vi.mock('@/hooks/use-catalog-detail', () => ({ prefetchCatalogDetail: vi.fn() }));

import { openChatItemDetail, openItemDetail } from '@/utils/nav';

beforeEach(() => push.mockReset());

test('a part opened from an Assistant result stays in the Assistant stack', () => {
  openChatItemDetail('brake-pad-1');
  expect(push).toHaveBeenCalledExactlyOnceWith({ pathname: '/chat-item/[id]', params: { id: 'brake-pad-1' } });
});

test('everywhere else still opens the Explore product screen', () => {
  openItemDetail('brake-pad-1');
  expect(push).toHaveBeenCalledExactlyOnceWith({ pathname: '/item-detail/[id]', params: { id: 'brake-pad-1' } });
});
