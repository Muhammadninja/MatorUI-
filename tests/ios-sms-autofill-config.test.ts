import { expect, test } from 'vitest';

import appJson from '../app.json';

// iOS offers an "@mator.uz #123456" SMS code only in an app that lists
// mator.uz under webcredentials, and only if mator.uz's
// /.well-known/apple-app-site-association names this app's application
// identifier, G5876A655Y.com.fotih12.mator (served by the mator-admin site).
// The prefix is the signing team, as in the EAS provisioning profile, not
// app.json's appleTeamId. `applinks` is the product share links
// (tests/product-share-links.test.ts).
test('the production app claims mator.uz for domain-bound SMS codes', () => {
  const { ios } = appJson.expo;
  expect(ios.associatedDomains).toEqual(['applinks:mator.uz', 'webcredentials:mator.uz']);
  expect(ios.bundleIdentifier).toBe('com.fotih12.mator');
});
