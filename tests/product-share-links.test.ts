import { describe, expect, test, vi } from 'vitest';

import appJson from '../app.json';
import { redirectSystemPath } from '../app/+native-intent';
import { shareMessage } from '../utils/share';
import { appPathForShareLink, productShareUrl } from '../utils/share-link';

vi.mock('react-native', () => ({ Share: { share: vi.fn(), dismissedAction: 'dismissedAction' } }));

// "Share" sends https://mator.uz/p/<id>. The production app claims that path on
// both platforms, and mator.uz's association files name this app (mator-admin).
describe('product share links', () => {
  test('a shared product is text plus its mator.uz link, not a photo', () => {
    expect(shareMessage({ id: 'part_stock_6381', title: 'Подушка КПП', price: "416 000 so'm" }))
      .toBe("Подушка КПП — 416 000 so'm\nhttps://mator.uz/p/part_stock_6381");
    expect(shareMessage({ id: 'p1', title: 'Filtr' })).toBe('Filtr\nhttps://mator.uz/p/p1');
  });

  test('the link escapes the id', () => {
    expect(productShareUrl('a b/c')).toBe('https://mator.uz/p/a%20b%2Fc');
  });

  test.each([
    ['https://mator.uz/p/part_stock_6381', '/item-detail/part_stock_6381'],
    ['https://www.mator.uz/p/part_stock_6381/', '/item-detail/part_stock_6381'],
    ['https://mator.uz/p/part_stock_6381?utm_source=tg#x', '/item-detail/part_stock_6381'],
    ['HTTPS://MATOR.UZ/p/clx9abc', '/item-detail/clx9abc'],
    ['/p/part_stock_6381', '/item-detail/part_stock_6381'],
  ])('%s opens the product screen', (url, path) => {
    expect(appPathForShareLink(url)).toBe(path);
    expect(redirectSystemPath({ path: url, initial: true })).toBe(path);
  });

  test.each([
    'https://mator.uz/catalog/part_stock_6381',
    'https://evil.example/p/part_stock_6381',
    'https://mator.uz.evil.example/p/part_stock_6381',
    'https://mator.uz/p/',
    'https://mator.uz/p/a/b',
    'https://mator.uz/p/%E0%A4%A',
    'https://mator.uz/p/..%2Fcart',
    'https://mator.uz/p/%3Cscript%3E',
    'mator://item-detail/part_stock_6381',
    'mator://payment-return?order=1',
  ])('%s is not rewritten', (url) => {
    expect(appPathForShareLink(url)).toBeNull();
    expect(redirectSystemPath({ path: url, initial: false })).toBe(url);
  });

  test('the production app claims exactly /p/ on mator.uz, on iOS and Android', () => {
    const { ios, android } = appJson.expo;
    expect(ios.associatedDomains).toContain('applinks:mator.uz');
    expect(android.package).toBe('com.mator.myapp');
    expect(android.intentFilters).toEqual([{
      action: 'VIEW',
      autoVerify: true,
      data: [{ scheme: 'https', host: 'mator.uz', pathPrefix: '/p/' }],
      category: ['BROWSABLE', 'DEFAULT'],
    }]);
  });
});
