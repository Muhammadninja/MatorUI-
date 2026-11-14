import { expect, test } from 'vitest';

import appJson from '../app.json';

// iOS offers an "@mator.uz #123456" SMS code only in an app that lists
// mator.uz under webcredentials, and only if mator.uz's
// /.well-known/apple-app-site-association names this exact app ID back
// (served by the mator-admin site).
test('the production app claims mator.uz for domain-bound SMS codes', () => {
  const { ios } = appJson.expo;
  expect(ios.associatedDomains).toEqual(['webcredentials:mator.uz']);
  expect(`${ios.appleTeamId}.${ios.bundleIdentifier}`).toBe('DXP9AG6TPN.com.fotih12.mator');
});
